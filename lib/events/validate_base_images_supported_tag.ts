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

import { github, MappingEventHandler, policy, status } from "@atomist/skill";
import { wrapEventHandler } from "@atomist/skill/lib/map";
import * as _ from "lodash";

import { Configuration } from "../configuration";
import { ValidateBaseImages, ValidateBaseImagesRaw } from "../types";
import { linkFile } from "../util";
import {
	CreateRepositoryIdFromCommit,
	DockerfilesTransacted,
	findTag,
} from "./shared";

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
			when: DockerfilesTransacted,
			id: CreateRepositoryIdFromCommit,
			details: ctx => ({
				name: `${ctx.skill.name}/tag`,
				title: "Supported Docker base image tag policy",
				body: `Checking if Docker base images in ${ctx.data.commit.dockerFiles
					.map(f => `\`${f.path}\``)
					.join(", ")} use supported tags`,
			}),
			execute: async ctx => {
				const mSupportedTags = _.memoize(supportedTags);
				const commit = ctx.data.commit;
				let linesByFile: Array<{
					path: string;
					unsupported: string;
					unsupportedLines: ValidateBaseImages["commit"]["dockerFiles"][0]["lines"];
					supported: string;
				}> = [];
				for (const file of ctx.data.commit.dockerFiles) {
					const fromLines = _.orderBy(file.lines, "number")
						.filter(l => l.instruction === "FROM")
						.filter(l => l.repository.host === "hub.docker.com")
						.filter(l => !l.repository.name.includes("/"));
					for (const fromLine of fromLines) {
						if (!fromLine.tag) {
							// attempt to load the missing tag
							fromLine.tag = findTag(
								ctx,
								fromLine.repository,
								fromLine.digest,
							);
						}
					}
					const supportedLines = [];
					const unSupportedLines = [];
					for (const fromLine of fromLines) {
						const tags = await mSupportedTags(
							commit,
							fromLine.repository.name,
						);
						if (tags.includes(fromLine.tag)) {
							supportedLines.push(fromLine);
						} else {
							unSupportedLines.push(fromLine);
						}
					}

					const maxLength =
						_.maxBy(fromLines, "number")?.number?.toString()
							.length || 0;

					const supportedLinesBody = supportedLines
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
					const unSupportedLinesBody = unSupportedLines
						.map(
							l => `
\`\`\`
${_.padStart(l.number.toString(), maxLength)}: FROM ${l.argsString}
\`\`\``,
						)
						.join("\n\n");
					linesByFile.push({
						path: file.path,
						supported: supportedLinesBody,
						unsupported: unSupportedLinesBody,
						unsupportedLines: unSupportedLines,
					});
				}

				linesByFile = _.sortBy(linesByFile, "path");
				if (
					!linesByFile.some(l => l.unsupported) &&
					!linesByFile.some(l => l.supported)
				) {
					return {
						state: policy.result.ResultEntityState.Neutral,
						status: status.success(
							`No official Docker base images in \`${
								commit.repo.org.name
							}/${commit.repo.name}@${commit.sha.slice(0, 7)}\``,
						),
						body: `No official Docker base images being used in any of the Dockerfiles

${linesByFile.map(f => `${linkFile(f.path, commit)}`).join("\n\n---\n\n")}`,
					};
				} else if (!linesByFile.some(l => l.unsupported)) {
					return {
						state: policy.result.ResultEntityState.Success,
						status: status.success(
							`All Docker base images in \`${
								commit.repo.org.name
							}/${commit.repo.name}@${commit.sha.slice(
								0,
								7,
							)}\` use supported tags`,
						),
						body: `All Docker base images use supported tags.

${linesByFile
	.map(
		f => `${linkFile(f.path, commit)}

${f.supported}`,
	)
	.join("\n\n---\n\n")}`,
					};
				} else {
					const body = `The following Docker base images use unsupported tags:

${linesByFile
	.filter(l => l.unsupported)
	.map(
		f => `${linkFile(f.path, commit)}

${f.unsupported}`,
	)
	.join("\n\n---\n\n")}${
						linesByFile.filter(l => l.supported).length > 0
							? `

---

The following Docker base images use supported tags:
													  
${linesByFile
	.filter(l => l.supported)
	.map(
		f => `${linkFile(f.path, commit)}

${f.supported}`,
	)
	.join("\n\n")}`
							: ""
					}`;
					return {
						state: policy.result.ResultEntityState.Failure,
						severity: policy.result.ResultEntitySeverity.High,
						status: status.success(
							`Docker base images \`${commit.repo.org.name}/${
								commit.repo.name
							}@${commit.sha.slice(
								0,
								7,
							)}\` with unsupported tags`,
						),
						body,
						annotations: _.flattenDeep(
							linesByFile
								.filter(l => l.unsupportedLines.length > 0)
								.map(l =>
									l.unsupportedLines.map(ul => ({
										title: "Unsupported tag",
										message: `${ul.tag} is not a supported tag for image ${ul.repository?.name}}`,
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
		}),
	),
};

async function supportedTags(
	commit: ValidateBaseImages["commit"],
	name: string,
): Promise<string[]> {
	const libraryFile = new Buffer(
		((
			await github
				.api({
					credential: {
						token: commit.repo.org.installationToken,
						scopes: [],
					},
				})
				.repos.getContent({
					owner: "docker-library",
					repo: "official-images",
					path: `library/${name}`,
				})
		).data as any).content,
		"base64",
	).toString();

	const regexp = /^Tags:(.*)$/gm;
	const tags = [];
	let match: RegExpExecArray;
	do {
		match = regexp.exec(libraryFile);
		if (match) {
			tags.push(...match[1].split(",").map(t => t.trim()));
		}
	} while (match);

	return _.uniq(tags);
}
