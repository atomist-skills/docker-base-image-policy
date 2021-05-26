import * as _ from "lodash";
import * as path from "path";

type File = {
	path: string;
	current: number;
	proposed: number;
	children?: number;
};

export function diffFiles(files: File[], limit = 100): File[] {
	const maxDepth = _.max(files.map(segments));
	if (files.length <= limit) {
		return files;
	} else {
		const aggregates: Record<string, File> = {};
		for (const file of files) {
			if (segments(file) > maxDepth - 1) {
				const parentPath = path.dirname(file.path);
				if (aggregates[parentPath]) {
					const parent = aggregates[parentPath];
					parent.children = parent.children + 1;
					parent.current = parent.current + file.current;
					parent.proposed = parent.proposed + file.proposed;
				} else {
					const parent = {
						path: parentPath,
						children: 1,
						proposed: file.proposed,
						current: file.current,
					};
					aggregates[parentPath] = parent;
				}
			} else {
				aggregates[file.path] = file;
			}
		}
		const newFiles = _.sortBy(
			_.map(aggregates, v => v),
			"path",
		);
		return diffFiles(newFiles, limit);
	}
}

function segments(file: File): number {
	return file.path.split("/").length;
}
