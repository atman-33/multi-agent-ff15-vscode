import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse, parseDocument } from "yaml";

export type Ff15ProjectsContextSourceKind = "ff15";
export type Ff15ProjectsContextLanguageName = "en" | "ja";

export interface Ff15ProjectsContextReadySnapshot {
	status: "ready";
	sourceKind: Ff15ProjectsContextSourceKind;
	sourcePath: string;
	bootstrapped: boolean;
	activeProjects: string[];
	profiles: Ff15ProjectsContextProfile[];
	languageName: Ff15ProjectsContextLanguageName;
	openspec: {
		path: string | null;
		sourceProjectId: string | null;
	};
	error: null;
}

export interface Ff15ProjectsContextProfile {
	id: string;
	warnings: string[];
}

export interface Ff15ProjectsContextErrorSnapshot {
	status: "error";
	sourceKind: Ff15ProjectsContextSourceKind | null;
	sourcePath: string | null;
	bootstrapped: boolean;
	activeProjects: string[];
	profiles: [];
	languageName: null;
	openspec: {
		path: null;
		sourceProjectId: null;
	};
	error: string;
}

export type Ff15ProjectsContextSnapshot =
	| Ff15ProjectsContextReadySnapshot
	| Ff15ProjectsContextErrorSnapshot;

export interface Ff15ProjectsContextDraft {
	activeProjects: string[];
	languageName: Ff15ProjectsContextLanguageName;
	openspec: {
		projectId: string | null;
	};
}

const BOOTSTRAP_CONFIG_CONTENT = [
	"active_projects:",
	"  - default",
	"",
	"language: en",
	"",
	"openspec:",
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
	const harnessSource = resolveHarnessSource(input.workspaceRoot);
	if (harnessSource.status === "error") {
		return buildErrorSnapshot({
			error: harnessSource.error,
			sourceKind: harnessSource.sourceKind,
			sourcePath: harnessSource.harnessRoot,
			bootstrapped: harnessSource.bootstrapped,
		});
	}

	return loadHarnessSnapshot({
		harnessRoot: harnessSource.harnessRoot,
		sourceKind: harnessSource.sourceKind,
		bootstrapped: harnessSource.bootstrapped,
	});
};

export const saveFf15ProjectsContext = (input: {
	draft: Ff15ProjectsContextDraft;
	workspaceRoot: string;
}): Ff15ProjectsContextSnapshot => {
	const harnessSource = resolveHarnessSource(input.workspaceRoot);
	if (harnessSource.status === "error") {
		throw harnessSource.error;
	}

	const configPath = join(harnessSource.harnessRoot, "config", "config.yaml");
	const configDocument = parseDocument(readFileSync(configPath, "utf8"));
	if (configDocument.errors.length > 0) {
		throw (
			configDocument.errors[0] ?? new Error(`Failed to parse ${configPath}.`)
		);
	}

	const normalizedActiveProjects = normalizeActiveProjects(
		input.draft.activeProjects
	);
	const languageName = getLanguageName(input.draft.languageName);
	const openspecProjectId = resolveOpenspecProjectId({
		harnessRoot: harnessSource.harnessRoot,
		projectId: input.draft.openspec.projectId,
		activeProjects: normalizedActiveProjects,
	});

	configDocument.set("active_projects", normalizedActiveProjects);
	configDocument.set("language", languageName);
	// Drop the legacy `openspec.mode` key; resolution is now driven by project_id.
	configDocument.deleteIn(["openspec", "mode"]);
	if (openspecProjectId) {
		configDocument.setIn(["openspec", "project_id"], openspecProjectId);
	} else {
		configDocument.deleteIn(["openspec", "project_id"]);
	}

	writeFileSync(configPath, configDocument.toString(), "utf8");

	return loadHarnessSnapshot({
		harnessRoot: harnessSource.harnessRoot,
		sourceKind: harnessSource.sourceKind,
		bootstrapped: harnessSource.bootstrapped,
	});
};

