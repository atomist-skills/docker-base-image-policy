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

import { EventHandler, github, repository, secret } from "@atomist/skill";
import * as fs from "fs-extra";

import { Configuration } from "./configuration";
import { OnDockerBaseImageUpdate } from "./types";
import { replaceLastFrom } from "./util";

const onDockerBaseImageUpdate: EventHandler<
	OnDockerBaseImageUpdate,
	Configuration
> = async ctx => {
	const cfg = ctx.configuration.parameters;
	const commit = ctx.data.commit;
	const image = ctx.data.image;
	const file = ctx.data.file;

	const credential = await ctx.credential.resolve(
		secret.gitHubAppToken({
			owner: commit.repo.org.name,
			repo: commit.repo.name,
		}),
	);

	const project = await ctx.project.clone(
		repository.gitHub({
			owner: commit.repo.org.name,
			repo: commit.repo.name,
			credential,
		}),
	);

	const imageName = `${
		image.repository.host !== "hub.docker.com"
			? `${image.repository.host}/${image.repository.name}`
			: image.repository.name
	}@${image.digest}`;

	const dockerfilePath = project.path(file.path);
	const dockerfile = (await fs.readFile(dockerfilePath)).toString();
	const replacedDockerfile = replaceLastFrom(
		dockerfile,
		imageName,
		image.tags[0],
	);
	await fs.writeFile(dockerfilePath, replacedDockerfile);

	return await github.persistChanges(
		ctx,
		project,
		"pr",
		{
			branch: commit.repo.defaultBranch,
			author: {
				login: undefined,
				name: undefined,
				email: undefined,
			},
			defaultBranch: commit.repo.defaultBranch,
		},
		{
			branch: `atomist/pin-docker-base-image`,
			assignReviewer: !!cfg.pinningAssignReviewers,
			reviewers: cfg.pinningAssignReviewers
				? [commit.author.login]
				: undefined,
			labels: cfg.pinningLabels,
			title: `Pin Docker base image to current digest`,
			body: `This pull request pins the Docker base image \`${
				imageName.split("@")[0]
			}\` in \`${file.path}\` to the current digest for tag \`${
				image.tags[0]
			}\`.

\`\`\`
FROM ${imageName}
\`\`\``,
		},
		{
			message: `Pin Docker base image to current digest`,
		},
	);
};

export const onPinnedDockerBaseImageUpdate = onDockerBaseImageUpdate;
export const onUnpinnedDockerBaseImageUpdate = onDockerBaseImageUpdate;
export const onNewTaggedImageInFrom = onDockerBaseImageUpdate;
