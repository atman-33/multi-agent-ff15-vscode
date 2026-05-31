import {
	existsSync,
	mkdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";

export type Ff15ProjectsContextSourceKind = "agents" | "ff15";
export type Ff15ProjectsContextOpenspecMode = "project" | "harness";
export type Ff15ProjectsContextConfigVersion = 2 | 3;

export interface Ff15ProjectsContextReadySnapshot {
	status: "ready";
	sourceKind: Ff15ProjectsContextSourceKind;
	sourcePath: string;
	configVersion: Ff15ProjectsContextConfigVersion;
	activeProjects: string[];
	openspec: {
		mode: Ff15ProjectsContextOpenspecMode;
		path: string;
		sourceProjectId: string | null;
	};
	error: null;
}

export interface Ff15ProjectsContextErrorSnapshot {
	status: "error";
	sourceKind: Ff15ProjectsContextSourceKind | null;
	sourcePath: string | null;
	configVersion: null;
	activeProjects: string[];
	openspec: {
		mode: null;
		path: null;
		sourceProjectId: null;
	};
	error: string;
}

export type Ff15ProjectsContextSnapshot =
	| Ff15ProjectsContextReadySnapshot
	| Ff15ProjectsContextErrorSnapshot;

const BOOTSTRAP_CONFIG_CONTENT = [
	"version: 3",
	"",
	"active_projects:",
	"  - default",
	"",
	"openspec:",
	"  mode: project",
	"  project_id: default",
	"",
].join("\n");

const BOOTSTRAP_DEFAULT_PROJECT_CONTENT = [
	"id: default",
	"openspec_root: .",
	"repos:",
	"  - id: extension",
	"    root: .",
	"summary: |",
	"  Default local FF15 workspace profile.",
	"",
].join("\n");

const BOOTSTRAP_TEMPLATE_PROJECT_CONTENT = [
	"id: example-project",
	"openspec_root: ../example-project",
	"repos:",
	"  - id: app",
	"    root: ../example-project",
	"summary: |",
	"  Short project description for the active development target.",
	"",
].join("\n");

export const resolveFf15ProjectsContext = (input: {
	workspaceRoot: string;
}): Ff15ProjectsContextSnapshot => {
	const agentsHarnessRoot = join(input.workspaceRoot, ".agents", "harness");
	const ff15HarnessRoot = join(input.workspaceRoot, ".ff15", "harness");

	if (isDirectory(agentsHarnessRoot)) {
		return loadHarnessSnapshot({
			harnessRoot: agentsHarnessRoot,
			sourceKind: "agents",
		});
	}

	if (isDirectory(ff15HarnessRoot)) {
		return loadHarnessSnapshot({
			harnessRoot: ff15HarnessRoot,
			sourceKind: "ff15",
		});
	}

	try {
		bootstrapFf15Harness(ff15HarnessRoot);
	} catch (error) {
		return buildErrorSnapshot({
			error,
			sourceKind: "ff15",
			sourcePath: ff15HarnessRoot,
		});
	}

	return loadHarnessSnapshot({
		harnessRoot: ff15HarnessRoot,
		sourceKind: "ff15",
	});
};

const loadHarnessSnapshot = (input: {
	harnessRoot: string;
	sourceKind: Ff15ProjectsContextSourceKind;
}): Ff15ProjectsContextSnapshot => {
	try {
		const harnessOwnerRoot = getHarnessOwnerRoot(input.harnessRoot);
		const configPath = join(input.harnessRoot, "config", "agent-harness.yaml");
		const configRecord = parseYamlRecord(configPath);
		const configVersion = getConfigVersion(configRecord.version);
		const activeProjects = getStringArray(configRecord.active_projects);
		const openspecRecord = getRecord(configRecord.openspec, "openspec");
		const openspecMode = getOpenspecMode(openspecRecord.mode);

		if (openspecMode === "project") {
			const openspecProjectId = getNonEmptyString(
				openspecRecord.project_id,
				"openspec.project_id"
			);
			const openspecProjectRecord = parseProjectProfileRecord({
				harnessRoot: input.harnessRoot,
				projectId: openspecProjectId,
			});
			const openspecRoot = getNonEmptyString(
				openspecProjectRecord.openspec_root,
				"openspec_root"
			);

			return {
				activeProjects,
				configVersion,
				error: null,
				openspec: {
					mode: "project",
					path: resolve(harnessOwnerRoot, openspecRoot, "openspec"),
					sourceProjectId: openspecProjectId,
				},
				sourceKind: input.sourceKind,
				sourcePath: input.harnessRoot,
				status: "ready",
			};
		}

		return {
			activeProjects,
			configVersion,
			error: null,
			openspec: {
				mode: "harness",
				path: join(harnessOwnerRoot, "openspec"),
				sourceProjectId: null,
			},
			sourceKind: input.sourceKind,
			sourcePath: input.harnessRoot,
			status: "ready",
		};
	} catch (error) {
		return buildErrorSnapshot({
			error,
			sourceKind: input.sourceKind,
			sourcePath: input.harnessRoot,
		});
	}
};

const bootstrapFf15Harness = (ff15HarnessRoot: string) => {
	ensureTextFile(
		join(ff15HarnessRoot, "config", "agent-harness.yaml"),
		BOOTSTRAP_CONFIG_CONTENT
	);
	ensureTextFile(
		join(ff15HarnessRoot, "projects", "default.yaml"),
		BOOTSTRAP_DEFAULT_PROJECT_CONTENT
	);
	ensureTextFile(
		join(ff15HarnessRoot, "projects", "_template.yaml"),
		BOOTSTRAP_TEMPLATE_PROJECT_CONTENT
	);
};

const ensureTextFile = (path: string, content: string) => {
	if (existsSync(path)) {
		return;
	}

	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, "utf8");
};

