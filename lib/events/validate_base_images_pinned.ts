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

import { EventContext, policy, status, subscription } from "@atomist/skill";
import * as _ from "lodash";

import { Configuration } from "../configuration";
import { ValidateBaseImages } from "../types";

export const handler = policy.handler<ValidateBaseImages, Configuration>({
	id: ctx => ({
		sha: ctx.data.commit.sha,
		owner: ctx.data.commit.repo.org.name,
		repo: ctx.data.commit.repo.name,
		credential: {
			token: ctx.data.commit.repo.org.installationToken,
			scopes: [],
		},
	}),
	details: ctx => ({
		name: `${ctx.skill.name}/pinned`,
		title: "Pinned Docker base image policy",
		body: `Checking if Docker base images in ${ctx.data.commit.files
			.map(f => `\`${f.path}\``)
			.join(", ")} are pinned`,
	}),
	execute: async ctx => {
		const commit = ctx.data.commit;
		const linesByFile: Array<{
			path: string;
			unpinned: string;
			unpinnedLines: ValidateBaseImages["commit"]["files"][0]["lines"];
			pinned: string;
		}> = [];
		for (const file of ctx.data.commit.files) {
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

			const maxLength = _.maxBy(fromLines, "number").number.toString()
				.length;

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
			const unpinnedFromLinesBody = unpinnedFromLines
				.map(
					l => `
\`\`\`
${_.padStart(l.number.toString(), maxLength)}: FROM ${l.argsString}
\`\`\``,
				)
				.join("\n\n");
			linesByFile.push({
				path: file.path,
				pinned: pinnedFromLinesBody,
				unpinned: unpinnedFromLinesBody,
				unpinnedLines: unpinnedFromLines,
			});
		}

		if (!linesByFile.some(l => l.unpinned.length > 0)) {
			return {
				state: policy.result.ResultEntityState.Success,
				status: status.success(
					`All Docker base images pinned in \`${
						commit.repo.org.name
					}/${commit.repo.name}@${commit.sha.slice(0, 7)}\``,
				),
				body: `All Docker base images are pinned as required.

${linesByFile
	.map(
		f => `\`${f.path}\`

${f.pinned}`,
	)
	.join("\n\n")}`,
			};
		} else {
			const body = `The following Docker base images are not pinned as required:

${linesByFile
	.filter(l => l.unpinned)
	.map(l => f => `\`${f.path}\`

${f.unpinned}`)
	.join("\n\n")}${
				linesByFile.filter(l => l.pinned).length > 0
					? `

---

The following Docker base images are pinned:
													  
${linesByFile
	.filter(l => l.pinned)
	.map(
		f => `\`${f.path}\`

${f.pinned}`,
	)
	.join("\n\n")}`
					: ""
			}`;
			return {
				state: policy.result.ResultEntityState.Failure,
				severity: policy.result.ResultEntitySeverity.High,
				status: status.success(
					`Unpinned Docker base images \`${commit.repo.org.name}/${
						commit.repo.name
					}@${commit.sha.slice(0, 7)}\``,
				),
				body,
				annotations: _.flattenDeep(
					linesByFile
						.filter(l => l.unpinnedLines.length > 0)
						.map(l =>
							l.unpinnedLines.map(ul => ({
								title: "Pinned base image",
								message: `${ul.repository.name} is not pinned`,
								annotationLevel: "failure",
								startLine: ul.number,
								endLine: ul.number,
								path: l.path,
							})),
						),
				),
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
