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

import { Configuration } from "../configuration";
import { ValidateLinking, ValidateLinkingRaw } from "../types";
import { linkFile } from "../util";
import { CreateRepositoryIdFromCommit } from "./shared";

export const handler: MappingEventHandler<
	ValidateLinking,
	ValidateLinkingRaw,
	Configuration
> = {
	map: data => {
		const mapped = { image: [], commit: undefined };
		data.forEach(d => {
			mapped.commit = d.commit;
			mapped.image.push(d.image);
		});
		return mapped;
	},
	handle: policy.handler<ValidateLinking, Configuration>({
		id: CreateRepositoryIdFromCommit,
		details: ctx => ({
			name: `${ctx.skill.name}/linked`,
			title: "Linked Dockerfile and image policy",
			body: `Checking if all Dockerfiles and images are linked`,
		}),
		execute: async ctx => {
			const commit = ctx.data.commit;
			const dockerFiles = ctx.data.commit.dockerFiles || [];
			const images = ctx.data.image || [];

			const linked = [];
			dockerFiles.forEach(df => {
				const image = images.find(i => i.dockerFile?.id === df.id);
				if (image) {
					linked.push({
						image,
						dockerFile: df,
					});
				}
			});
			const unlinkedDockerFiles = dockerFiles.filter(
				df => !images.some(i => i.dockerFile?.id === df.id),
			);
			const unlinkedImages = images.filter(
				i => !dockerFiles.some(df => df.id === i.dockerFile?.id),
			);

			const linkedBody = `The following ${
				linked.length === 1
					? "Dockerfile and image is"
					: "Dockerfiles and images are"
			} linked

${linked
	.map(
		l => `\`\`\`
${imageName(l.image)}
\`\`\`

is linked to ${linkFile(l.dockerFile.path, commit)}`,
	)
	.join("\n\n")}`;

			const unlinkedDockerFilesBody = `The following ${
				unlinkedDockerFiles.length === 1
					? "Dockerfile is"
					: "Dockerfiles are"
			} not linked to an image

${unlinkedDockerFiles.map(l => `* ${linkFile(l.path, commit)}`).join("\n")}`;

			const unlinkedImagesBody = `The following ${
				unlinkedImages.length === 1
					? "Docker image is"
					: "Docker images are"
			} not linked to a Dockerfile

${unlinkedImages
	.map(
		l => `\`\`\`
${imageName(l)}
\`\`\``,
	)
	.join("\n\n")}`;

			if (unlinkedDockerFiles.length > 0 || unlinkedImages.length > 0) {
				const parts = [];
				if (unlinkedImages.length > 0) {
					parts.push(unlinkedImagesBody);
				}
				if (unlinkedDockerFiles.length > 0) {
					parts.push(unlinkedDockerFilesBody);
				}
				if (linked.length > 0) {
					parts.push(linkedBody);
				}
				return {
					state: policy.result.ResultEntityState.Neutral,
					body: parts.join("\n\n---\n\n"),
					status: status.success(
						`Not all Dockerfiles and images are linked on \`${
							commit.repo.org.name
						}/${commit.repo.name}@${commit.sha.slice(0, 7)}\``,
					),
				};
			} else {
				return {
					state: policy.result.ResultEntityState.Success,
					body: linkedBody,
					status: status.success(
						`All Dockerfiles and images are linked on \`${
							commit.repo.org.name
						}/${commit.repo.name}@${commit.sha.slice(0, 7)}\``,
					),
				};
			}
		},
	}),
};

function imageName(image: ValidateLinking["image"][0]): string {
	const name = `${
		image.repository.host !== "hub.docker.com"
			? `${image.repository.host}/${image.repository.name}`
			: image.repository.name
	}`;
	if (image.digest) {
		return `${name}@${image.digest}`;
	} else if (image.tags?.[0]) {
		return `${name}:${image.tags?.[0]}`;
	} else {
		return name;
	}
}
