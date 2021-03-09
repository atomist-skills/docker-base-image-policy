import {
	EventContext,
	github,
	HandlerStatus,
	repository,
	subscription,
} from "@atomist/skill";
import * as fs from "fs-extra";

import { Configuration } from "./configuration";
import { replaceLastFrom } from "./util";

export async function pinFromInstruction(
	ctx: EventContext<any, Configuration>,
	commit: subscription.datalog.Commit,
	repo: subscription.datalog.DockerImage["repository"],
	digest: string,
	tag: string,
	path: string,
): Promise<HandlerStatus> {
	const cfg = ctx.configuration.parameters;

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

	const imageName = `${
		repo.host !== "hub.docker.com" ? `${repo.host}/${repo.name}` : repo.name
	}@${digest}`;

	const dockerfilePath = project.path(path);
	const dockerfile = (await fs.readFile(dockerfilePath)).toString();
	const replacedDockerfile = replaceLastFrom(dockerfile, imageName, tag);
	await fs.writeFile(dockerfilePath, replacedDockerfile);

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
			branch: `atomist/pin-docker-base-image`,
			assignReviewer: !!cfg.pinningAssignReviewers,
			reviewers: cfg.pinningAssignReviewers
				? [commit.author.login]
				: undefined,
			labels: cfg.pinningLabels,
			title: `Pin Docker base image to current digest`,
			body: `This pull request pins the Docker base image \`${
				imageName.split("@")[0]
			}\` in \`${path}\` to the current digest for tag \`${tag}\`.

\`\`\`
FROM ${imageName}
\`\`\``,
		},
		{
			message: `Pin Docker base image to current digest`,
		},
	);
}
