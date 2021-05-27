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

import { EventContext, subscription } from "@atomist/skill";
import * as _ from "lodash";

import { Configuration } from "./configuration";
import { CommitAndDockerfile, ValidateBaseImages } from "./types";

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

export function printTag(
	from: string,
	fromLine: ValidateBaseImages["commit"]["dockerFiles"][0]["lines"][0],
): string {
	if (
		fromLine.tag &&
		from.includes("@sha") &&
		!from.includes(`:${fromLine.tag}@`)
	) {
		return `\n${_.padStart("", from.split("@sha")[0].length)}\`--> ${
			fromLine.tag
		}`;
	} else {
		return "";
	}
}

export function findTag(
	ctx: EventContext<ValidateBaseImages, Configuration>,
	repository: subscription.datalog.DockerImage["repository"],
	digest: string,
): string {
	const image = ctx.data.image?.find(i => i.digest === digest);
	if (image) {
		return image.tags?.join(", ");
	}
	const manifestList = ctx.data.manifestList?.find(m => m.digest === digest);
	if (manifestList) {
		return manifestList.tags?.join(", ");
	}
	return undefined;
}

export function mapSeverity(
	severity: subscription.datalog.DockerImageVulnerabilitySeverity,
): number {
	switch (severity) {
		case subscription.datalog.DockerImageVulnerabilitySeverity.Critical:
			return 0;
		case subscription.datalog.DockerImageVulnerabilitySeverity.High:
			return 1;
		case subscription.datalog.DockerImageVulnerabilitySeverity.Medium:
			return 2;
		case subscription.datalog.DockerImageVulnerabilitySeverity.Low:
			return 3;
		case subscription.datalog.DockerImageVulnerabilitySeverity.Minimal:
			return 4;
		default:
			return 5;
	}
}

/**
 * Sort helper for CVE ids in form of CVE-yyyy-counter
 */
export function mapId(id: string): number {
	const parts = id.split("-");
	return +`${parts[1]}${_.padStart(parts[2], 8, "0")}`;
}

export function formatAggregateDiffs(
	before: Pick<
		subscription.datalog.BaseDockerVulnerability,
		"sourceId" | "severity"
	>[],
	after: Pick<
		subscription.datalog.BaseDockerVulnerability,
		"sourceId" | "severity"
	>[],
	baselineSet: boolean,
): { msg: string; count: number } {
	const parts = [];
	let count = 0;

	const countFn = (
		before: Pick<
			subscription.datalog.BaseDockerVulnerability,
			"sourceId" | "severity"
		>[],
		after: Pick<
			subscription.datalog.BaseDockerVulnerability,
			"sourceId" | "severity"
		>[],
		severity: subscription.datalog.DockerImageVulnerabilitySeverity,
	) => {
		const fBefore = before.filter(b => b.severity === severity);
		const fAfter = after.filter(a => a.severity === severity);
		const added = fAfter.filter(
			a => !fBefore.some(b => b.sourceId === a.sourceId),
		);
		const removed = fBefore.filter(
			b => !fAfter.some(a => a.sourceId === b.sourceId),
		);
		return {
			count: fAfter.length,
			baselineCount: fBefore.length,
			added: added.length,
			removed: removed.length,
		};
	};
	const formatFn = (
		counts: {
			count: number;
			baselineCount: number;
			added: number;
			removed: number;
		},
		label: string,
	) => {
		if (counts.count > 0 || counts.baselineCount > 0) {
			if (baselineSet) {
				parts.push(
					`${counts.count} (${
						counts.added > 0 ? "+" + counts.added : ""
					}${counts.added > 0 && counts.removed > 0 ? "|" : ""}${
						counts.removed > 0 ? "-" + counts.removed : ""
					}${
						counts.removed === 0 && counts.added === 0 ? "±0" : ""
					}) ${label}`,
				);
			} else {
				parts.push(`${counts.count} ${label}`);
			}
			count += counts.count;
		}
	};

	formatFn(
		countFn(
			before,
			after,
			subscription.datalog.DockerImageVulnerabilitySeverity.Critical,
		),
		"critical",
	);
	formatFn(
		countFn(
			before,
			after,
			subscription.datalog.DockerImageVulnerabilitySeverity.High,
		),
		"high",
	);
	formatFn(
		countFn(
			before,
			after,
			subscription.datalog.DockerImageVulnerabilitySeverity.Medium,
		),
		"medium",
	);
	formatFn(
		countFn(
			before,
			after,
			subscription.datalog.DockerImageVulnerabilitySeverity.Low,
		),
		"low",
	);
	formatFn(
		countFn(
			before,
			after,
			subscription.datalog.DockerImageVulnerabilitySeverity.Minimal,
		),
		"minimal",
	);
	formatFn(
		countFn(
			before,
			after,
			subscription.datalog.DockerImageVulnerabilitySeverity.Unspecified,
		),
		"unspecified",
	);
	return {
		msg: `${parts.join(", ").replace(/, ([^,]*)$/, " and $1")}`,
		count,
	};
}

export function addStartLineNo(
	entries: Array<
		Pick<
			CommitAndDockerfile["file"]["lines"][0],
			"instruction" | "number" | "startNumber"
		>
	>,
	dockerfile: string,
): void {
	const dockerfileLines = dockerfile.split("\n");
	for (const entry of entries) {
		let ix = entry.number - 1;
		while (ix >= 0) {
			if (dockerfileLines[ix].startsWith(entry.instruction)) {
				entry.startNumber = ix + 1;
				break;
			}
			ix = ix - 1;
		}
	}
}
