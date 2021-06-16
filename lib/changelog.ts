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
	after,
	childProcess,
	EventContext,
	github,
	guid,
	log,
	project,
	subscription,
	template,
	toArray,
} from "@atomist/skill";
import * as fs from "fs-extra";
import * as _ from "lodash";
import * as os from "os";
import * as path from "path";

import { Configuration } from "./configuration";
import { diffFiles } from "./file";
import { CommitAndDockerfile } from "./types";
import { formatAggregateDiffs, mapId, mapSeverity } from "./util";
import { retrieveVulnerabilities } from "./vulnerability";

async function getLibraryFileCommit(
	p: project.Project,
	repository: subscription.datalog.DockerImage["repository"],
): Promise<{ sha: string; message: string; slug: string; path: string }> {
	if (
		repository.host === "hub.docker.com" &&
		!repository.name.includes("/")
	) {
		// Get commit on the definition file
		const result = (
			await github.api(p.id).repos.listCommits({
				owner: "docker-library",
				repo: "official-images",
				path: `library/${repository.name}`,
				per_page: 1,
			} as any)
		).data[0];
		return {
			slug: "docker-library/official-images",
			path: `library/${repository.name}`,
			sha: result.sha,
			message: result.commit.message,
		};
	}
	return undefined;
}

export const changelog = after(_changelog, removeCredentials);

