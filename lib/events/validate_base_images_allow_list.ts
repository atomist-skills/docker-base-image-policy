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

import { github, policy, status } from "@atomist/skill";
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
		name: `${ctx.skill.name}/allow`,
		title: "Allowed Docker base image policy",
		body: `Checking Docker base images in ${ctx.data.commit.files
			.map(f => `\`${f.path}\``)
			.join(", ")} against configured allowlist`,
	}),
	execute: async ctx => {
		const cfg = ctx.configuration.parameters;
		const commit = ctx.data.commit;

		const errors: Array<{ path: string; error: string }> = [];
		const annotations: Array<github.UpdateCheck["annotations"][0]> = [];

		for (const file of ctx.data.commit.files) {
			const fromLines = _.orderBy(file.lines, "number").filter(
				l => l.instruction === "FROM",
			);
			const maxLength = _.maxBy(fromLines, "number").number.toString()
				.length;

			for (const fromLine of fromLines) {
				// Check registry
				if (cfg.acceptRegistries?.length > 0) {
					if (
						!cfg.acceptRegistries.includes(fromLine.repository.host)
					) {
						errors.push({
							path: file.path,
							error: `${_.padStart(
								fromLine.number.toString(),
								maxLength,
							)}: FROM ${fromLine.argsString}`,
						});
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
						errors.push({
							path: file.path,
							error: `${_.padStart(
								fromLine.number.toString(),
								maxLength,
							)}: FROM ${fromLine.argsString}`,
						});
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
		}
		if (errors.length === 0 && annotations.length === 0) {
			return {
				state: policy.result.ResultEntityState.Success,
				status: status.success(
					`All base images used on allowlist in \`${
						commit.repo.org.name
					}/${commit.repo.name}@${commit.sha.slice(0, 7)}\``,
				),
				body: `All base images used in ${ctx.data.commit.files
					.map(f => `\`${f.path}\``)
					.join(", ")} are on configured allowlist`,
			};
		} else {
			const errorsByFile = _.groupBy(errors, "path");
			const body = `Following base images used violate configured allowlist:

${_.map(
	errorsByFile,
	(v, k) => `\`${k}\`

${v
	.map(
		e => `\`\`\`
${e}
\`\`\``,
	)
	.join("\n\n")}`,
).join("\n\n---\n\n")}`;

			return {
				state: policy.result.ResultEntityState.Failure,
				severity: policy.result.ResultEntitySeverity.High,
				status: status.success(
					`Detected not allowed base images in \`${
						commit.repo.org.name
					}/${commit.repo.name}@${commit.sha.slice(0, 7)}\``,
				),
				body,
				annotations,
			};
		}
	},
});
