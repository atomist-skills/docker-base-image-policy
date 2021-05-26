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

import * as fs from "fs-extra";
import * as _ from "lodash";
import * as path from "path";
import * as assert from "power-assert";

import { diffFiles } from "../lib/file";

describe("file", () => {
	describe("diffFiles", () => {
		it("should diff large file diffs", async () => {
			const diffs = await fs.readJson(path.join(__dirname, "diff.json"));
			const fileDiff = diffFiles(
				_.sortBy(
					_.flattenDeep(
						diffs
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
									current: 0,
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
			const aggregate = diffFiles(_.sortBy(fileDiff, "path"));
			assert(aggregate.length <= 100);
			assert(!aggregate.some(a => a.children === 1));
		});
	});
});
