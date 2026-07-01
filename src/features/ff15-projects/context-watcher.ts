import { existsSync, watch } from "node:fs";
import { join } from "node:path";
import type { Disposable } from "vscode";

const WATCH_DEBOUNCE_MS = 200;

export const createProjectsContextWatcher = (input: {
	onChange: () => void | Promise<void>;
	sourcePath: string;
}): Disposable => {
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	const scheduleOnChange = () => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		debounceTimer = setTimeout(() => {
			debounceTimer = undefined;
			input.onChange();
		}, WATCH_DEBOUNCE_MS);
	};

	const watchers = [
		join(input.sourcePath, "config"),
		join(input.sourcePath, "projects"),
	]
		.filter((path) => existsSync(path))
		.map((path) => watch(path, { persistent: false }, scheduleOnChange));

	return {
		dispose: () => {
			if (debounceTimer) {
				clearTimeout(debounceTimer);
			}
			for (const watcher of watchers) {
				watcher.close();
			}
		},
	};
};

export interface ProjectsContextWatcherSync {
	dispose: () => void;
	sync: (sourcePath: string | null | undefined) => void;
}

/**
 * Tracks the currently watched Projects config source path and rebuilds the
 * underlying watcher only when that path changes, so callers don't have to
 * duplicate the dispose/recreate bookkeeping themselves.
 */
export const createProjectsContextWatcherSync = (input: {
	onChange: () => void | Promise<void>;
	watchProjectsContext?: (input: {
		onChange: () => void | Promise<void>;
		sourcePath: string;
	}) => Disposable;
}): ProjectsContextWatcherSync => {
	const watchProjectsContext =
		input.watchProjectsContext ?? createProjectsContextWatcher;

	let watcher: Disposable | undefined;
	let activeSourcePath: string | undefined;

	const dispose = () => {
		watcher?.dispose();
		watcher = undefined;
		activeSourcePath = undefined;
	};

	const sync = (sourcePath: string | null | undefined) => {
		if (sourcePath === activeSourcePath) {
			return;
		}

		dispose();

		if (!sourcePath) {
			return;
		}

		watcher = watchProjectsContext({ onChange: input.onChange, sourcePath });
		activeSourcePath = sourcePath;
	};

	return { dispose, sync };
};
