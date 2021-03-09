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

export interface DockerManifestList {
	manifestList: Array<{
		digest: string;
		tags: string[];
		repository: subscription.datalog.DockerImage["repository"];
	}>;
}

export type PinFromOnDockerFile = ValidateBaseImages;

export interface PinFromOnDockerBaseImageUpdate {
	commit: subscription.datalog.Commit;
	image: subscription.datalog.DockerImage & DockerManifestList;
	file: {
		path: string;
	};
}

export interface ValidateBaseImages {
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
			};
			manifestList: {
				digest: string;
			};
		}>;
	};
}
