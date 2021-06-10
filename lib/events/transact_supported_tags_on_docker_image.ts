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

import { Contextual, datalog, EventHandler } from "@atomist/skill";
import * as _ from "lodash";

import { Configuration } from "../configuration";
import { TransactSupportedTags } from "../types";

export const handler: EventHandler<TransactSupportedTags, Configuration> =
	async ctx => {
		const name = ctx.data.repository.name;
		const tags = await supportedTags(name, ctx);
		await ctx.datalog.transact([
			datalog.entity("docker/repository", {
				host: ctx.data.repository.host,
				repository: ctx.data.repository.name,
				supportedTags: {
					set: tags,
				},
			}),
		]);
	};

const supportedTags = _.memoize(_supportedTags);

async function _supportedTags(
	name: string,
	ctx: Contextual<any, any>,
): Promise<string[]> {
	const libraryFile = await (
		await ctx.http.request(
			`https://raw.githubusercontent.com/docker-library/docs/master/${name}/README.md`,
			{ method: "GET" },
		)
	).text();

	const tagRegexp = /`([^,`]*)`/gm;
	const tagsText =
		/# Supported tags and respective `Dockerfile` links([\s\S]*?)# Quick reference/gm.exec(
			libraryFile,
		);
	const tags = [];
	let match: RegExpExecArray;
	do {
		match = tagRegexp.exec(tagsText[1]);
		if (match) {
			tags.push(match[1]);
		}
	} while (match);

	return _.uniq(tags);
}
