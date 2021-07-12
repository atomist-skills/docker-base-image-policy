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

import { Contextual, subscription, tmpFs } from "@atomist/skill";
import * as os from "os";
import * as path from "path";

import { ExtendedDockerRegistry } from "./types";

export async function auth(
	ctx: Contextual<any, any>,
	registries: ExtendedDockerRegistry[],
): Promise<void> {
	const dockerConfig = {
		auths: {},
	} as any;
	if (registries?.length > 0) {
		for (const registry of registries.filter(r => !!r)) {
			const url = registry.serverUrl.split("/");
			switch (registry.type) {
				case subscription.datalog.DockerRegistryType.Gcr:
					if (registry.serviceAccount) {
						const token = await getOAuthAccessToken(
							registry.serviceAccount,
							ctx,
						);
						dockerConfig.auths[url[0]] = {
							auth: Buffer.from(
								"oauth2accesstoken:" + token,
							)?.toString("base64"),
						};
					} else {
						dockerConfig.auths[url[0]] = {
							auth: Buffer.from(
								"_json_key:" + registry.secret,
							)?.toString("base64"),
						};
					}
					break;
				default:
					if (
						registry.serverUrl?.startsWith(
							"registry.hub.docker.com",
						)
					) {
						dockerConfig.auths["https://index.docker.io/v1/"] = {
							auth: Buffer.from(
								registry.username + ":" + registry.secret,
							)?.toString("base64"),
						};
					} else {
						dockerConfig.auths[url[0]] = {
							auth: Buffer.from(
								registry.username + ":" + registry.secret,
							)?.toString("base64"),
						};
					}
					break;
			}
		}
	}
	const dockerConfigPath = path.join(os.homedir(), ".docker", "config.json");
	await tmpFs.createFile(ctx, {
		path: dockerConfigPath,
		content: JSON.stringify(dockerConfig, undefined, 2),
	});
}

export async function getOAuthAccessToken(
	serviceAccount: string,
	ctx: Contextual<any, any>,
): Promise<string> {
	// 1. Obtain token from metadata service
	const accessToken = await (
		await ctx.http.request<{ access_token: string }>(
			"http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
			{ method: "GET", headers: { "Metadata-Flavor": "Google" } },
		)
	).json();

	// 2. Exchange token with oauth token for the passed service account
	const oauthAccessToken = await (
		await ctx.http.request<{ accessToken: string }>(
			`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccount}:generateAccessToken`,
			{
				body: JSON.stringify({
					scope: "https://www.googleapis.com/auth/cloud-platform",
					lifetime: "1800s",
					delegates: ["atomist-bot@atomist.iam.gserviceaccount.com"],
				}),
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken.access_token}`,
				},
			},
		)
	).json();

	return oauthAccessToken.accessToken;
}
