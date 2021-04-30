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
	handler as h,
	pluralize,
	project,
	repository,
	status,
	truncate,
} from "@atomist/skill";
import { sourceLocationFromOffset } from "@atomist/skill/lib/util";
import * as fs from "fs-extra";
import * as _ from "lodash";

import { Configuration } from "../configuration";
import { UpdateFrom } from "../types";
import { linkFile } from "../util";
import { CreateRepositoryIdFromCommit } from "./shared";

export const handler: EventHandler = h.chain<
	UpdateFrom,
	Configuration,
	{ project: project.Project; id: repository.AuthenticatedRepositoryId<any> }
>(h.createRef(CreateRepositoryIdFromCommit), h.cloneRef(), async ctx => {
	const project = ctx.chain.project;
	const commit = ctx.data.commit;
	const update = ctx.data.update;

	// Remove action from checkrun
	const api = github.api(ctx.chain.id);
	await api.checks.update({
		owner: commit.repo.org.name,
		repo: commit.repo.name,
		check_run_id: +ctx.data.checkrun.sourceId,
		actions: [],
	});

	// Group edits by path
	const editsByPath = _.groupBy(update.edits, "path");

	for (const path of Object.keys(editsByPath)) {
		const edits = editsByPath[path];

		await github.persistChanges(
			ctx,
			project,
			"pr",
			{
				branch: commit.refs?.[0]?.name,
				defaultBranch: commit.repo.defaultBranch,
				author: {
					login: undefined,
					name: undefined,
					email: undefined,
				},
			},
			{
				branch: `atomist/docker-base-image-tag/${path.toLowerCase()}`,
				title: `Update ${pluralize(
					"Docker base image tag",
					edits,
				)} in ${path}`,
				body: `This pull request updates ${pluralize(
					"Docker base image tag",
					edits,
					{ include: true, includeOne: true },
				)} in ${linkFile(path, commit)}.`,
				update: async () => {
					// Collect all the replaced FROM lines
					const dockerfile = (
						await fs.readFile(project.path(path))
					).toString();
					const matches: RegExpExecArray[] = [];

					for (const edit of edits) {
						const regexp = new RegExp(
							`^FROM\\s*${edit.to}.*$`,
							"gmi",
						);
						let match;
						do {
							match = regexp.exec(dockerfile);
							if (match) {
								matches.push(match);
							}
						} while (match);
					}
					return {
						body: `This pull request updates ${pluralize(
							"Docker base image tag",
							edits,
							{ include: true, includeOne: true },
						)} in ${linkFile(path, commit)}.
${matches
	.map(
		m => ` 			
\`\`\`
${sourceLocationFromOffset(m[0], m.index, m.input).startLine}: ${m[0]}
\`\`\``,
	)
	.join("\n\n")}`,
					};
				},
			},
			{
				editors: edits.map(e => async () => {
					const dockerfile = (
						await fs.readFile(project.path(e.path))
					).toString();

					// Extract image:tag@digest
					const imageNameMatch = /^\s*([\S]*).*$/.exec(e.from);
					const imageName = imageNameMatch[1];

					// Replace the content
					const newDockerfile = dockerfile.replace(
						new RegExp(`^FROM\\s*${imageName}`, "gmi"),
						`FROM ${e.to}`,
					);

					await fs.writeFile(project.path(e.path), newDockerfile);
					return `Update to ${truncate(
						e.to,
						50 - "Update to".length,
						{
							direction: "start",
							separator: "...",
						},
					)}`;
				}),
			},
		);
	}
	return status.success(
		`Updated ${pluralize("Docker image tag", update.edits)}`,
	);
});
