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

import { subscription } from "@atomist/skill";

export interface CommitAndDockerfile {
	commit: subscription.datalog.Commit;
	file: {
		path: string;
		lines: Array<{
			number: number;
			instruction: string;
			argsMap: Record<string, string>;
			argsArray: string[];
			argsString: string;
			repository: {
				host: string;
				name: string;
			};
			tag: string;
			digest: string;
			image: {
				digest: string;
				tags: string[];
			};
			manifestList: {
				digest: string;
				tags: string[];
				images: Array<{
					digest: string;
					platform: Array<{
						os: string;
						variant?: string;
						architecture: string;
					}>;
				}>;
			};
		}>;
	};
	registry: subscription.datalog.DockerRegistry[];
	image: Array<
		Pick<subscription.datalog.DockerImage, "repository" | "digest" | "tags">
	>;
	manifestList: Array<{
		digest: string;
		tags: string[];
		images: Array<{
			digest: string;
			platform: Array<{
				os: string;
				variant?: string;
				architecture: string;
			}>;
		}>;
	}>;
}

export interface ValidateBaseImages {
	commit: subscription.datalog.Commit & {
		files: Array<{ path: string }>;
		dockerFiles: Array<{
			path: string;
			sha: string;
			lines: Array<{
				number: number;
				instruction: string;
				argsMap: Record<string, string>;
				argsArray: string[];
				argsString: string;
				repository: {
					host: string;
					name: string;
				};
				tag: string;
				digest: string;
			}>;
		}>;
	};
}

export interface ValidateLinkingRaw {
	commit: subscription.datalog.Commit & {
		id: string;
		files: Array<{ path: string; id: string }>;
		dockerFiles: Array<{
			id: string;
			path: string;
		}>;
	};
	image: {
		id: string;
		sha: string;
		digest: string;
		tags: string[];
		dockerFile: {
			id: string;
			path: string;
		};
		repository: subscription.datalog.DockerImage["repository"];
	};
}

export interface ValidateLinking {
	commit: subscription.datalog.Commit & {
		id: string;
		files: Array<{ path: string; id: string }>;
		dockerFiles: Array<{
			id: string;
			path: string;
		}>;
	};
	image: Array<{
		id: string;
		sha: string;
		digest: string;
		tags: string[];
		dockerFile: {
			id: string;
			path: string;
		};
		repository: subscription.datalog.DockerImage["repository"];
	}>;
}
