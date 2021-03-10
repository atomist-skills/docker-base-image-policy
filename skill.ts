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
	resourceProvider,
	skill,
} from "@atomist/skill";

import { Configuration } from "./lib/configuration";

export const Skill = skill<Configuration & { repoFilter: any }>({
	displayName: "Docker Base Image Policy",
	description: "Policy to manage Docker base images",
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
			displayName: "Require pinned base images",
			description:
				"Fail policy when there are no base images that aren't pinned",
			required: false,
			defaultValue: true,
		},
		pinningPullRequests: {
			type: ParameterType.Boolean,
			displayName: "Raise pull requests",
			description:
				"Raise pull requests to pin Docker base images to digests",
			required: false,
		},
		pinningLabels: {
			type: ParameterType.StringArray,
			displayName: "Pull request labels",
			description: "Additional labels for pinning pull requests",
			required: false,
		},
		pinningAssignReviewers: {
			type: ParameterType.Boolean,
			displayName: "Assign reviewer for pinning pull requests",
			description:
				"When raising pull requests to pin Docker base images, assign last committer as reviewer",
			required: false,
		},
		acceptRequired: {
			type: ParameterType.Boolean,
			displayName: "Require allowlist",
			description: "Verify Docker base images against allowlist",
			required: false,
		},
		acceptImages: {
			type: ParameterType.StringArray,
			displayName: "Allowed base images",
			description: "Allowed Docker base images with or without tags",
			required: false,
		},
		acceptRegistries: {
			type: ParameterType.StringArray,
			displayName: "Allowed Docker registries",
			description: "Allowed Docker registry host names",
			required: false,
		},
		repoFilter: parameter.repoFilter(),
	},

	capabilities: {
		requires: [
			{
				namespace: "atomist",
				name: "DockerRegistry",
				minRequired: 1,
				usage: "analysis",
				displayName: "Docker registry",
				scopes: [CapabilityScope.Configuration],
			},
		],
	},
});
