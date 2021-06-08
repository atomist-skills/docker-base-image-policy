import { Contextual, datalog, EventHandler } from "@atomist/skill";
import * as _ from "lodash";

import { Configuration } from "../configuration";
import { TransactSupportedTags } from "../types";

export const handler: EventHandler<TransactSupportedTags, Configuration> =
	async ctx => {
		const name = ctx.data.name;
		const tags = await supportedTags(name, ctx);
		await ctx.datalog.transact([
			datalog.entity("docker/repository", {
				host: ctx.data.host,
				repository: ctx.data.name,
				supportedTags: {
					set: tags,
				},
			}),
		]);
	};

async function supportedTags(
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
