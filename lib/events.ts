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
	datalog,
	EventHandler,
	github,
	repository,
	secret,
	status,
} from "@atomist/skill";
import * as fs from "fs-extra";

import { Configuration } from "./configuration";
import { OnDockerBaseImageUpdate, OnDockerfile } from "./types";
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

enum ResultEntityState {
	Pending = ":policy.result.state/PENDING",
	Success = ":policy.result.state/SUCCESS",
	Failure = ":policy.result.state/FAILURE",
	Neutral = ":policy.result.state/NEUTRAL",
}

type ResultEntity = {
	sha: string;
	name: string;
	state: ResultEntityState;
	managedBy?: string;
	createdAt?: Date;
	lastUpdated: Date;
};

type ResultOwnerEntity = {
	name: string;
	namespace: string;
	version: string;
};

export const onDockerfile: EventHandler<
	OnDockerfile,
	Configuration
> = async ctx => {
	const cfg = ctx.configuration.parameters;

	if (!(cfg.acceptRegistries?.length > 0 || cfg.acceptImages?.length > 0)) {
		return status
			.success(`Accepted base image policy not configured`)
			.hidden();
	}

	const commit = ctx.data.commit;

	const id = repository.gitHub({
		owner: commit.repo.org.name,
		repo: commit.repo.name,
		credential: { token: commit.repo.org.installationToken, scopes: [] },
	});

	const check = await github.createCheck(ctx, id, {
		sha: commit.sha,
		name: ctx.skill.name,
		title: "Accepted Docker base image",
		body: `Checking Docker base image against configured accept list`,
		reuse: true,
	});

	const ownerEntity = datalog.entity<ResultOwnerEntity>(
		"policy.result/owner",
		{
			name: ctx.skill.name,
			namespace: ctx.skill.namespace,
			version: ctx.skill.version,
		},
	);
	let resultEntity = datalog.entity<ResultEntity>("policy/result", {
		sha: commit.sha,
		name: ctx.skill.name,
		state: ResultEntityState.Pending,
		createdAt: new Date(),
		lastUpdated: new Date(),
		managedBy: datalog.entityRef(ownerEntity),
	});
	await ctx.datalog.transact([ownerEntity, resultEntity]);

	const file = ctx.data.file;
	const repositoryLabel = file.lines?.find(l => l.repository);
	const tagLabel = file.lines?.find(
		l =>
			l.instruction === "LABEL" &&
			l.argsMap[0][0] === "com.atomist.follow-tag",
	)?.argsMap[0][1];
	const imageName = `${repositoryLabel.repository.name}:${
		repositoryLabel.tag
			? repositoryLabel.tag
			: tagLabel
			? tagLabel
			: "latest"
	}`;

	// Check registry
	if (cfg.acceptRegistries?.length > 0 && repositoryLabel) {
		if (!cfg.acceptRegistries.includes(repositoryLabel.repository.host)) {
			// Set check
			await check.update({
				conclusion: "action_required",
				body: `Used \`${repositoryLabel.repository.host}\` is not an accepted Docker registry`,
				annotations: [
					{
						annotationLevel: "failure",
						path: file.path,
						startLine: repositoryLabel.number,
						endLine: repositoryLabel.number,
						message: `${repositoryLabel.repository.host} is not an accepted Docker registry`,
						title: "Accepted Docker base image",
					},
				],
			});
			resultEntity = datalog.entity<ResultEntity>("policy/result", {
				sha: commit.sha,
				name: ctx.skill.name,
				state: ResultEntityState.Failure,
				lastUpdated: new Date(),
			});
			await ctx.datalog.transact([ownerEntity, resultEntity]);
			return status.success(
				`Detected unaccepted Docker registry \`${repositoryLabel.repository.host}\``,
			);
		}
	}

	// Check image and tag
	if (cfg.acceptImages?.length > 0 && repositoryLabel) {
		let allowed = false;
		for (const acceptImage of cfg.acceptImages) {
			const image = acceptImage.split(":")[0];
			const tag = acceptImage.split(":")[1];
			if (image === repositoryLabel.repository.name) {
				if (!tag) {
					allowed = true;
					break;
				} else if (repositoryLabel.tag === tag) {
					allowed = true;
				} else if (tagLabel === tag) {
					allowed = true;
				}
			}
		}

		if (!allowed) {
			await check.update({
				conclusion: "action_required",
				body: `Used image \`${imageName}\` is not an accepted Docker base image`,
				annotations: [
					{
						annotationLevel: "failure",
						path: file.path,
						startLine: repositoryLabel.number,
						endLine: repositoryLabel.number,
						message: `${imageName} is not an accepted Docker base image`,
						title: "Accepted Docker base image",
					},
				],
			});
			resultEntity = datalog.entity<ResultEntity>("policy/result", {
				sha: commit.sha,
				name: ctx.skill.name,
				state: ResultEntityState.Failure,
				lastUpdated: new Date(),
			});
			return status.success(
				`${imageName} is not an accepted Docker base image`,
			);
		}
	}

	await check.update({
		conclusion: "success",
		body: `Used image \`${imageName}\` is an accepted Docker base image`,
	});
	resultEntity = datalog.entity<ResultEntity>("policy/result", {
		sha: commit.sha,
		name: ctx.skill.name,
		state: ResultEntityState.Success,
		lastUpdated: new Date(),
	});
	return status.success(`${imageName} is an accepted Docker base image`);
};
