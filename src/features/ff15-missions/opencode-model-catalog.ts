import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
	FF15_WORKSPACE_RUNTIME_DIR_NAME,
	type Ff15MissionRecord,
} from "./state";
import type { Ff15OpenCodeModelDefinition } from "./model-contract";

const SOURCE_COMMAND = "opencode models --verbose";
const WHITESPACE_PATTERN = /\s/;
const lastErrorByWorkspace = new Map<string, string | null>();
const hasAttemptedRefreshByWorkspace = new Map<string, boolean>();
const refreshPromiseByWorkspace = new Map<
	string,
	Promise<Ff15OpenCodeModelCatalogSnapshot | null>
>();

export interface Ff15OpenCodeModelCatalogSnapshot {
	generatedAt: string;
	models: Ff15OpenCodeModelDefinition[];
	opencodeVersion: string;
	sourceCommand: string;
}

export interface Ff15OpenCodeModelCatalogReadResult {
	lastError: string | null;
	refreshState: "error" | "ready" | "refreshing" | "unavailable";
	snapshot: Ff15OpenCodeModelCatalogSnapshot | null;
	stale: boolean;
}

export interface Ff15OpenCodeModelCatalogLoader {
	readCatalog: (options: {
		waitForLatest?: boolean;
		workspaceRoot: string;
	}) => Promise<Ff15OpenCodeModelCatalogReadResult>;
}

interface Ff15OpenCodeExecOptions {
	cwd: string;
	encoding: "utf-8";
	maxBuffer: number;
	shell?: boolean;
}

const execFileWithOutput = (
	file: string,
	args: string[],
	options: Ff15OpenCodeExecOptions
): Promise<{ stderr: string; stdout: string }> =>
	new Promise((resolve, reject) => {
		execFile(file, args, options, (error, stdout, stderr) => {
			if (error) {
				reject(error);
				return;
			}

			resolve({ stderr, stdout });
		});
	});

const createOpencodeExecOptions = (input: {
	maxBuffer: number;
	workspaceRoot: string;
}): Ff15OpenCodeExecOptions => ({
	cwd: input.workspaceRoot,
	encoding: "utf-8",
	maxBuffer: input.maxBuffer,
	...(process.platform === "win32" ? { shell: true } : {}),
});

const advanceStringState = (
	character: string,
	state: { escaped: boolean; inString: boolean }
): { escaped: boolean; inString: boolean } => {
	if (state.escaped) {
		return { escaped: false, inString: true };
	}

	if (character === "\\") {
		return { escaped: true, inString: true };
	}

	if (character === '"') {
		return { escaped: false, inString: false };
	}

	return state;
};

const advanceJsonReaderState = (input: {
	character: string | undefined;
	depth: number;
	escaped: boolean;
	inString: boolean;
}): { depth: number; escaped: boolean; inString: boolean } => {
	if (input.inString) {
		if (!input.character) {
			return {
				depth: input.depth,
				escaped: input.escaped,
				inString: true,
			};
		}

		const nextStringState = advanceStringState(input.character, {
			escaped: input.escaped,
			inString: input.inString,
		});

		return {
			depth: input.depth,
			escaped: nextStringState.escaped,
			inString: nextStringState.inString,
		};
	}

	if (input.character === '"') {
		return { depth: input.depth, escaped: false, inString: true };
	}

	if (input.character === "{") {
		return {
			depth: input.depth + 1,
			escaped: false,
			inString: false,
		};
	}

	if (input.character === "}") {
		return {
			depth: input.depth - 1,
			escaped: false,
			inString: false,
		};
	}

	return { depth: input.depth, escaped: false, inString: false };
};

const skipWhitespace = (input: string, index: number): number => {
	let nextIndex = index;
	while (
		nextIndex < input.length &&
		WHITESPACE_PATTERN.test(input[nextIndex] ?? "")
	) {
		nextIndex += 1;
	}
	return nextIndex;
};

const readHeaderLine = (
	input: string,
	index: number
): { line: string; nextIndex: number } => {
	let nextIndex = index;

	while (
		nextIndex < input.length &&
		input[nextIndex] !== "\n" &&
		input[nextIndex] !== "\r"
	) {
		nextIndex += 1;
	}

	const line = input.slice(index, nextIndex).trim();

	while (
		nextIndex < input.length &&
		(input[nextIndex] === "\n" || input[nextIndex] === "\r")
	) {
		nextIndex += 1;
	}

	return { line, nextIndex };
};

const readJsonObject = (
	input: string,
	index: number
): { json: string; nextIndex: number } => {
	let depth = 0;
	let escaped = false;
	let inString = false;

	for (let nextIndex = index; nextIndex < input.length; nextIndex += 1) {
		const character = input[nextIndex];
		({ depth, escaped, inString } = advanceJsonReaderState({
			character,
			depth,
			escaped,
			inString,
		}));

		if (!inString && depth === 0) {
			return {
				json: input.slice(index, nextIndex + 1),
				nextIndex: nextIndex + 1,
			};
		}
	}

	throw new Error(
		"Failed to parse opencode model metadata: unterminated JSON object"
	);
};

