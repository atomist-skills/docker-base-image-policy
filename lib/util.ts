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

export function replaceLastFrom(
	dockerfile: string,
	image: string,
	tag: string,
): string {
	const labelRegexp = /^LABEL\s*com\.atomist\.follow-tag=([\S]*)$/gim;

	// Get the last FROM match
	const fromMatch = findLastFrom(dockerfile);
	const ix = dockerfile.lastIndexOf(fromMatch[1]);

	const dockerfileWithUpdatedFrom = `${dockerfile.slice(
		0,
		ix,
	)}${image}${dockerfile.slice(ix + fromMatch[1].length)}`;

	// Update the label
	const labelMatch = labelRegexp.exec(dockerfileWithUpdatedFrom);
	if (labelMatch) {
		const ix = dockerfileWithUpdatedFrom.lastIndexOf(labelMatch[1]);
		return `${dockerfileWithUpdatedFrom.slice(
			0,
			ix,
		)}${tag}${dockerfileWithUpdatedFrom.slice(ix + labelMatch[1].length)}`;
	} else {
		const fromMatch = findLastFrom(dockerfileWithUpdatedFrom);
		const ix = dockerfileWithUpdatedFrom.lastIndexOf(fromMatch[0]);
		return `${dockerfileWithUpdatedFrom.slice(
			0,
			ix + fromMatch[0].length,
		)}\nLABEL com.atomist.follow-tag=${tag}${dockerfileWithUpdatedFrom.slice(
			ix + fromMatch[0].length,
		)}`;
	}
}

export function replaceFroms(
	dockerfile: string,
	images: string[],
	ix = -1,
): string {
	const fromRegexp = /^(FROM\s*)([\S]*)(.*)$/gim;
	let match: RegExpExecArray;
	let i = 0;
	let replacedDockerfile = dockerfile;
	do {
		match = fromRegexp.exec(replacedDockerfile);
		if (match) {
			if (ix === -1 || i === ix) {
				const image = images[i];
				replacedDockerfile =
					replacedDockerfile.slice(0, match.index) +
					match[1] +
					image +
					match[3] +
					replacedDockerfile.slice(match.index + match[0].length);
			}
			i++;
		}
	} while (match);
	return replacedDockerfile;
}

function findLastFrom(dockerfile: string): RegExpExecArray {
	const fromRegexp = /^FROM\s*([\S]*)(.*)$/gim;
	let match: RegExpExecArray;
	let lastMatch: RegExpExecArray;
	do {
		match = fromRegexp.exec(dockerfile);
		if (match) {
			lastMatch = match;
		}
	} while (match);
	return lastMatch;
}

export function linkFile(
	path: string,
	commit: subscription.datalog.Commit,
): string {
	return `[\`${path}\`](https://github.com/${commit.repo.org.name}/${commit.repo.name}/blob/${commit.sha}/${path})`;
}

export function imageName(
	repository: subscription.datalog.DockerImage["repository"],
): string {
	if (!repository) {
		return undefined;
	}
	return `${
		repository.host !== "hub.docker.com"
			? `${repository.host}/${repository.name}`
			: repository.name
	}`;
}