const parseYamlRecord = (path: string): Record<string, unknown> => {
	const source = readFileSync(path, "utf8");
	const parsed = parse(source) as unknown;
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error(`Expected a mapping object in ${path}.`);
	}

	return parsed as Record<string, unknown>;
};

const parseProjectProfileRecord = (input: {
	harnessRoot: string;
	projectId: string;
}) => {
	const profilePath = join(
		input.harnessRoot,
		"projects",
		`${input.projectId}.yaml`
	);
	if (!existsSync(profilePath)) {
		throw new Error(
			`Missing profile for openspec.project_id '${input.projectId}' at ${profilePath}.`
		);
	}

	return parseYamlRecord(profilePath);
};

const getConfigVersion = (value: unknown): Ff15ProjectsContextConfigVersion => {
	if (value === 2 || value === "2") {
		return 2;
	}

	if (value === 3 || value === "3") {
		return 3;
	}

	throw new Error("Expected version to be 2 or 3.");
};

const getRecord = (value: unknown, key: string): Record<string, unknown> => {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`Expected ${key} to be a mapping object.`);
	}

	return value as Record<string, unknown>;
};

const getStringArray = (value: unknown): string[] => {
	if (!Array.isArray(value)) {
		throw new Error("Expected active_projects to be an array.");
	}

	return value.filter(
		(entry): entry is string =>
			typeof entry === "string" && entry.trim().length > 0
	);
};

const getNonEmptyString = (value: unknown, key: string): string => {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`Expected ${key} to be a non-empty string.`);
	}

	return value;
};

const getOpenspecMode = (value: unknown): Ff15ProjectsContextOpenspecMode => {
	if (value === "project" || value === "harness") {
		return value;
	}

	throw new Error("Expected openspec.mode to be project or harness.");
};

const getHarnessOwnerRoot = (harnessRoot: string): string =>
	dirname(dirname(harnessRoot));

const isDirectory = (path: string) => {
	if (!existsSync(path)) {
		return false;
	}

	return statSync(path).isDirectory();
};

const buildErrorSnapshot = (input: {
	error: unknown;
	sourceKind: Ff15ProjectsContextSourceKind | null;
	sourcePath: string | null;
}): Ff15ProjectsContextErrorSnapshot => {
	const detail =
		input.error instanceof Error
			? input.error.message
			: "Failed to resolve FF15 Projects context.";
	const message = input.sourcePath
		? `Failed to resolve ${input.sourcePath}: ${detail}`
		: detail;

	return {
		activeProjects: [],
		configVersion: null,
		error: message,
		openspec: {
			mode: null,
			path: null,
			sourceProjectId: null,
		},
		sourceKind: input.sourceKind,
		sourcePath: input.sourcePath,
		status: "error",
	};
};
