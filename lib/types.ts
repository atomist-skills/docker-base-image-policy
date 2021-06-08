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
			startNumber?: number;
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
				env: Array<Array<string>>;
				ports: Array<Array<string>>;
				dockerFile: {
					path: string;
					commit: subscription.datalog.Commit;
				};
			};
			manifestList: {
				digest: string;
				tags: string[];
				images: Array<{
					digest: string;
					tags: string[];
					env: Array<Array<string>>;
					ports: Array<Array<string>>;
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
		Pick<
			subscription.datalog.DockerImage,
			"repository" | "digest" | "tags"
		> & {
			tags: string[];
			env: Array<Array<string>>;
			ports: Array<Array<string>>;
		}
	>;
	manifestList: Array<{
		digest: string;
		tags: string[];
		images: Array<{
			digest: string;
			tags: string[];
			env: Array<Array<string>>;
			ports: Array<Array<string>>;
			platform: Array<{
				os: string;
				variant?: string;
				architecture: string;
			}>;
		}>;
	}>;
}

export interface ValidateBaseImagesRaw {
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
	image: Pick<
		subscription.datalog.DockerImage,
		"repository" | "digest" | "tags"
	>;
	manifestList: {
		digest: string;
		tags: string[];
		repository: subscription.datalog.DockerImage["repository"];
	};
}

export interface ValidateBaseImages {
	commit: subscription.datalog.Commit & {
		files: Array<{ path: string }>;
		dockerFiles: Array<{
			path: string;
			sha: string;
			lines: Array<{
				startNumber?: number;
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
	image: Array<
		Pick<subscription.datalog.DockerImage, "repository" | "digest" | "tags">
	>;
	manifestList: Array<{
		digest: string;
		tags: string[];
		repository: subscription.datalog.DockerImage["repository"];
	}>;
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

export interface UpdateFrom {
	checkrun: { requestedActionId: string; sourceId: string };
	commit: subscription.datalog.Commit;
	update: {
		sha: string;
		edits: Array<{
			path: string;
			from: string;
			to: string;
		}>;
	};
}

export interface PinAptPackages {
	commit: subscription.datalog.Commit;
	file: {
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
			image: {
				digest: string;
				tags: string[];
				distro: {
					name: string;
					version: string;
					id: string;
					idLike: string[];
				};
				packageManager: {
					type: string;
					sources: string[];
				};
				platform: Array<{
					os: string;
					variant?: string;
					architecture: string;
				}>;
			};
			manifestList: {
				digest: string;
				tags: string[];
				images: Array<{
					digest: string;
					tags: string[];
					distro: {
						name: string;
						version: string;
						id: string;
						idLike: string[];
					};
					packageManager: {
						type: string;
						sources: string[];
					};
					platform: Array<{
						os: string;
						variant?: string;
						architecture: string;
					}>;
				}>;
			};
		}>;
	};
}

export interface TransactSupportedTags {
	host: string;
	name: string;
}
