/*
 * Copyright © 2021 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
	childProcess,
	EventContext,
	github,
	guid,
	log,
	project,
	subscription,
} from "@atomist/skill";
import * as fs from "fs-extra";
import * as _ from "lodash";
import * as os from "os";
import * as path from "path";

import { Configuration } from "./configuration";
import { CommitAndDockerfile } from "./types";

async function getCurrentDigest(
	fromLine: CommitAndDockerfile["file"]["lines"][0],
	repository: subscription.datalog.DockerImage["repository"],
	ctx: EventContext<any, Configuration>,
): Promise<string> {
	// Get the digest of the current image
	let oldDigest = fromLine.digest;
	const oldImageDigest = (await ctx.datalog.query<{
		image: { digest: string };
	}>(
		`[:find
 (pull ?image [:schema/entity-type 
               :docker.image/digest])
 :in
 $
 $before-db
 %
 :where
 [?repository :docker.repository/host ?host]
 [?repository :docker.repository/repository ?name]
 [?manifest :docker.manifest-list/repository ?repository]
 [?manifest
  :docker.manifest-list/digest
  ?digest]
 [?manifest :docker.manifest-list/images ?image]
 [?platform :docker.platform/image ?image]
 [?platform :docker.platform/os ?os]
 [?platform :docker.platform/architecture ?arch]]`,
		{
			host: repository.host,
			name: repository.name,
			digest: fromLine.digest,
			os: "linux",
			arch: "amd64",
		},
	)) as Array<{ image: { digest: string } }>;
	if (oldImageDigest?.length > 0) {
		oldDigest = oldImageDigest[0].image.digest;
	}
	return oldDigest;
}

async function getLibraryFileCommit(
	p: project.Project,
	repository: subscription.datalog.DockerImage["repository"],
): Promise<{ sha: string; commit: { message: string } }> {
	// Get commit on the definition file
	return (
		await github.api(p.id).repos.listCommits({
			owner: "docker-library",
			repo: "official-images",
			path: `library/${repository.name}`,
			per_page: 1,
		} as any)
	).data[0];
}

export async function changelog(
	ctx: EventContext<any, Configuration>,
	p: project.Project,
	fromLine: CommitAndDockerfile["file"]["lines"][0],
): Promise<string> {
	const repository = fromLine.repository;
	// Ony calculate changelog for official docker images from Docker Hub
	if (
		!(
			repository.host === "hub.docker.com" &&
			!repository.name.includes("/")
		)
	) {
		log.debug("Only create changelog for official Docker Hub images");
		return undefined;
	}

	if (!fromLine.digest) {
		log.debug("from line not pinned");
		return undefined;
	}

	// Get the digest of the new image
	let proposedDigest = fromLine.image?.digest;
	if (fromLine.manifestList) {
		proposedDigest = fromLine.manifestList.images.find(i =>
			i.platform.some(
				p => p.os === "linux" && p.architecture === "amd64",
			),
		)?.digest;
	}

	if (!proposedDigest) {
		log.debug("Failed to calculate new digest");
		return undefined;
	}

	const currentDigest = await getCurrentDigest(fromLine, repository, ctx);
	const file = await getLibraryFileCommit(p, repository);

	const outputFile = path.join(os.tmpdir(), guid());
	const args = [
		"diff",
		`${repository.name}@${currentDigest}`,
		`${repository.name}@${proposedDigest}`,
		"--type=history",
		"--type=apt",
		"--type=node",
		"--type=file",
		"--type=size",
		"--type=pip",
		"--type=rpm",
		"--json",
		"--quiet",
		`--output=${outputFile}`,
	];
	const result = await childProcess.spawnPromise("container-diff", args);
	if (result.status !== 0) {
		throw new Error("Failed to diff images");
	}

	const diff = await fs.readJson(outputFile);

	const packageDiff = diff
		.filter(d => ["Apt", "RPM", "Node", "pip"].includes(d.DiffType))
		.filter(d => d.Diff?.InfoDiff?.length > 0);

	const packageBody =
		packageDiff.length === 0
			? `No package differences detected`
			: `The following package differences were detected: 

| Name | Current | Proposed | Type |
| ---- | ------- | -------- | ---- |
${_.flattenDeep(
	packageDiff.map(p =>
		p.Diff.InfoDiff.map(
			id =>
				`| \`${id.Package}\` | \`${id.Info1.Version}\` | \`${id.Info2.Version}\` | ${p.DiffType} |`,
		),
	),
)
	.sort()
	.join("\n")}`;

	const fileDiff = _.flattenDeep(
		diff
			.filter(d => d.DiffType === "File")
			.map(d => [
				...(d.Diff.Adds || []).map(
					a => `| \`${a.Name}\` | | ${niceBytes(a.Size2)} |`,
				),
				...(d.Diff.Dels || []).map(
					d => `| \`${d.Name}\` | ${niceBytes(d.Size1)} | |`,
				),
				...(d.Diff.Mods || []).map(
					m =>
						`| \`${m.Name}\` | ${niceBytes(m.Size1)} | ${niceBytes(
							m.Size2,
						)} |`,
				),
			]),
	);

	const fileBody =
		fileDiff.length > 0
			? `The following file differences were detected:
			
| Name | Current | Proposed |
| ---- | ------- | -------- |
${fileDiff.sort().join("\n")}
`
			: "No file differences detected";

	const historyDiff = _.flattenDeep(
		diff
			.filter(d => d.DiffType === "History")
			.map(d => [
				...(d.Diff.Adds || []).map(a => `+ ${a}`),
				...(d.Diff.Dels || []).map(d => `- ${d}`),
			]),
	);

	const historyBody =
		historyDiff.length > 0
			? `The following differences in \`docker inspect\` were detected:
\`\`\`			
${historyDiff.sort().join("\n")}
\`\`\`
`
			: "No differences in `docker inspect` detected";

	const sizeDiff = diff.find(d => d.DiffType === "Size")?.Diff?.[0];

	const cl = `<!-- atomist:hide -->
<details>
<summary>Changelog for <code>${repository.name}${
		fromLine.tag ? `:${fromLine.tag}` : ""
	}</code></summary>
<p>

${
	file
		? `### Commit

New image build caused by commit docker-library/official-images@${file.sha} to [\`library/${repository.name}\`](https://github.com/docker-library/official-images/blob/${file.sha}/library/${repository.name}):

\`\`\`
${file.commit.message}
\`\`\`

---

`
		: ""
}### Comparison

Comparing Docker image \`${repository.name}${
		fromLine.tag ? `:${fromLine.tag}` : ""
	}\` at

_Current_ \`${fromLine.digest}\` (${niceBytes(sizeDiff.Size1)}) and 
_Proposed_ \`${
		fromLine.image?.digest || fromLine.manifestList?.digest
	}\` (${niceBytes(sizeDiff.Size2)}) digests: 

#### Packages

${packageBody}

#### Files

${fileBody}

#### History

${historyBody}

---

</p>
</details>
<!-- atomist:show -->`;

	return cl;
}

const units = ["b", "kb", "mb", "gb", "tb", "pb"];
function niceBytes(x: string): string {
	let l = 0,
		n = parseInt(x, 10) || 0;

	while (n >= 1024 && ++l) {
		n = n / 1024;
	}
	return n.toFixed(n < 10 && l > 0 ? 1 : 0) + "" + units[l];
}