export const parseOpencodeModelsVerboseOutput = (
	stdout: string
): Ff15OpenCodeModelDefinition[] => {
	const models: Ff15OpenCodeModelDefinition[] = [];

	let index = 0;
	while (index < stdout.length) {
		index = skipWhitespace(stdout, index);
		if (index >= stdout.length) {
			break;
		}

		const { line, nextIndex } = readHeaderLine(stdout, index);
		if (!line) {
			index = nextIndex;
			continue;
		}

		const jsonStart = skipWhitespace(stdout, nextIndex);
		if (jsonStart >= stdout.length || stdout[jsonStart] !== "{") {
			throw new Error(`Failed to parse opencode model metadata for ${line}`);
		}

		const { json, nextIndex: afterJson } = readJsonObject(stdout, jsonStart);
		const parsed = JSON.parse(json) as {
			name?: unknown;
			variants?: Record<string, unknown>;
		};

		models.push({
			efforts: Object.keys(parsed.variants ?? {}).map((variant) => ({
				label: variant,
				value: variant,
			})),
			id: line,
			name:
				typeof parsed.name === "string" && parsed.name.length > 0
					? parsed.name
					: line,
		});
		index = afterJson;
	}

	return models;
};

export const getFf15OpenCodeModelCatalogPath = (
	workspaceRoot: string
): string =>
	join(
		workspaceRoot,
		FF15_WORKSPACE_RUNTIME_DIR_NAME,
		"opencode-model-catalog.json"
	);

const ensureCatalogDirectory = (workspaceRoot: string): void => {
	mkdirSync(dirname(getFf15OpenCodeModelCatalogPath(workspaceRoot)), {
		recursive: true,
	});
};

const readSnapshot = (
	workspaceRoot: string
): Ff15OpenCodeModelCatalogSnapshot | null => {
	const filePath = getFf15OpenCodeModelCatalogPath(workspaceRoot);
	if (!existsSync(filePath)) {
		return null;
	}

	try {
		const parsed = JSON.parse(
			readFileSync(filePath, "utf-8")
		) as Partial<Ff15OpenCodeModelCatalogSnapshot>;
		return {
			generatedAt: parsed.generatedAt ?? "",
			models: Array.isArray(parsed.models) ? parsed.models : [],
			opencodeVersion: parsed.opencodeVersion ?? "unknown",
			sourceCommand: parsed.sourceCommand ?? SOURCE_COMMAND,
		};
	} catch {
		return null;
	}
};

const writeSnapshot = (
	workspaceRoot: string,
	snapshot: Ff15OpenCodeModelCatalogSnapshot
): void => {
	ensureCatalogDirectory(workspaceRoot);
	writeFileSync(
		getFf15OpenCodeModelCatalogPath(workspaceRoot),
		JSON.stringify(snapshot, null, 2),
		"utf-8"
	);
};

const readOpencodeVersion = async (workspaceRoot: string): Promise<string> => {
	try {
		const result = await execFileWithOutput(
			"opencode",
			["--version"],
			createOpencodeExecOptions({
				maxBuffer: 1024 * 1024,
				workspaceRoot,
			})
		);

		return result.stdout.trim() || "unknown";
	} catch {
		return "unknown";
	}
};

const createSnapshot = async (
	workspaceRoot: string
): Promise<Ff15OpenCodeModelCatalogSnapshot> => {
	const [modelsResult, version] = await Promise.all([
		execFileWithOutput(
			"opencode",
			["models", "--verbose"],
			createOpencodeExecOptions({
				maxBuffer: 10 * 1024 * 1024,
				workspaceRoot,
			})
		),
		readOpencodeVersion(workspaceRoot),
	]);

	return {
		generatedAt: new Date().toISOString(),
		models: parseOpencodeModelsVerboseOutput(modelsResult.stdout),
		opencodeVersion: version,
		sourceCommand: SOURCE_COMMAND,
	};
};

const resolveRefreshState = (
	workspaceRoot: string,
	snapshot: Ff15OpenCodeModelCatalogSnapshot | null
): Ff15OpenCodeModelCatalogReadResult["refreshState"] => {
	if (refreshPromiseByWorkspace.has(workspaceRoot)) {
		return "refreshing";
	}

	if (snapshot) {
		return lastErrorByWorkspace.get(workspaceRoot) ? "error" : "ready";
	}

	return "unavailable";
};

