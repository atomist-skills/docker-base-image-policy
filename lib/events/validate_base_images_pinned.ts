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
	EventContext,
	EventHandler,
	github,
	policy,
	repository,
	status,
	subscription,
} from "@atomist/skill";
import * as _ from "lodash";

import { Configuration } from "../configuration";
import { CommitAndDockerfile } from "../types";

export const handler: EventHandler<
	CommitAndDockerfile,
	Configuration
> = async ctx => {
	const cfg = ctx.configuration.parameters;

	if (!cfg.pinningRequired) {
		return status
			.success(`Pinned base image policy not configured`)
			.hidden();
	}

	const commit = ctx.data.commit;
	const file = ctx.data.file;

	const id = repository.gitHub({
		owner: commit.repo.org.name,
		repo: commit.repo.name,
		credential: { token: commit.repo.org.installationToken, scopes: [] },
	});

	const check = await github.createCheck(ctx, id, {
		sha: commit.sha,
		name: `${ctx.skill.name}/pinned/${file.path.toLowerCase()}`,
		title: "Pinned Docker base images",
		body: `Checking if Docker base images in \`${file.path}\` are pinned`,
		reuse: true,
	});

	const result = await policy.result.pending(ctx, {
		sha: commit.sha,
		name: `${ctx.skill.name}/pinned`,
		title: `Docker Pinned Base Images Policy`,
	});

	const fromLines = _.orderBy(file.lines, "number").filter(
		l => l.instruction === "FROM",
	);
	const unpinnedFromLines = fromLines.filter(l => !l.digest);
	const pinnedFromLines = fromLines.filter(l => l.digest);
	for (const pinnedFromLine of pinnedFromLines) {
		if (!pinnedFromLine.tag) {
			// attempt to load the missing tag
			pinnedFromLine.tag = await findTag(
				ctx,
				pinnedFromLine.repository,
				pinnedFromLine.digest,
			);
		}
	}

	const maxLength = _.maxBy(fromLines, "number").number.toString().length;

	const pinnedFromLinesBody = pinnedFromLines
		.map(l => {
			const from = `${_.padStart(l.number.toString(), maxLength)}: FROM ${
				l.argsString
			}`;
			return `\`\`\`
${from}
${_.padStart("", from.split("@sha")[0].length)}\`--> ${l.tag} 
\`\`\``;
		})
		.join("\n\n");

	if (unpinnedFromLines.length === 0) {
		await check.update({
			conclusion: "success",
			body: `${policy.badge.link({
				sha: commit.sha,
				workspace: ctx.workspaceId,
				policy: `${ctx.skill.name}/pinned`,
			})}

All Docker base images in \`${file.path}\` are pinned as required

${pinnedFromLinesBody}			
			`,
		});
		await result.success();
		return status.success(`All Docker base images are pinned`);
	} else {
		await check.update({
			conclusion: "action_required",
			body: `${policy.badge.link({
				sha: commit.sha,
				workspace: ctx.workspaceId,
				policy: `${ctx.skill.name}/pinned`,
			})}

The following Docker base images in \`${file.path}\` are not pinned as required

${unpinnedFromLines
	.map(
		l => `
\`\`\`
${_.padStart(l.number.toString(), maxLength)}: FROM ${l.argsString}
\`\`\``,
	)
	.join("\n\n")}${
				pinnedFromLines.length > 0
					? `

---

The following Docker base images in \`${file.path}\` are pinned
													  
${pinnedFromLinesBody}`
					: ""
			}`,
			annotations: unpinnedFromLines.map(l => ({
				title: "Pinned base image",
				message: `${l.repository.name} is not pinned`,
				annotationLevel: "failure",
				startLine: l.number,
				endLine: l.number,
				path: file.path,
			})),
		});
		await result.failed(policy.result.ResultEntitySeverity.High);
		return status.success(`Unpinned Docker base images detected`);
	}
};

async function findTag(
	ctx: EventContext<any, Configuration>,
	repository: subscription.datalog.DockerImage["repository"],
	digest: string,
): Promise<string> {
	try {
		const result = await ctx.datalog.query<string>(
			`[:find
 ?tags
 :in $ $before-db %
 :where
 [?repository :docker.repository/host ?host]
 [?repository :docker.repository/repository ?name]
 (or-join
  [?tags]
  (and
   [?image :docker.image/repository ?repository]
   [?image :docker.image/digest ?digest]
   [?image :docker.image/tags ?tags])
  (and
   [?manifest :docker.manifest-list/repository ?repository]
   [?manifest :docker.manifest-list/digest ?digest]
   [?manifest :docker.manifest-list/tags ?tags]))]
`,
			{
				digest,
				host: repository.host,
				name: repository.name,
			},
			{ mode: "obj" },
		);
		return result[0];
	} catch (e) {
		return undefined;
	}
}
