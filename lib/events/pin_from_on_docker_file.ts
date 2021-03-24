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

const Footer = `<!-- atomist:hide -->\nPinning \`FROM\` lines to digests makes your builds repeatable. Atomist will raise new pull requests whenever the tag moves, so that you know when the base image has been updated. You can follow a new tag at any time. Just replace the digest with the new tag you want to follow. Atomist, will switch to following this new tag.\n<!-- atomist:show -->`;

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
				tag: l.manifestList?.tags?.[0] || l.image?.tags?.[0],
				digest: l.digest,
			};
		});
	const changedFromLines = fromLines.filter(f => f.changed);
	const maxLength = _.maxBy(changedFromLines, "line").line.toString().length;

	const isRepin = !changedFromLines.some(f => !f.digest);

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
					? `${isRepin ? "Re-pin" : "Pin"} Docker base image in ${
							file.path
					  }`
					: `${isRepin ? "Re-pin" : "Pin"} Docker base images in ${
							file.path
					  }`,
			body:
				changedFromLines.length === 1
					? `This pull request ${
							isRepin ? "re-pins" : "pins"
					  } the Docker base image \`${
							changedFromLines[0].imageName.split("@")[0]
					  }\` in \`${file.path}\` to the current digest.

${fromLine(changedFromLines[0], maxLength, cfg.pinningIncludeTag)}

${Footer}`
					: `This pull request ${
							isRepin ? "re-pins" : "pins"
					  } the following Docker base images in \`${
							file.path
					  }\` to their current digests.
					
${changedFromLines
	.map(l => fromLine(l, maxLength, cfg.pinningIncludeTag))
	.join("\n\n")}

${Footer}`,
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
				const prefix = `${l.digest ? "Re-pin" : "Pin"} Docker image `;
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

function fromLine(
	l: { line: number; imageName: string; tag: string },
	maxLength: number,
	tagIncluded: boolean,
): string {
	const from = `${_.padStart(l.line.toString(), maxLength)}: FROM ${
		l.imageName
	}`;
	return `\`\`\`
${from}${
		!tagIncluded && l.tag
			? `\n${_.padStart("", from.split("@sha")[0].length)}\`--> ${l.tag}`
			: ""
	} 
\`\`\``;
}
