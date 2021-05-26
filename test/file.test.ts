import * as fs from "fs-extra";
import * as path from "path";
import * as assert from "power-assert";

import { diffFiles } from "../lib/file";

describe("file", () => {
	describe("diffFiles", () => {
		it("should diff large file diffs", async () => {
			const diffs = await fs.readJson(path.join(__dirname, "diff.json"));
			const mods = diffs[0].Diff.Mods.map(m => ({
				path: m.Name,
				current: m.Size1,
				proposed: m.Size2,
			}));
			const aggregate = diffFiles(mods);
			assert(aggregate.length <= 100);
		});
	});
});