async function _changelog(
	ctx: EventContext<any, Configuration>,
	p: project.Project,
	fromLine: CommitAndDockerfile["file"]["lines"][0],
	registries: CommitAndDockerfile["registry"],
	images: CommitAndDockerfile["image"],
	manifests: CommitAndDockerfile["manifestList"],
	dryRun: boolean,
): Promise<string> {
	const repository = fromLine.repository;

	if (!fromLine.digest) {
		log.debug("from line not pinned");
		return undefined;
	}

	const imageName = `${
		repository.host !== "hub.docker.com"
			? `${repository.host}/${repository.name}`
			: repository.name
	}`;

	// Get the digest of the new image
	let proposedDigest = fromLine.image?.digest;
	let proposedPorts = fromLine.image?.ports || [];
	let proposedEnv = fromLine.image?.env || [];
	let platform: CommitAndDockerfile["file"]["lines"][0]["manifestList"]["images"][0]["platform"][0] =
		{
			os: "linux",
			architecture: "amd64",
		};

	let file: {
		slug: string;
		message: string;
		sha: string;
		path: string;
	};
	if (fromLine.manifestList) {
		let proposedImage = fromLine.manifestList?.images?.find(i =>
			i.platform.some(
				p => p.os === "linux" && p.architecture === "amd64",
			),
		);
		if (!proposedImage) {
			proposedImage = fromLine.manifestList?.images?.[0];
		}
		proposedDigest = proposedImage.digest;
		platform = proposedImage.platform[0];
		proposedPorts = proposedImage.ports || [];
		proposedEnv = proposedImage.env || [];
	} else if (fromLine.image?.dockerFile?.commit) {
		file = {
			slug: `${fromLine.image.dockerFile.commit.repo?.org?.name}/${fromLine.image.dockerFile.commit.repo?.name}`,
			message: fromLine.image.dockerFile.commit.message,
			sha: fromLine.image.dockerFile.commit.sha,
			path: fromLine.image.dockerFile.path,
		};
	}

	if (!proposedDigest) {
		log.debug("Failed to calculate new digest");
		return undefined;
	}

	let currentDigest = fromLine.digest;
	let currentPorts = [];
	let currentEnv = [];
	if (manifests.some(m => m.digest === currentDigest)) {
		const matchingImage = manifests
			.find(m => m.digest === currentDigest)
			.images.find(i =>
				i.platform.some(
					p =>
						p.os === platform.os &&
						p.architecture === platform.architecture &&
						p.variant === platform.variant,
				),
			);
		if (matchingImage) {
			currentDigest = matchingImage.digest;
			currentPorts = matchingImage.ports || [];
			currentEnv = matchingImage.env || [];
		}
	} else if (images.some(i => i.digest === currentDigest)) {
		const matchingImage = images.find(i => i.digest === currentDigest);
		if (matchingImage) {
			currentDigest = matchingImage.digest;
			currentPorts = matchingImage.ports || [];
			currentEnv = matchingImage.env || [];
		}
	}

	if (proposedDigest === currentDigest) {
		log.debug("Same digests");
		return undefined;
	}

	const proposedVulnerabilities = await retrieveVulnerabilities(
		proposedDigest,
		ctx,
	);
	const currentVulnerabilities = await retrieveVulnerabilities(
		currentDigest,
		ctx,
	);

	if (dryRun) {
		return template.render("changelog_pending", {
			imageName: `${imageName}${fromLine.tag ? `:${fromLine.tag}` : ""}`,
		});
	}

	file = file || (await getLibraryFileCommit(p, repository));

	await prepareCredentials(registries, repository);

	const outputFile = path.join(os.tmpdir(), guid());
	const currentHistoryOutputFile = path.join(os.tmpdir(), guid());
	const proposedHistoryOutputFile = path.join(os.tmpdir(), guid());
	let result = await childProcess.spawnPromise("container-diff", [
		"diff",
		`${imageName}@${currentDigest}`,
		`${imageName}@${proposedDigest}`,
		"--type=apt",
		"--type=node",
		"--type=file",
		"--type=size",
		"--type=pip",
		"--type=rpm",
		"--json",
		"--quiet",
		`--output=${outputFile}`,
	]);
	// await removeCredentials();
	if (result.status !== 0) {
		log.warn(`Failed to diff container images`);
		return undefined;
	}
	result = await childProcess.spawnPromise("container-diff", [
		"analyze",
		`${imageName}@${currentDigest}`,
		"--type=history",
		"--json",
		"--quiet",
		`--output=${currentHistoryOutputFile}`,
	]);
	if (result.status !== 0) {
		log.warn(`Failed to analyze container image`);
		return undefined;
	}
	result = await childProcess.spawnPromise("container-diff", [
		"analyze",
		`${imageName}@${proposedDigest}`,
		"--type=history",
		"--json",
		"--quiet",
		`--output=${proposedHistoryOutputFile}`,
	]);
	if (result.status !== 0) {
		log.warn(`Failed to analyze container image`);
		return undefined;
	}

	const diff = await fs.readJson(outputFile);

	const packageDiff = _.sortBy(
		_.flatten(
			diff
				.filter(d => ["Apt", "RPM", "Node", "pip"].includes(d.DiffType))
				.filter(d => d.Diff?.InfoDiff?.length > 0)
				.map(p =>
					p.Diff.InfoDiff.map(id => ({
						package: id.Package,
						current: toArray(id.Info1)
							.map(i => i.Version)
							.join(", "),
						proposed: toArray(id.Info2)
							.map(i => i.Version)
							.join(", "),
						type: p.DiffType,
					})),
				),
		),
		"package",
	);

	const fileDiff = diffFiles(
		_.sortBy(
			_.flattenDeep(
				diff
					.filter(d => d.DiffType === "File")
					.map(d => [
						...(d.Diff.Adds || []).map(a => ({
							path: a.Name,
							current: undefined,
							proposed: a.Size,
							diff: a.Size,
						})),
						...(d.Diff.Dels || []).map(d => ({
							path: d.Name,
							current: d.Size || 0,
							proposed: undefined,
							diff: 0,
						})),
						...(d.Diff.Mods || []).map(m => ({
							path: m.Name,
							current: m.Size1,
							proposed: m.Size2,
							diff: m.Size2 - m.Size1,
						})),
					]),
			),
			"path",
		),
	);

	const historyDiff = await prepareHistoryDiff(
		currentHistoryOutputFile,
		proposedHistoryOutputFile,
	);

	const arrayDiff = (a1: string[][], a2: string[][]) => {
		const j1 = (a1 || []).map(a => a.join(" ")).sort();
		const j2 = (a2 || []).map(a => a.join(" ")).sort();
		return _.difference(j1, j2);
	};

	const portsDiff = _.sortBy(
		[
			...arrayDiff(currentPorts, proposedPorts).map(r => ({
				type: "-",
				text: r,
			})),
			...arrayDiff(proposedPorts, currentPorts).map(r => ({
				type: "+",
				text: r,
			})),
		],
		["text", "type"],
		["asc", "desc"],
	);

	const envDiff = _.sortBy(
		[
			...arrayDiff(currentEnv, proposedEnv).map(r => ({
				type: "-",
				text: r,
			})),
			...arrayDiff(proposedEnv, currentEnv).map(r => ({
				type: "+",
				text: r,
			})),
		],
		["text", "type"],
		["asc", "desc"],
	);

	const sizeDiff = diff.find(d => d.DiffType === "Size")?.Diff?.[0];

	const vulAdditions = _.orderBy(
		(proposedVulnerabilities?.vulnerabilities || []).filter(
			v =>
				!(currentVulnerabilities?.vulnerabilities || []).some(
					c => c.sourceId === v.sourceId,
				),
		),
		[v => mapSeverity(v.severity), v => mapId(v.sourceId)],
		["asc", "desc"],
	);

	const vulRemovals = _.orderBy(
		(currentVulnerabilities?.vulnerabilities || []).filter(
			v =>
				!(proposedVulnerabilities?.vulnerabilities || []).some(
					c => c.sourceId === v.sourceId,
				),
		),
		[v => mapSeverity(v.severity), v => mapId(v.sourceId)],
		["asc", "desc"],
	);

	const vulSummary = formatAggregateDiffs(
		currentVulnerabilities?.vulnerabilities || [],
		proposedVulnerabilities?.vulnerabilities || [],
		true,
	);

	return template.render("changelog", {
		imageName: `${imageName}${fromLine.tag ? `:${fromLine.tag}` : ""}`,
		fromLine,
		file,
		packageDiff,
		fileDiff,
		historyDiff,
		sizeDiff: {
			current: sizeDiff?.Size1,
			proposed: sizeDiff?.Size2,
		},
		envDiff,
		portsDiff,
		vulScanned:
			!!proposedVulnerabilities?.discovery &&
			!!currentVulnerabilities?.discovery,
		vulSummary,
		vulAdditions,
		vulRemovals,
	});
}

