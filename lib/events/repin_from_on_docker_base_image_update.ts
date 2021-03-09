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

import { EventHandler } from "@atomist/skill";

import { Configuration } from "../configuration";
import { pinFromInstruction } from "../pin_from";
import { PinFromOnDockerBaseImageUpdate } from "../types";

export const handler: EventHandler<
	PinFromOnDockerBaseImageUpdate,
	Configuration
> = async ctx =>
	pinFromInstruction(
		ctx,
		ctx.data.commit,
		ctx.data.image.repository,
		ctx.data.image.manifestList?.[0]?.digest || ctx.data.image?.digest,
		ctx.data.image.tags[0],
		ctx.data.file.path,
	);
