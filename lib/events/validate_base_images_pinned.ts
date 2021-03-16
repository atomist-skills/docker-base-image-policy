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
	policy,
	repository,
	status,
	subscription,
} from "@atomist/skill";
import * as _ from "lodash";

import { Configuration } from "../configuration";
import { policyHandler } from "../policy_handler";
import { CommitAndDockerfile } from "../types";

export const handler: EventHandler<
	CommitAndDockerfile,
	Configuration
> = policyHandler<CommitAndDockerfile, Configuration>({
	condition: async ctx => {
		const cfg = ctx.configuration.parameters;

		if (!cfg.pinningRequired) {
			return status
				.success(`Pinned base image policy not configured`)
				.hidden();
		}
		return undefined;
	},
	id: async ctx =>
		repository.gitHub({
			sha: ctx.data.commit.sha,
			owner: ctx.data.commit.repo.org.name,
			repo: ctx.data.commit.repo.name,
			credential: {
				token: ctx.data.commit.repo.org.installationToken,
				scopes: [],
			},
		}),
	setup: async ctx => ({
		name: `${ctx.skill.name}/pinned/${ctx.data.file.path.toLowerCase()}`,
		title: "Pinned Docker base image policy",
		body: `Checking if Docker base images in \`${ctx.data.file.path}\` are pinned`,
	}),
	execute: async ctx => {
		const file = ctx.data.file;

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
				const from = `${_.padStart(
					l.number.toString(),
					maxLength,
				)}: FROM ${l.argsString}`;
				return `\`\`\`
${from}
${_.padStart("", from.split("@sha")[0].length)}\`--> ${l.tag} 
\`\`\``;
			})
			.join("\n\n");

		if (unpinnedFromLines.length === 0) {
			return {
				state: policy.result.ResultEntityState.Success,
				status: status.success(`All Docker base images are pinned`),
				body: `All Docker base images in \`${file.path}\` are pinned as required\n\n${pinnedFromLinesBody}`,
			};
		} else {
			const body = `The following Docker base images in \`${
				file.path
			}\` are not pinned as required

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
			}`;
			return {
				state: policy.result.ResultEntityState.Failure,
				severity: policy.result.ResultEntitySeverity.High,
				status: status.success(`Unpinned Docker base images detected`),
				body,
				annotations: unpinnedFromLines.map(l => ({
					title: "Pinned base image",
					message: `${l.repository.name} is not pinned`,
					annotationLevel: "failure",
					startLine: l.number,
					endLine: l.number,
					path: file.path,
				})),
			};
		}
	},
});

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