const loadHarnessSnapshot = (input: {
	harnessRoot: string;
	sourceKind: Ff15ProjectsContextSourceKind;
	bootstrapped: boolean;
}): Ff15ProjectsContextSnapshot => {
	try {
		const harnessOwnerRoot = getHarnessOwnerRoot(input.harnessRoot);
		const configPath = join(input.harnessRoot, "config", "config.yaml");
		const configRecord = parseYamlRecord(configPath);
		const activeProjects = getStringArray(configRecord.active_projects);
		const languageName = getLanguageName(configRecord.language);
		const profiles = loadProjectProfiles({
			harnessOwnerRoot,
			harnessRoot: input.harnessRoot,
		});
		const openspecRecord = getOptionalRecord(configRecord.openspec, "openspec");
		// Legacy compatibility: an explicit `mode: harness` forces the working
		// directory even if a stale `project_id` lingers in the config.
		const legacyHarnessMode = openspecRecord.mode === "harness";
		const openspecProjectId = legacyHarnessMode
			? null
			: getOptionalNonEmptyString(openspecRecord.project_id);
		const openspecProjectExists = openspecProjectId
			? existsSync(
					join(input.harnessRoot, "projects", `${openspecProjectId}.yaml`)
				)
			: false;

		if (openspecProjectId && openspecProjectExists) {
			const openspecProjectRecord = parseProjectProfileRecord({
				harnessRoot: input.harnessRoot,
				projectId: openspecProjectId,
			});
			const openspecRoot = getOptionalNonEmptyString(
				openspecProjectRecord.openspec_root
			);

			return {
				activeProjects,
				error: null,
				profiles,
				languageName,
				openspec: {
					path: openspecRoot
						? resolve(harnessOwnerRoot, openspecRoot, "openspec")
						: null,
					sourceProjectId: openspecProjectId,
				},
				sourceKind: input.sourceKind,
				sourcePath: input.harnessRoot,
				bootstrapped: input.bootstrapped,
				status: "ready",
			};
		}

		return {
			activeProjects,
			error: null,
			profiles,
			languageName,
			openspec: {
				path: join(harnessOwnerRoot, "openspec"),
				sourceProjectId: null,
			},
			sourceKind: input.sourceKind,
			sourcePath: input.harnessRoot,
			bootstrapped: input.bootstrapped,
			status: "ready",
		};
	} catch (error) {
		return buildErrorSnapshot({
			error,
			sourceKind: input.sourceKind,
			sourcePath: input.harnessRoot,
			bootstrapped: input.bootstrapped,
		});
	}
};

