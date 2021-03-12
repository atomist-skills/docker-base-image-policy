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
import { CommitAndDockerfile } from "../types";

export const handler: EventHandler<
	CommitAndDockerfile,
	Configuration
> = async ctx => {
	const cfg = ctx.configuration.parameters;

	if (!cfg.pinningRequired) {
		return status
			.success(`Pinned base image policy not configured`)
			.hidden();
	}

	const commit = ctx.data.commit;
	const file = ctx.data.file;

	const id = repository.gitHub({
		owner: commit.repo.org.name,
		repo: commit.repo.name,
		credential: { token: commit.repo.org.installationToken, scopes: [] },
	});

	const check = await github.createCheck(ctx, id, {
		sha: commit.sha,
		name: `${ctx.skill.name}/pinned`,
		title: "Pinned Docker base images",
		body: `Checking if Docker base images are pinned`,
		reuse: true,
	});

	const result = await policy.result.pending(ctx, {
		sha: commit.sha,
		name: `${ctx.skill.name}/pinned`,
	});

	const fromLines = _.orderBy(file.lines, "number").filter(
		l => l.instruction === "FROM",
	);
	const unpinnedFromLines = fromLines.filter(l => !l.digest);
	const pinnedFromLines = fromLines
		.filter(l => l.digest)
		.filter(l => !l.tag)
		.filter(
			l => l.manifestList?.tags?.length > 0 || l.image?.tags?.length > 0,
		);
	const maxLength = _.maxBy(fromLines, "number").number.toString().length;

	const pinnedFromLinesBody = pinnedFromLines
		.map(l => {
			const from = `${_.padStart(l.number.toString(), maxLength)}: FROM ${
				l.argsString
			}`;
			return `
\`\`\`
${from}
${_.padStart(" ", from.split(":sha")[0].length)}\`--> ${
				l.manifestList?.tags?.[0] || l.image?.tags?.[0]
			} 
\`\`\``;
		})
		.join("\n\n");

	if (unpinnedFromLines.length === 0) {
		await check.update({
			conclusion: "success",
			body: `All Docker base images are pinned as required

${pinnedFromLinesBody}			
			`,
		});
		await result.success();
		return status.success(`All Docker base images are pinned`);
	} else {
		await check.update({
			conclusion: "action_required",
			body: `The following Docker base images are not pinned as required

${unpinnedFromLines
	.map(
		l => `
\`\`\`
${_.padStart(l.number.toString(), maxLength)}: FROM ${l.argsString}
\`\`\``,
	)
	.join("\n\n")}${
				pinnedFromLines.length > 0
					? `

---

The following Docker base images are pinned

${pinnedFromLinesBody}`
					: ""
			}`,
			annotations: unpinnedFromLines.map(l => ({
				title: "Pinned base image",
				message: `${l.repository.name} is not pinned`,
				annotationLevel: "failure",
				startLine: l.number,
				endLine: l.number,
				path: file.path,
			})),
		});
		await result.failed();
		return status.success(`Unpinned Docker base images detected`);
	}
};
