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
	CapabilityScope,
	Category,
	parameter,
	ParameterType,
	ParameterVisibility,
	resourceProvider,
	skill,
} from "@atomist/skill";

import { Configuration } from "./lib/configuration";

export const Skill = skill<
	Configuration & { repoFilter: any; transactSupportedTagsSchedule: any }
>({
	displayName: "Docker Base Image Policy",
	description:
		"Set a policy to receive a pull request whenever a new base image is available",
	categories: [Category.DevSecOps],
	iconUrl:
		"https://raw.githubusercontent.com/atomist-skills/docker-base-image-policy/main/docs/images/icon.svg",

	resourceProviders: {
		github: resourceProvider.gitHub({ minRequired: 1 }),
	},

	containers: {
		docker: {
			image: "gcr.io/atomist-container-skills/docker-base-image-policy",
		},
	},

	parameters: {
		pinningRequired: {
			type: ParameterType.Boolean,
			displayName: "Pinned Docker base images check",
			description:
				"Select to create a GitHub check to identify pinned and unpinned base images in your Docker files.",
			required: false,
			defaultValue: true,
		},
		pinningFailCheck: {
			type: ParameterType.Boolean,
			displayName: "Fail pinned Docker base images check",
			description:
				"Select to fail check if there unpinned Docker base images. If left unchecked, the check will be neutral.",
			defaultValue: false,
			required: false,
		},
		pinningPullRequests: {
			type: ParameterType.Boolean,
			displayName: "Raise pull requests",
			description:
				"Select to raise a pull request when you have an unpinned Docker file, or when the tag in use is updated.",
			required: false,
			defaultValue: true,
		},
		pinningAptPullRequests: {
			type: ParameterType.Boolean,
			displayName: "Raise pull requests",
			description:
				"Select to raise a pull request to pin packages to specific versions in `apt-get install` Dockerfile instructions.",
			required: false,
			defaultValue: true,
		},
		pinningLabels: {
			type: ParameterType.StringArray,
			displayName: "Pull request labels",
			description:
				"Add labels to new pull requests created by this skill.",
			required: false,
		},
		pinningAssignReviewers: {
			type: ParameterType.Boolean,
			displayName: "Pull request reviewers",
			description:
				"Select to assign last committer as a reviewer on new pull requests created by this skill.",
			required: false,
		},
		supportedTagRequired: {
			type: ParameterType.Boolean,
			displayName: "Unsupported Docker tag check",
			description:
				"Select to create a GitHub check identify supported and unsupported tag of official Docker images.",
			required: false,
			defaultValue: true,
		},
		supportedTagFailCheck: {
			type: ParameterType.Boolean,
			displayName: "Fail unsupported Docker tag check",
			description:
				"Select to fail check if there unsupported Docker base images. If left unchecked, the check will be neutral.",
			defaultValue: false,
			required: false,
		},
		acceptRequired: {
			type: ParameterType.Boolean,
			displayName: "Require allowlist",
			description: "Verify Docker base images against allowlist.",
			required: false,
			visibility: ParameterVisibility.Hidden,
		},
		acceptImages: {
			type: ParameterType.StringArray,
			displayName: "Allowed base images",
			description:
				"Allowed Docker base images with or without supported.",
			required: false,
			visibility: ParameterVisibility.Hidden,
		},
		acceptRegistries: {
			type: ParameterType.StringArray,
			displayName: "Allowed Docker registries",
			description: "Allowed Docker registry host names.",
			required: false,
			visibility: ParameterVisibility.Hidden,
		},
		linkingRequired: {
			type: ParameterType.Boolean,
			displayName: "Require linking",
			description: "Verify Docker images and Dockerfiles are linked.",
			required: false,
			visibility: ParameterVisibility.Hidden,
		},
		repoFilter: parameter.repoFilter({ required: false }),
		transactSupportedTagsSchedule: {
			type: ParameterType.Schedule,
			displayName: "Transact supported tags",
			description:
				"Transact supported tags from all Official Docker images",
			required: false,
			defaultValue: "0 * * * *",
			visibility: ParameterVisibility.Advanced,
		},
	},

	capabilities: {
		requires: [
			{
				namespace: "atomist",
				name: "DockerRegistry",
				minRequired: 0,
				usage: "analysis",
				displayName: "Docker registry",
				scopes: [CapabilityScope.Configuration],
			},
			{
				namespace: "atomist",
				name: "PolicyResult",
				minRequired: 0,
				usage: "policy",
				displayName: "Policy Result",
				scopes: [CapabilityScope.Subscription],
			},
		],
	},
});
