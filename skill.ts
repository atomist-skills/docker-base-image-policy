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

export const Skill = skill<Configuration & { repoFilter: any }>({
	displayName: "Docker Base Image Policy",
	description:
		"Set a policy to receive a pull request whenever a new base image is available",
	categories: [Category.DevOps],
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
			displayName: "Create GitHub checks",
			description:
				"Select to create a GitHub check to identify pinned and unpinned base images in your Docker files.",
			required: false,
			defaultValue: true,
		},
		pinningPullRequests: {
			type: ParameterType.Boolean,
			displayName: "Raise pull requests",
			description:
				"Select to raise a pull request when you have an unpinned Docker file, or when the tag in use is updated.",
			required: false,
			defaultValue: true,
		},
		pinningIncludeTag: {
			type: ParameterType.Boolean,
			displayName: "Preserve Docker tag",
			description: "Keep the Docker tag in the `FROM` image when pinning",
			required: false,
			defaultValue: true,
			visibility: ParameterVisibility.Hidden,
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
		acceptRequired: {
			type: ParameterType.Boolean,
			displayName: "Require allowlist",
			description: "Verify Docker base images against allowlist",
			required: false,
			visibility: ParameterVisibility.Hidden,
		},
		acceptImages: {
			type: ParameterType.StringArray,
			displayName: "Allowed base images",
			description: "Allowed Docker base images with or without tags",
			required: false,
			visibility: ParameterVisibility.Hidden,
		},
		acceptRegistries: {
			type: ParameterType.StringArray,
			displayName: "Allowed Docker registries",
			description: "Allowed Docker registry host names",
			required: false,
			visibility: ParameterVisibility.Hidden,
		},
		repoFilter: parameter.repoFilter(),
	},

	capabilities: {
		requires: [
			{
				namespace: "atomist",
				name: "DockerRegistry",
				minRequired: 0,
				usage: "analysis",
				displayName: "Docker registry",
				scopes: [CapabilityScope.Subscription],
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
