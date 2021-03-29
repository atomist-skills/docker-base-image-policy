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
	template,
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
	platform: CommitAndDockerfile["file"]["lines"][0]["manifestList"]["images"][0]["platform"][0],
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
			os: platform.os,
			arch: platform.architecture,
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
	if (
		repository.host === "hub.docker.com" &&
		!repository.name.includes("/")
	) {
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
	return undefined;
}

export async function changelog(
	ctx: EventContext<any, Configuration>,
	p: project.Project,
	fromLine: CommitAndDockerfile["file"]["lines"][0],
	registries: CommitAndDockerfile["registry"],
): Promise<string> {
	const repository = fromLine.repository;

	if (!fromLine.digest) {
		log.debug("from line not pinned");
		return undefined;
	}

	const imageName = `${
		repository.host !== "hub.docker.com"
			? `${repository.host}/${repository.name}`
			: repository.name
	}`;

	// Get the digest of the new image
	let proposedDigest = fromLine.image?.digest;
	let platform: CommitAndDockerfile["file"]["lines"][0]["manifestList"]["images"][0]["platform"][0] = {
		os: "linux",
		architecture: "amd64",
	};
	if (fromLine.manifestList) {
		proposedDigest = fromLine.manifestList?.images?.find(i =>
			i.platform.some(
				p => p.os === "linux" && p.architecture === "amd64",
			),
		)?.digest;
		if (!proposedDigest) {
			proposedDigest = fromLine.manifestList?.images?.[0].digest;
			platform = fromLine.manifestList?.images?.[0].platform[0];
		}
	}

	if (!proposedDigest) {
		log.debug("Failed to calculate new digest");
		return undefined;
	}

	const currentDigest = await getCurrentDigest(
		fromLine,
		repository,
		platform,
		ctx,
	);

	if (proposedDigest === currentDigest) {
		log.debug("Same digests");
		return undefined;
	}

	const file = await getLibraryFileCommit(p, repository);

	await prepareCredentials(registries, repository);

	const outputFile = path.join(os.tmpdir(), guid());
	const args = [
		"diff",
		`${imageName}@${currentDigest}`,
		`${imageName}@${proposedDigest}`,
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
	await removeCredentials();
	if (result.status !== 0) {
		log.warn(`Failed to diff container images`);
		return undefined;
	}

	const diff = await fs.readJson(outputFile);

	const packageDiff = _.sortBy(
		_.flatten(
			diff
				.filter(d => ["Apt", "RPM", "Node", "pip"].includes(d.DiffType))
				.filter(d => d.Diff?.InfoDiff?.length > 0)
				.map(p =>
					p.Diff.InfoDiff.map(id => ({
						package: id.Package,
						current: id.Info1.Version,
						proposed: id.Info2.Version,
						type: p.DiffType,
					})),
				),
		),
		"package",
	);

	const fileDiff = _.sortBy(
		_.flattenDeep(
			diff
				.filter(d => d.DiffType === "File")
				.map(d => [
					...(d.Diff.Adds || []).map(a => ({
						file: a.Name,
						proposed: "+",
					})),
					...(d.Diff.Dels || []).map(d => ({
						file: d.Name,
						proposed: "-",
					})),
					...(d.Diff.Mods || []).map(m => ({
						file: m.Name,
						current: m.Size1,
						proposed: m.Size2,
					})),
				]),
		),
		"file",
	);

	const historyDiff = _.flattenDeep(
		diff
			.filter(d => d.DiffType === "History")
			.map(d => [
				...(d.Diff.Adds || []).map(a => `+ ${a}`),
				...(d.Diff.Dels || []).map(d => `- ${d}`),
			]),
	);

	const sizeDiff = diff.find(d => d.DiffType === "Size")?.Diff?.[0];
	const cl = await template.render("changelog", {
		imageName: `${imageName}${fromLine.tag ? `:${fromLine.tag}` : ""}`,
		fromLine,
		file,
		packageDiff,
		fileDiff,
		historyDiff,
		sizeDiff: {
			current: sizeDiff?.Size1,
			proposed: sizeDiff?.Size2,
		},
	});

	return cl;
}

async function prepareCredentials(
	registries: CommitAndDockerfile["registry"],
	repository: CommitAndDockerfile["file"]["lines"][0]["repository"],
): Promise<void> {
	if (registries.length === 0) {
		return;
	}
	if (
		repository.host === "hub.docker.com" &&
		!repository.name.includes("/")
	) {
		return;
	}
	const dockerConfig = {
		auths: {},
	} as any;

	for (const registry of registries) {
		const creds = {
			login:
				registry.type === subscription.datalog.DockerRegistryType.Gcr
					? "_json_key"
					: registry.username,
			secret: registry.secret,
		};

		if (registry.serverUrl?.startsWith("registry.hub.docker.com")) {
			dockerConfig.auths["https://index.docker.io/v1/"] = {
				auth: Buffer.from(creds?.login + ":" + creds?.secret)?.toString(
					"base64",
				),
			};
		} else if (registry.serverUrl) {
			const url = registry.serverUrl.split("/");
			dockerConfig.auths[url[0]] = {
				auth: Buffer.from(creds?.login + ":" + creds?.secret)?.toString(
					"base64",
				),
			};
		}
	}

	await fs.ensureDir(path.join(os.homedir(), ".docker"));
	await fs.writeJson(
		path.join(os.homedir(), ".docker", "config.json"),
		dockerConfig,
	);
}

async function removeCredentials(): Promise<void> {
	await fs.remove(path.join(os.homedir(), ".docker", "config.json"));
}