export const refreshFf15OpenCodeModelCatalog = (
	workspaceRoot: string
): Promise<Ff15OpenCodeModelCatalogSnapshot | null> => {
	const activeRefresh = refreshPromiseByWorkspace.get(workspaceRoot);
	if (activeRefresh) {
		return activeRefresh;
	}

	hasAttemptedRefreshByWorkspace.set(workspaceRoot, true);
	const refreshPromise = createSnapshot(workspaceRoot)
		.then((snapshot) => {
			writeSnapshot(workspaceRoot, snapshot);
			lastErrorByWorkspace.set(workspaceRoot, null);
			return snapshot;
		})
		.catch((error) => {
			lastErrorByWorkspace.set(
				workspaceRoot,
				error instanceof Error ? error.message : String(error)
			);
			throw error;
		})
		.finally(() => {
			refreshPromiseByWorkspace.delete(workspaceRoot);
		});

	refreshPromiseByWorkspace.set(workspaceRoot, refreshPromise);
	return refreshPromise;
};

export const readFf15OpenCodeModelCatalog = async (options: {
	waitForLatest?: boolean;
	workspaceRoot: string;
}): Promise<Ff15OpenCodeModelCatalogReadResult> => {
	const { workspaceRoot } = options;
	const snapshotBeforeRead = readSnapshot(workspaceRoot);
	let needsInitialRefresh = false;
	if (!hasAttemptedRefreshByWorkspace.get(workspaceRoot)) {
		needsInitialRefresh = true;
	} else if (!snapshotBeforeRead) {
		needsInitialRefresh = true;
	}

	if (options.waitForLatest) {
		const activeRefresh = refreshPromiseByWorkspace.get(workspaceRoot);
		if (activeRefresh) {
			try {
				await activeRefresh;
			} catch {
				// fall through to last successful snapshot if available
			}
		} else if (needsInitialRefresh) {
			try {
				await refreshFf15OpenCodeModelCatalog(workspaceRoot);
			} catch {
				// fall through to last successful snapshot if available
			}
		}
	}

	const snapshot = readSnapshot(workspaceRoot);
	const lastError = lastErrorByWorkspace.get(workspaceRoot) ?? null;

	return {
		lastError,
		refreshState: resolveRefreshState(workspaceRoot, snapshot),
		snapshot,
		stale: Boolean(snapshot && lastError),
	};
};

export const createFf15OpenCodeModelCatalogLoader =
	(): Ff15OpenCodeModelCatalogLoader => ({
		readCatalog: readFf15OpenCodeModelCatalog,
	});

export const createDefaultMissionOpenCodeModelCatalogResolution = (input: {
	defaultCatalog: readonly Ff15OpenCodeModelDefinition[];
	mission: Pick<Ff15MissionRecord, "providerId">;
}) => ({
	modelCatalog: [...input.defaultCatalog],
	modelCatalogStatusMessage: null,
	modelSelectionDisabledReason: null,
});

export const resolveMissionOpenCodeModelCatalog = async (input: {
	defaultCatalog: readonly Ff15OpenCodeModelDefinition[];
	loadOpenCodeModelCatalog?: (
		workspaceRoot: string
	) =>
		| Promise<Ff15OpenCodeModelCatalogReadResult>
		| Ff15OpenCodeModelCatalogReadResult;
	mission: Pick<Ff15MissionRecord, "providerId" | "workspaceRoot">;
}): Promise<{
	modelCatalog: Ff15OpenCodeModelDefinition[];
	modelCatalogStatusMessage: string | null;
	modelSelectionDisabledReason: string | null;
}> => {
	if (input.mission.providerId !== "opencode") {
		return {
			modelCatalog: [...input.defaultCatalog],
			modelCatalogStatusMessage: null,
			modelSelectionDisabledReason: null,
		};
	}

	if (!(input.loadOpenCodeModelCatalog && input.mission.workspaceRoot)) {
		return {
			modelCatalog: [...input.defaultCatalog],
			modelCatalogStatusMessage: null,
			modelSelectionDisabledReason: null,
		};
	}

	const result = await input.loadOpenCodeModelCatalog(
		input.mission.workspaceRoot
	);
	if (result.snapshot) {
		return {
			modelCatalog: [...result.snapshot.models],
			modelCatalogStatusMessage: result.stale
				? `Using cached OpenCode models. ${result.lastError ?? "Refresh failed."}`
				: null,
			modelSelectionDisabledReason: null,
		};
	}

	return {
		modelCatalog: [],
		modelCatalogStatusMessage: null,
		modelSelectionDisabledReason: result.lastError
			? `FF15 could not refresh OpenCode models: ${result.lastError}`
			: "FF15 could not resolve any OpenCode models for this workspace.",
	};
};

export const resetFf15OpenCodeModelCatalogStateForTests = (): void => {
	lastErrorByWorkspace.clear();
	hasAttemptedRefreshByWorkspace.clear();
	refreshPromiseByWorkspace.clear();
};
