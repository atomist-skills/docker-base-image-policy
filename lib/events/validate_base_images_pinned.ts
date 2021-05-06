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

import { MappingEventHandler, policy, status } from "@atomist/skill";
import { wrapEventHandler } from "@atomist/skill/lib/map";
import * as _ from "lodash";

import { Configuration } from "../configuration";
import { ValidateBaseImages, ValidateBaseImagesRaw } from "../types";
import { findTag, imageName, linkFile, printTag } from "../util";
import { CreateRepositoryIdFromCommit, DockerfilesTransacted } from "./shared";

export const handler: MappingEventHandler<
	ValidateBaseImages[],
	ValidateBaseImagesRaw,
	Configuration
> = {
	map: data => {
		const result: Map<string, ValidateBaseImages> = new Map();
		for (const event of data) {
			if (result.has(event.commit.sha)) {
				if (event.manifestList) {
					result
						.get(event.commit.sha)
						.manifestList.push(event.manifestList);
				}
				if (event.image) {
					result.get(event.commit.sha).image.push(event.image);
				}
			} else {
				result.set(event.commit.sha, {
					commit: event.commit,
					image: event.image ? [event.image] : [],
					manifestList: event.manifestList
						? [event.manifestList]
						: [],
				});
			}
		}
		return [...result.values()].map(r => ({
			commit: r.commit,
			image: _.uniqBy(r.image, "id"),
			manifestList: _.uniqBy(r.manifestList, "id"),
		}));
	},
	handle: wrapEventHandler(
		policy.handler<ValidateBaseImages, Configuration>({
			when: policy.whenAll(
				policy.whenParameter("pinningRequired"),
				DockerfilesTransacted,
			),
			id: CreateRepositoryIdFromCommit,
			details: ctx => ({
				name: `${ctx.skill.name}/pinned`,
				title: "Pinned Docker base image policy",
				body: `Checking if Docker base images in ${ctx.data.commit.dockerFiles
					.map(f => `\`${f.path}\``)
					.join(", ")} are pinned`,
			}),
			execute: async ctx => {
				const cfg = ctx.configuration.parameters;
				const commit = ctx.data.commit;
				let linesByFile: Array<{
					path: string;
					unpinned: string;
					unpinnedLines: ValidateBaseImages["commit"]["dockerFiles"][0]["lines"];
					pinned: string;
				}> = [];
				for (const file of ctx.data.commit.dockerFiles) {
					const fromLines = _.orderBy(file.lines, "number").filter(
						l => l.instruction === "FROM",
					);
					const unpinnedFromLines = fromLines.filter(l => !l.digest);
					const pinnedFromLines = fromLines.filter(l => l.digest);
					for (const pinnedFromLine of pinnedFromLines) {
						if (!pinnedFromLine.tag) {
							// attempt to load the missing tag
							pinnedFromLine.tag = findTag(
								ctx,
								pinnedFromLine.repository,
								pinnedFromLine.digest,
							);
						}
					}

					const maxLength = _.maxBy(
						fromLines,
						"number",
					).number.toString().length;

					const pinnedFromLinesBody = pinnedFromLines
						.map(l => {
							const from = `${_.padStart(
								l.number.toString(),
								maxLength,
							)}: FROM ${l.argsString}`;
							return `\`\`\`
${from}${printTag(from, l)}
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

				linesByFile = _.sortBy(linesByFile, "path");

				if (!linesByFile.some(l => l.unpinned)) {
					return {
						state: policy.result.ResultEntityState.Success,
						status: status.success(
							`All Docker base images pinned in \`${
								commit.repo.org.name
							}/${commit.repo.name}@${commit.sha.slice(0, 7)}\``,
						),
						body: `All Docker base images are pinned

${linesByFile
	.map(
		f => `${linkFile(f.path, commit)}

${f.pinned}`,
	)
	.join("\n\n---\n\n")}`,
					};
				} else {
					const body = `The following Docker base images are not pinned:

${linesByFile
	.filter(l => l.unpinned)
	.map(
		f => `${linkFile(f.path, commit)}

${f.unpinned}`,
	)
	.join("\n\n---\n\n")}${
						linesByFile.filter(l => l.pinned).length > 0
							? `

---

The following Docker base images are pinned:
													  
${linesByFile
	.filter(l => l.pinned)
	.map(
		f => `${linkFile(f.path, commit)}

${f.pinned}`,
	)
	.join("\n\n")}`
							: ""
					}`;
					return {
						state: cfg.pinningFailCheck
							? policy.result.ResultEntityState.Failure
							: policy.result.ResultEntityState.Neutral,
						severity: cfg.pinningFailCheck
							? policy.result.ResultEntitySeverity.High
							: undefined,
						status: status.success(
							`Unpinned Docker base images \`${
								commit.repo.org.name
							}/${commit.repo.name}@${commit.sha.slice(0, 7)}\``,
						),
						body,
						annotations: _.flattenDeep(
							linesByFile
								.filter(l => l.unpinnedLines.length > 0)
								.map(l =>
									l.unpinnedLines.map(ul => ({
										title: "Pinned base image",
										message: `${
											imageName(ul.repository) ||
											ul.argsString
												.split("@")[0]
												.split(":")[0]
										} is not pinned`,
										annotationLevel: cfg.pinningFailCheck
											? "failure"
											: "notice",
										startLine: ul.number,
										endLine: ul.number,
										path: l.path,
									})),
								),
						),
					};
				}
			},
		}),
	),
};
