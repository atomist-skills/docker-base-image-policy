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
