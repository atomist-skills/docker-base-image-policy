import * as _ from "lodash";
import * as path from "path";

type File = {
	path: string;
	current: number;
	proposed: number;
	children?: number;
	diff?: number;
};

export function diffFiles(files: File[], limit = 200): File[] {
	const newFiles = diffFilesRecursive(files, limit);
	newFiles
		.filter(f => f.children === 1)
		.forEach(f => {
			f.path = files.find(s => s.path.startsWith(f.path)).path;
			delete f.children;
		});
	return newFiles;
}

export function diffFilesRecursive(files: File[], limit = 100): File[] {
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
					parent.children =
						(parent.children || 0) + (file.children || 1);
					parent.current =
						(parent.current || 0) + (file.current || 0);
					parent.proposed =
						(parent.proposed || 0) + (file.proposed || 0);
					parent.diff =
						(parent.proposed || 0) - (parent.current || 0);
				} else {
					const parent = {
						path: parentPath,
						children: file.children || 1,
						proposed: file.proposed || 0,
						current: file.current || 0,
						diff: (file.proposed || 0) - (file.current || 0),
					};
					aggregates[parentPath] = parent;
				}
			} else {
				aggregates[file.path] = {
					path: file.path,
					children: file.children,
					diff: file.diff || file.proposed - file.current,
					current: file.current,
					proposed: file.proposed,
				};
			}
		}
		const newFiles = _.sortBy(
			_.map(aggregates, v => v),
			"path",
		);
		return diffFilesRecursive(newFiles, limit);
	}
}

function segments(file: File): number {
	return file.path.split("/").length;
}
