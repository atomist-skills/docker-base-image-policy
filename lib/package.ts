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

import { AptClient } from "apt-client";
import { CommandEntry } from "docker-file-parser";

export async function pinAptPackagesToLatest(
	layer: number,
	dockerfile: string,
	sources: string[],
	arch = "amd64",
): Promise<{
	changes: Array<{ name: string; version: string }>;
	dockerfile: string;
}> {
	const parser = await import("docker-file-parser");
	const lines = dockerfile.split("\n");
	const instructions = instructionsToLayers(
		addStartLineNo(
			parser.parse(dockerfile, {
				includeComments: true,
			}),
			dockerfile,
		),
	)[layer];

	// Refresh apt packages
	const apt = new AptClient(sources, arch);
	await apt.update();

	const changes: Array<{ name: string; version: string }> = [];
	for (let ii = 0; ii < instructions.length; ii++) {
		if (isAptInstallInstructions(instructions[ii])) {
			// Check previous instruction for a known comment
			const previousInstruction = instructions[ii - 1];
			if (
				previousInstruction.name === "COMMENT" &&
				/^#\s*atomist:apt-source=/.test(
					(previousInstruction.args as string).trim(),
				)
			) {
				const source = (previousInstruction.args as string)
					.trim()
					.split("=")[1];
				await apt.update([source, ...sources]);
			} else if (
				previousInstruction.name === "COMMENT" &&
				/^#\s*atomist:apt-ignore\s*$/.test(
					previousInstruction.args as string,
				)
			) {
				continue;
			}

			const runInstruction = instructions[ii];
			const parts = (runInstruction.args as string)
				.split("&&")
				.filter(i => !(i.includes("apt-get") && i.includes("update")));
			let changed = false;
			for (let i = 0; i < parts.length; i++) {
				const part = parts[i];
				if (/apt-get\s*install/.test(part)) {
					const newParts = ["apt-get update && apt-get install"];
					const newPkp = [];
					const args = part
						.trim()
						.split(" ")
						.slice(2)
						.map(p => p.trim());
					for (let pi = 0; pi < args.length; pi++) {
						const arg = args[pi];
						if (arg.startsWith("-")) {
							newParts.push(arg);
						} else if (arg) {
							const name = arg.split("=")?.[0]?.trim();
							const version = arg.split("=")?.[1]?.trim();
							const latest =
								apt.getLatest([name])?.next()?.value?.[1] ||
								version;
							if (latest) {
								newPkp.push(`${name}=${latest}`);
							} else {
								newPkp.push(name);
							}
							if (latest !== version) {
								changed = true;
								changes.push({ name, version: latest });
							}
						}
					}
					parts[i] = `${newParts.join(" ")} \\\n    ${newPkp
						.sort()
						.join(` \\\n    `)}`;
				}
			}
			if (changed) {
				for (
					let ix = runInstruction.startLineNo - 1;
					ix < runInstruction.lineno;
					ix++
				) {
					lines[ix] = "# <delete>";
				}
				lines[runInstruction.startLineNo - 1] = `RUN ${parts
					.map(p => p.trim())
					.join(" \\\n && ")}`;
			}
		}
	}
	return {
		dockerfile: lines.filter(l => l !== "# <delete>").join("\n"),
		changes,
	};
}

function instructionsToLayers(
	entries: Array<CommandEntry & { startLineNo?: number }>,
): Record<number, Array<CommandEntry & { startLineNo?: number }>> {
	const layers = {};
	let ix = -1;
	let layerEntries = [];
	for (const entry of entries) {
		if (entry.name === "FROM") {
			layers[ix] = layerEntries;
			ix = ix + 1;
			layerEntries = [entry];
		} else {
			layerEntries.push(entry);
		}
	}
	layers[ix] = layerEntries;
	return layers;
}

function addStartLineNo(
	entries: Array<CommandEntry & { startLineNo?: number }>,
	dockerfile: string,
): Array<CommandEntry & { startLineNo?: number }> {
	const dockerfileLines = dockerfile.split("\n");
	for (const entry of entries.filter(e => e.name === "RUN")) {
		let ix = entry.lineno - 1;
		while (ix >= 0) {
			if (dockerfileLines[ix].startsWith("RUN")) {
				entry.startLineNo = ix + 1;
				break;
			}
			ix = ix - 1;
		}
	}
	return entries;
}

function isAptInstallInstructions(instruction: CommandEntry): boolean {
	return (
		instruction.name === "RUN" &&
		/^apt-get\s*update\s*&&\s*apt-get\s*install/.test(
			instruction.args as string,
		)
	);
}
