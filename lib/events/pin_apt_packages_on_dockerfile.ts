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

import { pluralize, policy, status } from "@atomist/skill";
import * as _ from "lodash";

import { Configuration } from "../configuration";
import { pinAptPackagesToLatest } from "../package";
import { PinAptPackages } from "../types";
import { linkFile } from "../util";
import { CreateRepositoryIdFromCommit } from "./shared";

const Footer = `<!-- atomist:hide -->\nAtomist uses the APT package sources configured in the base image to determine latest available versions. Use a comment like \`# atomist:apt-source=deb https://deb.nodesource.com/node_14.x hirsute main\` to add additional APT sources. Disable pinning of packages by placing \`# atomist:apt-ignore\` as comment before a \`RUN\` instruction.\n<!-- atomist:show -->`;

export const handler = policy.pullRequestHandler<
	PinAptPackages,
	Configuration,
	{ name: string; version: string }
>({
	when: ctx => {
		if (!ctx.configuration.parameters.pinningAptPullRequests) {
			return status
				.success(`Pin apt packages policy not configured`)
				.hidden();
		}
		return undefined;
	},
	id: CreateRepositoryIdFromCommit,
	execute: async ctx => {
		const cfg = ctx.configuration.parameters;
		const commit = ctx.data.commit;
		const file = ctx.data.file;

		const fromLines = _.sortBy(
			file.lines.filter(l => l.instruction === "FROM"),
			"number",
		);
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
			// return status.success(`No apt sources detected`).hidden();
		}

		return {
			commit: {
				editors: aptFromLines.map(fl => async (read, write) => {
					const sources = _.uniq([
						...(fl.image?.packageManager?.sources || []),
						..._.flattenDeep(
							fl.manifestList?.images?.map(
								i => i.packageManager?.sources || [],
							),
						),
					]) as string[];
					if (sources.length === 0) {
						return undefined;
					}
					const arch = architecture(fl);
					const dockerfile = await read(file.path);
					const layer = fromLines.indexOf(fl);
					const pinnngResult = await pinAptPackagesToLatest(
						layer,
						dockerfile.content,
						sources,
						arch,
					);
					if (pinnngResult.changes.length > 0) {
						write(file.path, pinnngResult.dockerfile);
						return {
							commit: {
								message: `Pin APT ${pluralize(
									"package",
									pinnngResult.changes,
									{ include: false, includeOne: false },
								)}

${pinnngResult.changes.map(c => `${c.name} > ${c.version}`).join("\n")}`,
							},
							detail: pinnngResult.changes,
						};
					} else {
						return undefined;
					}
				}),
				branch: `atomist/pin-apt-packages/${file.path.toLowerCase()}`,
			},
			pullRequest: async (ctx, changes) => {
				return {
					assignReviewer: !!cfg.pinningAssignReviewers,
					reviewers: cfg.pinningAssignReviewers
						? [commit.author.login]
						: undefined,
					labels: cfg.pinningLabels,
					title: `Pin ${pluralize("APT package", changes, {
						include: true,
						includeOne: false,
					})}`,
					body: `This pull request pins ${pluralize(
						"APT package",
						changes,
						{ include: true, includeOne: false },
					)} in ${linkFile(
						file.path,
						commit,
					)} to the latest available version.
						
${_.sortBy(changes, "name")
	.map(c => ` * \`${c.name}\` > \`${c.version}\``)
	.join("\n")}

${Footer}`,
				};
			},
		};
	},
});

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
