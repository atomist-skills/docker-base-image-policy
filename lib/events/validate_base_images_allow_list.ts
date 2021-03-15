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
	EventHandler,
	github,
	policy,
	repository,
	status,
} from "@atomist/skill";
import * as _ from "lodash";

import { Configuration } from "../configuration";
import { ValidateBaseImages } from "../types";

export const handler: EventHandler<
	ValidateBaseImages,
	Configuration
> = async ctx => {
	const cfg = ctx.configuration.parameters;

	if (
		!(cfg.acceptRegistries?.length > 0 || cfg.acceptImages?.length > 0) &&
		!cfg.acceptRequired
	) {
		return status
			.success(`Allowlist base image policy not configured`)
			.hidden();
	}

	const commit = ctx.data.commit;
	const file = ctx.data.file;

	const id = repository.gitHub({
		owner: commit.repo.org.name,
		repo: commit.repo.name,
		credential: { token: commit.repo.org.installationToken, scopes: [] },
	});

	const name = `${ctx.skill.name}/allow/${file.path.toLowerCase()}`;
	const check = await github.createCheck(ctx, id, {
		sha: commit.sha,
		name,
		title: "Allowed Docker base image policy",
		body: `Checking Docker base images in \`${ctx.data.file.path}\` against configured allowlist`,
		reuse: true,
	});

	const result = await policy.result.pending(ctx, {
		sha: commit.sha,
		name,
		title: "Allowed Docker base image policy",
	});

	const fromLines = _.orderBy(file.lines, "number").filter(
		l => l.instruction === "FROM",
	);
	const maxLength = _.maxBy(fromLines, "number").number.toString().length;

	const errors = [];
	const annotations: Array<github.UpdateCheck["annotations"][0]> = [];

	for (const fromLine of fromLines) {
		// Check registry
		if (cfg.acceptRegistries?.length > 0) {
			if (!cfg.acceptRegistries.includes(fromLine.repository.host)) {
				errors.push(
					`${_.padStart(
						fromLine.number.toString(),
						maxLength,
					)}: FROM ${fromLine.argsString}`,
				);
				annotations.push({
					annotationLevel: "failure",
					path: file.path,
					startLine: fromLine.number,
					endLine: fromLine.number,
					message: `${fromLine.repository.host} is not an allowed Docker registry`,
					title: "Allowed Docker registry",
				});
			}
		}

		const imageName = `${
			fromLine.repository.host !== "hub.docker.com"
				? `${fromLine.repository.host}/${fromLine.repository.name}`
				: fromLine.repository.name
		}${fromLine.tag ? `:${fromLine.tag}` : ""}`;

		// Check image and tag
		if (cfg.acceptImages?.length > 0) {
			let allowed = false;
			for (const acceptImage of cfg.acceptImages) {
				const image = acceptImage.split(":")[0];
				const tag = acceptImage.split(":")[1];
				if (image === fromLine.repository.name) {
					if (!tag) {
						allowed = true;
						break;
					} else if (fromLine.tag === tag) {
						allowed = true;
					}
				}
			}

			if (!allowed) {
				errors.push(
					`${_.padStart(
						fromLine.number.toString(),
						maxLength,
					)}: FROM ${fromLine.argsString}`,
				);
				annotations.push({
					annotationLevel: "failure",
					path: file.path,
					startLine: fromLine.number,
					endLine: fromLine.number,
					message: `${imageName} is not an allowed Docker base image`,
					title: "Allowed Docker base image",
				});
			}
		}
	}

	if (errors.length === 0 && annotations.length === 0) {
		await check.update({
			conclusion: "success",
			body: `${await policy.badge.markdownLink({
				sha: commit.sha,
				workspace: ctx.workspaceId,
				name,
				title: "Allowed Docker base image policy",
				state: policy.result.ResultEntityState.Success,
			})}
			
All base images used in \`${ctx.data.file.path}\` are on configured allowlist`,
		});
		await result.success();
		return status.success(
			`All base images used in \`${ctx.data.file.path}\` are on allowlist`,
		);
	} else {
		await check.update({
			conclusion: "action_required",
			body: `${await policy.badge.markdownLink({
				sha: commit.sha,
				workspace: ctx.workspaceId,
				name,
				title: "Allowed Docker base image policy",
				state: policy.result.ResultEntityState.Failure,
				severity: policy.result.ResultEntitySeverity.High,
			})}
			
Following base images used in \`${
				ctx.data.file.path
			}\` violate configured allowlist

${errors
	.map(
		e => `\`\`\`
${e}
\`\`\``,
	)
	.join("\n\n")}`,
			annotations,
		});
		await result.failed(policy.result.ResultEntitySeverity.High);
		return status.success(
			`Detected not allowed base images used in \`${ctx.data.file.path}\``,
		);
	}
};
