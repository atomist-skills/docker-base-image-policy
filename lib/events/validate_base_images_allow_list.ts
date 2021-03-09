import {
	EventHandler,
	github,
	policy,
	repository,
	status,
} from "@atomist/skill";

import { Configuration } from "../configuration";
import { ValidateBaseImages } from "../types";

export const handler: EventHandler<
	ValidateBaseImages,
	Configuration
> = async ctx => {
	const cfg = ctx.configuration.parameters;

	if (!(cfg.acceptRegistries?.length > 0 || cfg.acceptImages?.length > 0)) {
		return status
			.success(`Allow-list base image policy not configured`)
			.hidden();
	}

	const commit = ctx.data.commit;

	const id = repository.gitHub({
		owner: commit.repo.org.name,
		repo: commit.repo.name,
		credential: { token: commit.repo.org.installationToken, scopes: [] },
	});

	const check = await github.createCheck(ctx, id, {
		sha: commit.sha,
		name: `${ctx.skill.name}/allow-list`,
		title: "Allowed Docker base image",
		body: `Checking Docker base image against configured allow-list`,
		reuse: true,
	});

	const result = await policy.result.pending(ctx, {
		sha: commit.sha,
		name: `${ctx.skill.name}/allow-list`,
	});

	const file = ctx.data.file;
	const repositoryLabel = file.lines?.find(l => l.repository);
	const tagLabel = file.lines?.find(
		l =>
			l.instruction === "LABEL" &&
			l.argsMap[0][0] === "com.atomist.follow-tag",
	)?.argsMap[0][1];
	const imageName = `${repositoryLabel.repository.name}:${
		repositoryLabel.tag
			? repositoryLabel.tag
			: tagLabel
			? tagLabel
			: "latest"
	}`;

	// Check registry
	if (cfg.acceptRegistries?.length > 0 && repositoryLabel) {
		if (!cfg.acceptRegistries.includes(repositoryLabel.repository.host)) {
			// Set check
			await check.update({
				conclusion: "action_required",
				body: `Used \`${repositoryLabel.repository.host}\` is not an allowed Docker registry`,
				annotations: [
					{
						annotationLevel: "failure",
						path: file.path,
						startLine: repositoryLabel.number,
						endLine: repositoryLabel.number,
						message: `${repositoryLabel.repository.host} is not an allowed Docker registry`,
						title: "Allowed Docker base image",
					},
				],
			});
			await result.failed();
			return status.success(
				`\`${repositoryLabel.repository.host}\` is not an allowed Docker registry`,
			);
		}
	}

	// Check image and tag
	if (cfg.acceptImages?.length > 0 && repositoryLabel) {
		let allowed = false;
		for (const acceptImage of cfg.acceptImages) {
			const image = acceptImage.split(":")[0];
			const tag = acceptImage.split(":")[1];
			if (image === repositoryLabel.repository.name) {
				if (!tag) {
					allowed = true;
					break;
				} else if (repositoryLabel.tag === tag) {
					allowed = true;
				} else if (tagLabel === tag) {
					allowed = true;
				}
			}
		}

		if (!allowed) {
			await check.update({
				conclusion: "action_required",
				body: `Used image \`${imageName}\` is not an allowed Docker base image`,
				annotations: [
					{
						annotationLevel: "failure",
						path: file.path,
						startLine: repositoryLabel.number,
						endLine: repositoryLabel.number,
						message: `${imageName} is not an allowed Docker base image`,
						title: "Allowed Docker base image",
					},
				],
			});
			await result.failed();
			return status.success(
				`\`${imageName}\` is not an allowed Docker base image`,
			);
		}
	}

	await check.update({
		conclusion: "success",
		body: `Used image \`${imageName}\` is an allowed Docker base image`,
	});
	await result.success();
	return status.success(`\`${imageName}\` is an allowed Docker base image`);
};
