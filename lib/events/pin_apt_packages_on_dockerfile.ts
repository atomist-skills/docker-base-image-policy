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
	pluralize,
	project,
	repository,
	status,
} from "@atomist/skill";
import * as fs from "fs-extra";
import _ = require("lodash");

import { Configuration } from "../configuration";
import { pinAptPackagesToLatest } from "../package";
import { PinAptPackages } from "../types";

const Footer = `<!-- atomist:hide -->\nAtomist uses the APT package sources configured in the base image to determine latest available versions. Use a comment like \`# atomist:apt-source=deb https://deb.nodesource.com/node_14.x hirsute main\` to add additional APT sources. Disable pinning of packages by placing \`# atomist:apt-ignore\` as comment before a \`RUN\` instruction.\n<!-- atomist:show -->`;

export const handler: EventHandler<PinAptPackages, Configuration> =
	async ctx => {
		const cfg = ctx.configuration.parameters;
		const commit = ctx.data.commit;
		const file = ctx.data.file;

		if (!cfg.pinningAptPullRequests) {
			return status
				.success(`Pin apt packages policy not configured`)
				.hidden();
		}

		const fromLines = file.lines.filter(l => l.instruction === "FROM");
		const aptFromLines = fromLines.filter(fl => {
			if (fl.image?.packageManager?.type === "APT") {
				return true;
			} else if (
				fl.manifestList?.images?.some(
					i => i.packageManager?.type === "APT",
				)
			) {
				return true;
			}
			return false;
		});
		if (
			!aptFromLines.some(
				fl =>
					fl.image?.packageManager?.sources?.length > 0 ||
					fl.manifestList?.images?.some(
						i => i.packageManager?.sources?.length > 0,
					),
			)
		) {
			return status.success(`No apt sources detected`).hidden();
		}

		const project = await ctx.project.clone(
			repository.gitHub({
				owner: commit.repo.org.name,
				repo: commit.repo.name,
				// sha: commit.sha,
				credential: {
					token: commit.repo.org.installationToken,
					scopes: [],
				},
			}),
		);

		const allChanges = [];
		return github.persistChanges(
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
				branch: `atomist/pin-apt-packages/${file.path.toLowerCase()}`,
				assignReviewer: !!cfg.pinningAssignReviewers,
				reviewers: cfg.pinningAssignReviewers
					? [commit.author.login]
					: undefined,
				labels: cfg.pinningLabels,
				title: "Pin APT packages",
				body: `This pull requests pins APT packages`,
				update: async () => {
					return {
						body: `This pull request pins ${pluralize(
							"APT package",
							allChanges,
							{ include: true, includeOne: false },
						)} to the latest available version.
						
${allChanges.map(c => ` * \`${c.name}\` > \`${c.version}\``).join("\n")}

${Footer}`,
					};
				},
			},
			{
				editors: aptFromLines.map(fl => async (p: project.Project) => {
					const sources = _.uniq([
						...(fl.image.packageManager?.sources || []),
						_.flattenDeep(
							fl.manifestList?.images?.map(
								i => i.packageManager?.sources || [],
							),
						),
					]) as string[];
					if (sources.length === 0) {
						return undefined;
					}
					const arch = architecture(fl);
					const dockerfilePath = p.path(file.path);
					const dockerfile = (
						await fs.readFile(dockerfilePath)
					).toString();
					const layer = fromLines.indexOf(fl);
					const pinnngResult = await pinAptPackagesToLatest(
						layer,
						dockerfile,
						sources,
						arch,
					);
					if (pinnngResult.changes.length > 0) {
						await fs.writeFile(
							dockerfilePath,
							pinnngResult.dockerfile,
						);
						allChanges.push(...pinnngResult.changes);
						return `Pin APT ${pluralize(
							"package",
							pinnngResult.changes,
							{ include: false, includeOne: false },
						)}

${pinnngResult.changes.map(c => `${c.name} > ${c.version}`)}`;
					} else {
						return undefined;
					}
				}),
			},
		);
	};

function architecture(fromLine: PinAptPackages["file"]["lines"][0]): string {
	if (fromLine.image?.platform?.[0]?.architecture) {
		return fromLine.image?.platform?.[0]?.architecture;
	} else if (fromLine.manifestList?.images?.length > 0) {
		const imagesWithArch = fromLine.manifestList.images.filter(
			i => i.platform?.[0]?.architecture,
		);
		if (
			imagesWithArch.some(i => i.platform?.[0]?.architecture === "amd64")
		) {
			return "amd64";
		} else {
			return imagesWithArch.find(i => i.platform?.[0]?.architecture)
				.platform?.[0]?.architecture;
		}
	}
	return undefined;
}
