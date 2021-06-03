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
	EventContext,
	github,
	handle,
	handleError,
	log,
	MappingEventHandler,
	project,
	repository,
	status,
	subscription,
	truncate,
} from "@atomist/skill";
import * as fs from "fs-extra";
import * as _ from "lodash";

import { changelog } from "../changelog";
import { Configuration } from "../configuration";
import { CommitAndDockerfile } from "../types";
import { addStartLineNo, replaceFroms } from "../util";

const Footer = `<!-- atomist:hide -->\nPinning \`FROM\` lines to digests makes your builds repeatable. Atomist will raise new pull requests whenever the tag moves, so that you know when the base image has been updated. You can follow a new tag at any time. Just replace the digest with the new tag you want to follow. Atomist, will switch to following this new tag.\n<!-- atomist:show -->`;

export const handler: MappingEventHandler<
	CommitAndDockerfile[],
	CommitAndDockerfile & {
		registry: subscription.datalog.DockerRegistry;
		image: CommitAndDockerfile["image"][0];
		manifestList: CommitAndDockerfile["manifestList"][0];
	},
	Configuration
> = {
	map: data => {
		const result: Map<string, CommitAndDockerfile> = new Map();
		for (const event of data) {
			if (result.has(event.commit.sha)) {
				if (event.registry) {
					result.get(event.commit.sha).registry.push(event.registry);
				}
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
					file: event.file,
					commit: event.commit,
					registry: event.registry ? [event.registry] : [],
					image: event.image ? [event.image] : [],
					manifestList: event.manifestList
						? [event.manifestList]
						: [],
				});
			}
		}
		return [...result.values()].map(r => ({
			file: r.file,
			commit: r.commit,
			registry: _.uniqBy(r.registry, "id"),
			image: _.uniqBy(r.image, "id"),
			manifestList: _.uniqBy(r.manifestList, "id"),
		}));
	},
	handle: handle.wrapEventHandler(
		async (ctx: EventContext<CommitAndDockerfile, Configuration>) => {
			const cfg = ctx.configuration.parameters;
			const commit = ctx.data.commit;
			const file = ctx.data.file;

			if (!cfg.pinningPullRequests) {
				return status
					.success(`Pin base image policy not configured`)
					.hidden();
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

			addStartLineNo(
				file.lines,
				(await fs.readFile(project.path(file.path))).toString(),
			);

			const fromLines = _.orderBy(file.lines, "number")
				.filter(l => l.instruction === "FROM")
				.map(l => {
					const digest =
						l.manifestList?.digest || l.image?.digest || l.digest;
					const tag = l.tag ? `:${l.tag}` : "";
					const imageName = `${
						l.repository.host !== "hub.docker.com"
							? `${l.repository.host}/${l.repository.name}`
							: l.repository.name
					}${tag}@${digest}`;
					return {
						line: l.number,
						startLine: l.startNumber,
						currentImageName: l.argsString.split(" ")[0],
						imageName,
						changed: l.digest !== digest,
						tag: l.manifestList?.tags?.[0] || l.image?.tags?.[0],
						digest: l.digest,
						changelog: undefined,
					};
				});
			const changedFromLines = fromLines.filter(f => f.changed);

			for (const changedFromLine of _.orderBy(
				file.lines,
				"number",
			).filter(l => l.instruction === "FROM")) {
				const cfl = changedFromLines.find(
					c => c.line === changedFromLine.number,
				);
				if (cfl) {
					cfl.changelog = await handleError(async () =>
						changelog(
							ctx,
							project,
							changedFromLine,
							ctx.data.registry,
							ctx.data.image,
							ctx.data.manifestList,
							true,
						),
					);
				}
			}
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
							? `${
									isRepin ? "Re-pin" : "Pin"
							  } Docker base image in ${file.path}`
							: `${
									isRepin ? "Re-pin" : "Pin"
							  } Docker base images in ${file.path}`,
					body:
						changedFromLines.length === 1
							? `This pull request ${
									isRepin ? "re-pins" : "pins"
							  } the Docker base image \`${
									changedFromLines[0].imageName.split("@")[0]
							  }\` in \`${file.path}\` to the current digest.

${fromLine(changedFromLines[0], commit, file)}

${Footer}`
							: `This pull request ${
									isRepin ? "re-pins" : "pins"
							  } the following Docker base images in \`${
									file.path
							  }\` to their current digests.
					
${changedFromLines.map(l => fromLine(l, commit, file)).join("\n\n")}

${Footer}`,
					update: async () => {
						for (const changedFromLine of _.orderBy(
							file.lines,
							"number",
						).filter(l => l.instruction === "FROM")) {
							const cfl = changedFromLines.find(
								c => c.line === changedFromLine.number,
							);
							if (cfl) {
								cfl.changelog = await handleError(async () => {
									log.info(
										"Compiling changelog for FROM line '%s'",
										changedFromLine.argsString,
									);
									return changelog(
										ctx,
										project,
										changedFromLine,
										ctx.data.registry,
										ctx.data.image,
										ctx.data.manifestList,
										false,
									);
								});
							}
						}
						return {
							body:
								changedFromLines.length === 1
									? `This pull request ${
											isRepin ? "re-pins" : "pins"
									  } the Docker base image \`${
											changedFromLines[0].imageName.split(
												"@",
											)[0]
									  }\` in \`${
											file.path
									  }\` to the current digest.

${fromLine(changedFromLines[0], commit, file)}

${Footer}`
									: `This pull request ${
											isRepin ? "re-pins" : "pins"
									  } the following Docker base images in \`${
											file.path
									  }\` to their current digests.
					
${changedFromLines.map(l => fromLine(l, commit, file)).join("\n\n")}

${Footer}`,
						};
					},
				},
				{
					editors: fromLines.map(
						(l, ix) => async (p: project.Project) => {
							log.info("Editing Dockerfile '%s'", file.path);
							const dockerfilePath = p.path(file.path);
							const dockerfile = (
								await fs.readFile(dockerfilePath)
							).toString();
							const replacedDockerfile = replaceFroms(
								dockerfile,
								fromLines.map(l => l.imageName),
								ix,
							);
							await fs.writeFile(
								dockerfilePath,
								replacedDockerfile,
							);
							const prefix = `${
								l.digest ? "Re-pin" : "Pin"
							} Docker image `;
							return `${prefix}${truncate(
								l.imageName.split("@")[0],
								50 - prefix.length,
								{ direction: "start", separator: "..." },
							)}

${l.currentImageName}
-> 
${l.imageName}`;
						},
					),
				},
			);
		},
	),
};

function fromLine(
	l: {
		line: number;
		startLine: number;
		imageName: string;
		tag: string;
		changelog: string;
	},
	commit: CommitAndDockerfile["commit"],
	file: CommitAndDockerfile["file"],
): string {
	return `https://github.com/${commit.repo.org.name}/${
		commit.repo.name
	}/blob/${commit.sha}/${file.path}#L${l.startLine}-L${l.line}${
		l.changelog ? `\n\n${l.changelog}` : ""
	}`;
}