const bootstrapFf15Harness = (ff15Root: string) => {
	ensureTextFile(
		join(ff15Root, "config", "config.yaml"),
		BOOTSTRAP_CONFIG_CONTENT
	);
	ensureTextFile(
		join(ff15Root, "projects", "default.yaml"),
		BOOTSTRAP_DEFAULT_PROJECT_CONTENT
	);
	ensureTextFile(
		join(ff15Root, "projects", "_template.yaml"),
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

const loadProjectProfiles = (input: {
	harnessOwnerRoot: string;
	harnessRoot: string;
}): Ff15ProjectsContextProfile[] => {
	const projectsRoot = join(input.harnessRoot, "projects");
	if (!isDirectory(projectsRoot)) {
		return [];
	}

	return readdirSync(projectsRoot)
		.filter((entry) => entry.endsWith(".yaml") && !entry.startsWith("_"))
		.map((entry) => {
			const profilePath = join(projectsRoot, entry);
			const profileRecord = parseYamlRecord(profilePath);
			const id = getNonEmptyString(profileRecord.id, `id in ${profilePath}`);
			return {
				id,
				warnings: getProfileWarnings({
					harnessOwnerRoot: input.harnessOwnerRoot,
					profileRecord,
				}),
			};
		})
		.sort((left, right) => left.id.localeCompare(right.id));
};

const getProfileWarnings = (input: {
	harnessOwnerRoot: string;
	profileRecord: Record<string, unknown>;
}) => {
	const warnings: string[] = [];
	const openspecRoot = getOptionalNonEmptyString(
		input.profileRecord.openspec_root
	);
	if (!openspecRoot) {
		warnings.push("Missing openspec_root for project profile.");
	} else if (!existsSync(resolve(input.harnessOwnerRoot, openspecRoot))) {
		warnings.push("Resolved openspec_root path does not exist.");
	}

	const repos = Array.isArray(input.profileRecord.repos)
		? input.profileRecord.repos
		: [];
	if (repos.length === 0) {
		warnings.push("No repositories are configured for this project profile.");
	}

	const { hasDefaultChecks, repoWarnings } = getProfileRepoWarnings({
		harnessOwnerRoot: input.harnessOwnerRoot,
		repos,
	});
	warnings.push(...repoWarnings);

	if (!hasDefaultChecks) {
		warnings.push("No default_checks are configured for this project profile.");
	}

	return warnings;
};

const getProfileRepoWarnings = (input: {
	harnessOwnerRoot: string;
	repos: unknown[];
}) => {
	const warnings: string[] = [];
	let hasDefaultChecks = false;
	for (const repo of input.repos) {
		if (!repo || typeof repo !== "object" || Array.isArray(repo)) {
			warnings.push(
				"Encountered an invalid repo entry in the project profile."
			);
			continue;
		}

		const repoRecord = repo as Record<string, unknown>;
		const repoRoot = getOptionalNonEmptyString(repoRecord.root);
		if (!repoRoot) {
			warnings.push("Missing repo root in the project profile.");
		} else if (!existsSync(resolve(input.harnessOwnerRoot, repoRoot))) {
			warnings.push("Resolved repo root path does not exist.");
		}

		if (
			Array.isArray(repoRecord.default_checks) &&
			repoRecord.default_checks.length > 0
		) {
			hasDefaultChecks = true;
		}
	}

	return { hasDefaultChecks, repoWarnings: warnings };
};

const resolveOpenspecProjectId = (input: {
	harnessRoot: string;
	projectId: string | null;
	activeProjects: string[];
}): string | null => {
	const projectId = getOptionalNonEmptyString(input.projectId);
	if (!(projectId && input.activeProjects.includes(projectId))) {
		return null;
	}

	const profilePath = join(input.harnessRoot, "projects", `${projectId}.yaml`);
	return existsSync(profilePath) ? projectId : null;
};

const getLanguageName = (value: unknown): Ff15ProjectsContextLanguageName => {
	if (value === "en" || value === "ja") {
		return value;
	}

	if (value === undefined) {
		return "en";
	}

	throw new Error("Expected language to be en or ja.");
};

const getOptionalRecord = (
	value: unknown,
	key: string
): Record<string, unknown> => {
	if (value === undefined || value === null) {
		return {};
	}

	if (typeof value !== "object" || Array.isArray(value)) {
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

const normalizeActiveProjects = (value: string[]) =>
	Array.from(new Set(getStringArray(value).map((entry) => entry.trim()))).sort(
		(left, right) => left.localeCompare(right)
	);

const getNonEmptyString = (value: unknown, key: string): string => {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`Expected ${key} to be a non-empty string.`);
	}

	return value;
};

const getOptionalNonEmptyString = (value: unknown) => {
	if (typeof value !== "string") {
		return null;
	}

	const trimmedValue = value.trim();
	return trimmedValue.length > 0 ? trimmedValue : null;
};

const getHarnessOwnerRoot = (harnessRoot: string): string =>
	dirname(harnessRoot);

type Ff15ProjectsHarnessSource =
	| {
			harnessRoot: string;
			sourceKind: Ff15ProjectsContextSourceKind;
			bootstrapped: boolean;
			status: "ready";
	  }
	| {
			error: unknown;
			harnessRoot: string;
			sourceKind: Ff15ProjectsContextSourceKind;
			bootstrapped: boolean;
			status: "error";
	  };

const createReadyHarnessSource = (
	harnessRoot: string,
	sourceKind: Ff15ProjectsContextSourceKind,
	bootstrapped: boolean
): Ff15ProjectsHarnessSource => ({
	harnessRoot,
	sourceKind,
	bootstrapped,
	status: "ready",
});

const createErrorHarnessSource = (
	error: unknown,
	harnessRoot: string,
	sourceKind: Ff15ProjectsContextSourceKind,
	bootstrapped: boolean
): Ff15ProjectsHarnessSource => ({
	error,
	harnessRoot,
	sourceKind,
	bootstrapped,
	status: "error",
});

const resolveHarnessSource = (
	workspaceRoot: string
): Ff15ProjectsHarnessSource => {
	const ff15Root = join(workspaceRoot, ".ff15");
	const configPath = join(ff15Root, "config", "config.yaml");

	if (existsSync(configPath)) {
		return createReadyHarnessSource(ff15Root, "ff15", false);
	}

	try {
		bootstrapFf15Harness(ff15Root);
		return createReadyHarnessSource(ff15Root, "ff15", true);
	} catch (error) {
		return createErrorHarnessSource(error, ff15Root, "ff15", true);
	}
};

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
	bootstrapped: boolean;
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
		error: message,
		profiles: [],
		languageName: null,
		openspec: {
			path: null,
			sourceProjectId: null,
		},
		sourceKind: input.sourceKind,
		sourcePath: input.sourcePath,
		bootstrapped: input.bootstrapped,
		status: "error",
	};
};
