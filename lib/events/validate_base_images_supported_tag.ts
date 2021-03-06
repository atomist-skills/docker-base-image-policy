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
	github,
	handle,
	MappingEventHandler,
	policy,
	status,
} from "@atomist/skill";
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
				policy.whenParameter("supportedTagRequired"),
				DockerfilesTransacted,
			),
			id: CreateRepositoryIdFromCommit,
			clone: ctx => ctx.data.commit.dockerFiles.map(df => df.path),
			details: ctx => ({
				name: `${ctx.skill.name}/tag`,
				title: "Supported Docker base image tag policy",
				body: `Checking if [Official Images](https://docs.docker.com/docker-hub/official_images/) in ${ctx.data.commit.dockerFiles
					.map(f => `\`${f.path}\``)
					.join(", ")} use tags that are supported by their authors`,
			}),
			execute: async ctx => {
				const cfg = ctx.configuration.parameters;
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
					addStartLineNo(
						fromLines,
						(
							await fs.readFile(ctx.chain.project.path(file.path))
						).toString(),
					);

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
					const usedTags = new Map<
						string,
						{ supported: string[]; text: string }
					>();
					for (const fromLine of fromLines.filter(f => f.tag)) {
						const tags = await mSupportedTags(
							fromLine.repository.name,
							commit,
						);
						usedTags.set(fromLine.repository.name, tags);
						if (tags.supported.includes(fromLine.tag)) {
							supportedLines.push(fromLine);
						} else {
							unSupportedLines.push(fromLine);
						}
					}

					const supportedLinesBody = supportedLines
						.map(l => {
							return `https://github.com/${
								commit.repo.org.name
							}/${commit.repo.name}/blob/${commit.sha}/${
								file.path
							}#L${l.startNumber}-L${l.number}

${highlightTag(
	l.tag,
	usedTags.get(l.repository.name).text,
	l.repository.name,
)}`;
						})
						.join("\n\n");
					const unSupportedLinesBody = unSupportedLines
						.map(l => {
							return `https://github.com/${
								commit.repo.org.name
							}/${commit.repo.name}/blob/${commit.sha}/${
								file.path
							}#L${l.startNumber}-L${l.number} 

${highlightTag(
	l.tag,
	usedTags.get(l.repository.name).text,
	l.repository.name,
)}`;
						})
						.join("\n\n");
					linesByFile.push({
						path: file.path,
						supported: supportedLinesBody,
						unsupported: unSupportedLinesBody,
						unsupportedLines: unSupportedLines,
					});
				}

				linesByFile = _.sortBy(linesByFile, "path").filter(
					l => l.supported || l.unsupported,
				);
				if (
					!linesByFile.some(l => l.unsupported) &&
					!linesByFile.some(l => l.supported)
				) {
					return {
						conclusion: policy.Conclusion.Neutral,
						status: status.success(
							`No official Docker base images in \`${
								commit.repo.org.name
							}/${commit.repo.name}@${commit.sha.slice(0, 7)}\``,
						),
						body: `No [Official Images](https://docs.docker.com/docker-hub/official_images/) used in any of the Dockerfiles

${linesByFile
	.map(f => `#### Path: ${linkFile(f.path, commit)}`)
	.join("\n\n---\n\n")}`,
					};
				} else if (!linesByFile.some(l => l.unsupported)) {
					return {
						conclusion: policy.Conclusion.Success,
						status: status.success(
							`All Docker base images in \`${
								commit.repo.org.name
							}/${commit.repo.name}@${commit.sha.slice(
								0,
								7,
							)}\` use supported tags`,
						),
						body: `The following [Official Images](https://docs.docker.com/docker-hub/official_images/) use tags that are supported by the authors:

${linesByFile
	.map(
		f => `#### Path: ${linkFile(f.path, commit)}

${f.supported}`,
	)
	.join("\n\n---\n\n")}`,
					};
				} else {
					const body = `The following [Official Images](https://docs.docker.com/docker-hub/official_images/) use tags that are no longer supported by the authors:

${linesByFile
	.filter(l => l.unsupported)
	.map(
		f => `#### Path: ${linkFile(f.path, commit)}

${f.unsupported}`,
	)
	.join("\n\n---\n\n")}${
						linesByFile.filter(l => l.supported).length > 0
							? `

---

The following [Official Images](https://docs.docker.com/docker-hub/official_images/) use tags that are supported by the authors:
													  
${linesByFile
	.filter(l => l.supported)
	.map(
		f => `#### Path: ${linkFile(f.path, commit)}

${f.supported}`,
	)
	.join("\n\n")}`
							: ""
					}`;
					return {
						conclusion: cfg.supportedTagFailCheck
							? policy.Conclusion.Failure
							: policy.Conclusion.Neutral,
						severity: cfg.supportedTagFailCheck
							? policy.Severity.High
							: undefined,
						status: status.success(
							`Detected Docker base images \`${
								commit.repo.org.name
							}/${commit.repo.name}@${commit.sha.slice(
								0,
								7,
							)}\` with unsupported tags`,
						),
						body,
					};
				}
			},
		}),
	),
};

async function supportedTags(
	name: string,
	commit: ValidateBaseImages["commit"],
): Promise<{ supported: string[]; text: string }> {
	const libraryFile = Buffer.from(
		(
			(
				await github
					.api({
						credential: {
							token: commit.repo.org.installationToken,
							scopes: [],
						},
					})
					.repos.getContent({
						owner: "docker-library",
						repo: "docs",
						path: `${name}/README.md`,
					})
			).data as any
		).content,
		"base64",
	).toString();

	const tagRegexp = /`([^,`]*)`/gm;
	const tagsText =
		/# Supported tags and respective `Dockerfile` links([\s\S]*?)# Quick reference/gm.exec(
			libraryFile,
		);
	const tags = [];
	let match: RegExpExecArray;
	do {
		match = tagRegexp.exec(tagsText[1]);
		if (match) {
			tags.push(match[1]);
		}
	} while (match);

	return {
		supported: _.uniq(tags),
		text: tagsText[1].trim(),
	};
}

function highlightTag(tag: string, text: string, name: string): string {
	const formattedTag = `\`${tag}\``;
	const highlightedText = text
		.replace(
			new RegExp(formattedTag, "gm"),
			`<ins>**${formattedTag}**</ins>`,
		)
		.replace(/##/gm, "####");
	return `<details>
<summary>Supported tags and respective <code>Dockerfile</code> links for <code>${name}</code></summary>

<p>

${highlightedText}

</p>
</details>`;
}
