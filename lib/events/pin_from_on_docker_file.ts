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
	project,
	repository,
	status,
	truncate,
} from "@atomist/skill";
import * as fs from "fs-extra";
import * as _ from "lodash";

import { Configuration } from "../configuration";
import { CommitAndDockerfile } from "../types";
import { replaceFroms } from "../util";

export const handler: EventHandler<
	CommitAndDockerfile,
	Configuration
> = async ctx => {
	const cfg = ctx.configuration.parameters;
	const commit = ctx.data.commit;
	const file = ctx.data.file;

	if (!cfg.pinningPullRequests) {
		return status.success(`Pin base image policy not configured`).hidden();
	}

	const project = await ctx.project.clone(
		repository.gitHub({
			owner: commit.repo.org.name,
			repo: commit.repo.name,
			credential: {
				token: commit.repo.org.installationToken,
				scopes: [],
			},
		}),
	);

	const fromLines = _.orderBy(file.lines, "number")
		.filter(l => l.instruction === "FROM")
		.map(l => {
			const digest =
				l.manifestList?.digest || l.image?.digest || l.digest;
			const tag = cfg.pinningIncludeTag && l.tag ? `:${l.tag}` : "";
			const imageName = `${
				l.repository.host !== "hub.docker.com"
					? `${l.repository.host}/${l.repository.name}`
					: l.repository.name
			}${tag}@${digest}`;
			return {
				line: l.number,
				currentImageName: l.argsString.split(" ")[0],
				imageName,
				changed: l.digest !== l.manifestList?.digest || l.image?.digest,
			};
		});
	const changedFromLines = fromLines.filter(f => f.changed);
	const maxLength = _.maxBy(changedFromLines, "line").line.toString().length;

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
			branch: `atomist/pin-docker-base-image/${file.path.toLowerCase()}`,
			assignReviewer: !!cfg.pinningAssignReviewers,
			reviewers: cfg.pinningAssignReviewers
				? [commit.author.login]
				: undefined,
			labels: cfg.pinningLabels,
			title:
				changedFromLines.length === 1
					? `Pin Docker base image in ${file.path}`
					: `Pin Docker base images in ${file.path}`,
			body:
				changedFromLines.length === 1
					? `This pull request pins the Docker base image \`${
							changedFromLines[0].imageName.split("@")[0]
					  }\` in \`${file.path}\` to the current digest.

\`\`\`
${_.padStart(changedFromLines[0].line.toString(), maxLength)}: FROM ${
							changedFromLines[0].imageName
					  }
\`\`\``
					: `This pull request pins the following Docker base images in \`${
							file.path
					  }\` to their current digests.
					
${changedFromLines
	.map(
		l => `\`\`\`
${_.padStart(l.line.toString(), maxLength)}: FROM ${l.imageName}
\`\`\``,
	)
	.join("\n\n")}`,
		},
		{
			editors: fromLines.map((l, ix) => async (p: project.Project) => {
				const dockerfilePath = p.path(file.path);
				const dockerfile = (
					await fs.readFile(dockerfilePath)
				).toString();
				const replacedDockerfile = replaceFroms(
					dockerfile,
					fromLines.map(l => l.imageName),
					ix,
				);
				await fs.writeFile(dockerfilePath, replacedDockerfile);
				const prefix = "Pin Docker image ";
				return `${prefix}${truncate(
					l.imageName.split("@")[0],
					50 - prefix.length,
					{ direction: "start", separator: "..." },
				)}

${l.currentImageName}
-> 
${l.imageName}`;
			}),
		},
	);
};
