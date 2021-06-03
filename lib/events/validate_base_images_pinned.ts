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

import { handle, MappingEventHandler, policy, status } from "@atomist/skill";
import * as fs from "fs-extra";
import * as _ from "lodash";

import { Configuration } from "../configuration";
import { ValidateBaseImages, ValidateBaseImagesRaw } from "../types";
import { addStartLineNo, findTag, linkFile } from "../util";
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
	handle: handle.wrapEventHandler(
		policy.checkHandler<ValidateBaseImages, Configuration>({
			when: policy.whenAll(
				policy.whenParameter("pinningRequired"),
				DockerfilesTransacted,
			),
			id: CreateRepositoryIdFromCommit,
			clone: ctx => ctx.data.commit.dockerFiles.map(df => df.path),
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
					addStartLineNo(
						fromLines,
						(
							await fs.readFile(ctx.chain.project.path(file.path))
						).toString(),
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

					const pinnedFromLinesBody = pinnedFromLines
						.map(l => {
							return `https://github.com/${commit.repo.org.name}/${commit.repo.name}/blob/${commit.sha}/${file.path}#L${l.startNumber}-L${l.number}`;
						})
						.join("\n\n");
					const unpinnedFromLinesBody = unpinnedFromLines
						.map(l => {
							return `https://github.com/${commit.repo.org.name}/${commit.repo.name}/blob/${commit.sha}/${file.path}#L${l.startNumber}-L${l.number}`;
						})
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
						conclusion: policy.Conclusion.Success,
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
						conclusion: cfg.pinningFailCheck
							? policy.Conclusion.Failure
							: policy.Conclusion.Neutral,
						severity: cfg.pinningFailCheck
							? policy.Severity.High
							: undefined,
						status: status.success(
							`Unpinned Docker base images \`${
								commit.repo.org.name
							}/${commit.repo.name}@${commit.sha.slice(0, 7)}\``,
						),
						body,
					};
				}
			},
		}),
	),
};
