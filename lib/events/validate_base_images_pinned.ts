import {
	EventHandler,
	github,
	policy,
	repository,
	status,
} from "@atomist/skill";
import * as _ from "lodash";

import { Configuration } from "../configuration";
import { ValidateBaseImages } from "../types";

export const handler: EventHandler<
	ValidateBaseImages,
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

	const unpinnedFromLines = _.orderBy(file.lines, "number")
		.filter(l => l.instruction === "FROM")
		.filter(l => !l.digest);

	if (unpinnedFromLines.length === 0) {
		await check.update({
			conclusion: "success",
			body: "All Docker base images are pinned",
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
FROM ${l.argsString}
\`\`\``,
	)
	.join("\n\n")}`,
			annotations: unpinnedFromLines.map(l => ({
				title: "Pinned base image",
				message: `${l.repository.name} is not pinned`,
				annotationLevel: "failure",
				startLine: l.number,
				endLine: l.number,
				path: file.path,
			})),
		});
		await result.success();
		return status.success(`Unpinned Docker base images detected`);
	}
};
