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
	EventHandler,
	github,
	HandlerStatus,
	policy,
	repository,
	secret,
} from "@atomist/skill";

export function policyHandler<S, C>(parameters: {
	condition?: (ctx: EventContext<S, C>) => Promise<HandlerStatus | undefined>;
	id: (
		ctx: EventContext<S, C>,
	) => Promise<
		repository.AuthenticatedRepositoryId<
			secret.GitHubCredential | secret.GitHubAppCredential
		>
	>;
	setup: (
		ctx: EventContext<S, C>,
	) => Promise<{
		name: string;
		title: string;
		body: string;
	}>;
	execute: (
		ctx: EventContext<S, C>,
		options: {
			setup: {
				name: string;
				title: string;
				body: string;
			};
			check: github.Check;
			policy: policy.result.PolicyRun;
		},
	) => Promise<{
		state: policy.result.ResultEntityState;
		severity?: policy.result.ResultEntitySeverity;
		message?: string;
		body?: string;
		annotations?: github.UpdateCheck["annotations"];
		status: HandlerStatus;
	}>;
}): EventHandler<S, C> {
	return async ctx => {
		if (parameters.condition) {
			const result = await parameters.condition(ctx);
			if (result) {
				return result;
			}
		}

		const id = await parameters.id(ctx);
		const setup = await parameters.setup(ctx);

		const check = await github.createCheck(ctx, id, {
			sha: id.sha,
			name: setup.name,
			title: setup.title,
			body: setup.body,
			reuse: true,
		});

		const result = await policy.result.pending(ctx, {
			sha: id.sha,
			name: setup.name,
			title: setup.title,
		});

		const executeResult = await parameters.execute(ctx, {
			setup,
			policy: result,
			check,
		});

		let conclusion;
		switch (executeResult.state) {
			case policy.result.ResultEntityState.Success:
				conclusion = "success";
				break;
			case policy.result.ResultEntityState.Failure:
				conclusion = "action_required";
				break;
			case policy.result.ResultEntityState.Neutral:
				conclusion = "neutral";
				break;
		}

		const body = `${await policy.badge.markdownLink({
			sha: id.sha,
			workspace: ctx.workspaceId,
			name: setup.name,
			title: setup.title,
			state: executeResult.state,
			severity: executeResult.severity,
		})}${executeResult.body ? `\n\n${executeResult.body}` : ""}`;

		await check.update({
			conclusion,
			body,
			annotations: executeResult.annotations,
		});
		switch (executeResult.state) {
			case policy.result.ResultEntityState.Success:
				await result.success(executeResult.body);
				break;
			case policy.result.ResultEntityState.Failure:
				await result.failed(executeResult.severity, executeResult.body);
				break;
			case policy.result.ResultEntityState.Neutral:
				await result.neutral(executeResult.body);
				break;
		}

		return executeResult.status;
	};
}