async function prepareCredentials(
	registries: CommitAndDockerfile["registry"],
	repository: CommitAndDockerfile["file"]["lines"][0]["repository"],
): Promise<void> {
	if (registries.length === 0) {
		return;
	}
	if (
		repository.host === "hub.docker.com" &&
		!repository.name.includes("/")
	) {
		return;
	}
	const dockerConfig = {
		auths: {},
	} as any;

	for (const registry of registries) {
		const creds = {
			login:
				registry.type === subscription.datalog.DockerRegistryType.Gcr
					? "_json_key"
					: registry.username,
			secret: registry.secret,
		};

		if (registry.serverUrl?.startsWith("registry.hub.docker.com")) {
			dockerConfig.auths["https://index.docker.io/v1/"] = {
				auth: Buffer.from(creds?.login + ":" + creds?.secret)?.toString(
					"base64",
				),
			};
		} else if (registry.serverUrl) {
			const url = registry.serverUrl.split("/");
			dockerConfig.auths[url[0]] = {
				auth: Buffer.from(creds?.login + ":" + creds?.secret)?.toString(
					"base64",
				),
			};
		}
	}

	await fs.ensureDir(path.join(os.homedir(), ".docker"));
	await fs.writeJson(
		path.join(os.homedir(), ".docker", "config.json"),
		dockerConfig,
	);
}

async function removeCredentials(): Promise<void> {
	await fs.remove(path.join(os.homedir(), ".docker", "config.json"));
}

async function prepareHistoryDiff(
	current: string,
	proposed: string,
): Promise<string> {
	const currentHistoryFile = await fs.readJson(current);
	const currentHistory = currentHistoryFile.find(
		h => h.AnalyzeType === "History",
	).Analysis;
	await fs.writeFile(current, currentHistory.join("\n") + "\n");
	const proposedHistoryFile = await fs.readJson(proposed);
	const proposedHistory = proposedHistoryFile.find(
		h => h.AnalyzeType === "History",
	).Analysis;
	await fs.writeFile(proposed, proposedHistory.join("\n") + "\n");
	const capturelog = childProcess.captureLog();
	const result = await childProcess.spawnPromise(
		"git",
		["diff", `--no-color`, current, proposed],
		{ log: capturelog, logCommand: false },
	);
	if (result.status !== 0) {
		const output = capturelog.log;
		return output.split(/^@@.*@@$/gm)[1].slice(1);
	} else {
		return undefined;
	}
}
