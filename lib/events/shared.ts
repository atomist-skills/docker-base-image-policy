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
	handler,
	HandlerStatus,
	status,
	subscription,
} from "@atomist/skill";

import { Configuration } from "../configuration";
import { ValidateBaseImages } from "../types";

export const DockerfilesTransacted: (
	ctx: EventContext<ValidateBaseImages, Configuration>,
) => HandlerStatus | undefined = ctx => {
	const files = ctx.data.commit.files.filter(f => /Dockerfile/.test(f.path))
		.length;
	const dockerFiles = ctx.data.commit.dockerFiles.length;
	if (files !== dockerFiles) {
		return status
			.success("Waiting for all Dockerfiles to be parsed")
			.hidden() as HandlerStatus;
	}
	return undefined;
};

export const CreateRepositoryIdFromCommit: handler.CreateRepositoryId<
	{
		commit: {
			sha: string;
			repo: {
				name: string;
				org: { name: string; installationToken: string };
			};
		};
	},
	Configuration
> = ctx => ({
	sha: ctx.data.commit.sha,
	owner: ctx.data.commit.repo.org.name,
	repo: ctx.data.commit.repo.name,
	credential: {
		token: ctx.data.commit.repo.org.installationToken,
		scopes: [],
	},
});

export function findTag(
	ctx: EventContext<ValidateBaseImages, Configuration>,
	repository: subscription.datalog.DockerImage["repository"],
	digest: string,
): string {
	const image = ctx.data.image?.find(i => i.digest === digest);
	if (image) {
		return image.tags?.join(", ");
	}
	const manifestList = ctx.data.manifestList?.find(m => m.digest === digest);
	if (manifestList) {
		return manifestList.tags?.join(", ");
	}
	return undefined;
}
