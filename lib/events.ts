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

export const pin_from_on_docker_file_on_config_change =
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	require("./events/pin_from_on_docker_file").handler;

export const validate_base_images_pinned_on_config_change =
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	require("./events/validate_base_images_pinned").handler;

export const validate_base_images_supported_tag_on_config_change =
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	require("./events/validate_base_images_supported_tag").handler;

export const validate_linking_on_docker_file_link =
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	require("./events/validate_linking_on_docker_file").handler;

export const validate_linking_on_docker_image =
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	require("./events/validate_linking_on_docker_file").handler;

export const transact_supported_tags_on_schedule =
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	require("./events/transact_supported_tags_on_docker_image").handler;
