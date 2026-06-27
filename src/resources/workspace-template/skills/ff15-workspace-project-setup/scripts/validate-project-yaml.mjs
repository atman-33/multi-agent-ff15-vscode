#!/usr/bin/env node

// Validate workspace-local FF15 project profiles under .ff15/projects and,
// when reachable, the activation consistency in .ff15/config/config.yaml.
//
// Usage:
//   node validate-project-yaml.mjs <file-or-directory> [...more-paths]
//
// Accepts profile YAML files, the .ff15/projects directory, or the .ff15
// directory (which additionally checks config.yaml consistency). Prints
// "OK <path>" / "ERROR <path>" lines and exits non-zero on any error.
//
// Runs on Windows and WSL with only `node`. YAML parsing prefers the `yaml`
// package when resolvable and otherwise falls back to a minimal parser scoped
// to the flat project/config schema.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import {
	basename,
	dirname,
	extname,
	isAbsolute,
	join,
	relative,
	resolve,
} from "node:path";
import process from "node:process";

const PROFILE_KEYS = new Set(["id", "openspec_root", "repos", "summary"]);
const REPO_KEYS = new Set(["id", "root", "default_checks"]);

const printUsage = () => {
	console.log(
		"Usage: node .claude/skills/ff15-workspace-project-setup/scripts/validate-project-yaml.mjs <file-or-directory> [...more-paths]"
	);
};

const toDisplayPath = (filePath) => {
	const relativePath = relative(process.cwd(), filePath);
	if (
		!relativePath ||
		relativePath.startsWith("..") ||
		isAbsolute(relativePath)
	) {
		return filePath;
	}

	return relativePath.split("\\").join("/");
};

const isYamlFile = (filePath) => {
	const extension = extname(filePath).toLowerCase();
	return extension === ".yaml" || extension === ".yml";
};

const isProfileFile = (filePath) =>
	isYamlFile(filePath) && !basename(filePath).startsWith("_");

const collectFilesFromDirectory = (directoryPath, files) => {
	for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
		const childPath = join(directoryPath, entry.name);
		if (entry.isDirectory()) {
			collectFilesFromDirectory(childPath, files);
			continue;
		}

		if (entry.isFile() && isProfileFile(childPath)) {
			files.add(resolve(childPath));
		}
	}
};

// Resolve each input into the set of profile YAML files to validate and the set
// of config.yaml files to cross-check.
const collectTargets = (inputPaths) => {
	const profileFiles = new Set();
	const configFiles = new Set();

	for (const inputPath of inputPaths) {
		const resolvedPath = resolve(process.cwd(), inputPath);
		if (!existsSync(resolvedPath)) {
			throw new Error(`Path does not exist: ${inputPath}`);
		}

		if (statSync(resolvedPath).isDirectory()) {
			const projectsDir =
				basename(resolvedPath) === ".ff15"
					? join(resolvedPath, "projects")
					: resolvedPath;
			if (existsSync(projectsDir) && statSync(projectsDir).isDirectory()) {
				collectFilesFromDirectory(projectsDir, profileFiles);
			}

			const configPath = join(resolvedPath, "config", "config.yaml");
			if (basename(resolvedPath) === ".ff15" && existsSync(configPath)) {
				configFiles.add(resolve(configPath));
			}
			continue;
		}

		if (basename(resolvedPath) === "config.yaml") {
			configFiles.add(resolvedPath);
			continue;
		}

		if (isProfileFile(resolvedPath)) {
			profileFiles.add(resolvedPath);
		}
	}

	return {
		profileFiles: [...profileFiles].sort(),
		configFiles: [...configFiles].sort(),
	};
};

// The workspace root is the parent of `.ff15`. Profile files live at
// `.ff15/projects/<id>.yaml`, so the workspace root is three levels up.
const getWorkspaceRoot = (filePath) => dirname(dirname(dirname(filePath)));

const getString = (value) => {
	if (typeof value !== "string") {
		return null;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
};

const isPlainObject = (value) =>
	Boolean(value) && typeof value === "object" && !Array.isArray(value);

const loadYamlParser = async () => {
	try {
		const module = await import("yaml");
		const parse = module.parse ?? module.default?.parse;
		if (typeof parse === "function") {
			return (source) => parse(source);
		}
	} catch {
		// Fall back to the built-in minimal parser below.
	}

	return parseMinimalYaml;
};

// Minimal YAML reader scoped to the flat project/config schema: top-level
// scalars, `key: |` block scalars, and a `repos:` list of mappings. It is not a
// general YAML parser; it exists only so the validator runs with just `node`.
const parseMinimalYaml = (source) => {
	const lines = source.split(/\r?\n/);
	const root = {};
	let index = 0;

	const readBlockScalar = (parentIndent) => {
		const blockLines = [];
		while (index < lines.length) {
			const line = lines[index];
			if (line.trim() === "") {
				blockLines.push("");
				index += 1;
				continue;
			}

			const indent = line.length - line.trimStart().length;
			if (indent <= parentIndent) {
				break;
			}

			blockLines.push(line.slice(parentIndent + 2));
			index += 1;
		}

		while (blockLines.length > 0 && blockLines[blockLines.length - 1] === "") {
			blockLines.pop();
		}

		return `${blockLines.join("\n")}\n`;
	};

	const parseScalar = (raw) => {
		const value = raw.trim();
		if (value === "") {
			return null;
		}

		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			return value.slice(1, -1);
		}

		return value;
	};

	const readRepos = (parentIndent) => {
		const repos = [];
		let current = null;

		while (index < lines.length) {
			const line = lines[index];
			if (line.trim() === "") {
				index += 1;
				continue;
			}

			const indent = line.length - line.trimStart().length;
			if (indent <= parentIndent) {
				break;
			}

			const trimmed = line.trim();
			if (trimmed.startsWith("- ")) {
				current = {};
				repos.push(current);
				const rest = trimmed.slice(2);
				const separator = rest.indexOf(":");
				if (separator !== -1) {
					const key = rest.slice(0, separator).trim();
					current[key] = parseScalar(rest.slice(separator + 1));
				}
				index += 1;
				continue;
			}

			const separator = trimmed.indexOf(":");
			if (current && separator !== -1) {
				const key = trimmed.slice(0, separator).trim();
				const rawValue = trimmed.slice(separator + 1).trim();
				if (key === "default_checks" && rawValue === "") {
					index += 1;
					current[key] = readSequence(indent);
					continue;
				}
				current[key] = parseScalar(rawValue);
			}
			index += 1;
		}

		return repos;
	};

	const readSequence = (parentIndent) => {
		const items = [];
		while (index < lines.length) {
			const line = lines[index];
			if (line.trim() === "") {
				index += 1;
				continue;
			}

			const indent = line.length - line.trimStart().length;
			if (indent <= parentIndent || !line.trim().startsWith("- ")) {
				break;
			}

			items.push(parseScalar(line.trim().slice(2)));
			index += 1;
		}

		return items;
	};

	while (index < lines.length) {
		const line = lines[index];
		if (line.trim() === "" || line.trimStart().startsWith("#")) {
			index += 1;
			continue;
		}

		const indent = line.length - line.trimStart().length;
		if (indent !== 0) {
			index += 1;
			continue;
		}

		const trimmed = line.trim();
		const separator = trimmed.indexOf(":");
		if (separator === -1) {
			index += 1;
			continue;
		}

		const key = trimmed.slice(0, separator).trim();
		const rawValue = trimmed.slice(separator + 1).trim();
		index += 1;

		if (rawValue === "|" || rawValue === "|-" || rawValue === "|+") {
			root[key] = readBlockScalar(indent);
			continue;
		}

		if (rawValue === "") {
			if (key === "repos") {
				root[key] = readRepos(indent);
			} else if (index < lines.length && lines[index].trim().startsWith("- ")) {
				root[key] = readSequence(indent);
			} else {
				root[key] = readNestedMapping(indent);
			}
			continue;
		}

		root[key] = parseScalar(rawValue);
	}

	function readNestedMapping(parentIndent) {
		const mapping = {};
		while (index < lines.length) {
			const line = lines[index];
			if (line.trim() === "") {
				index += 1;
				continue;
			}

			const indent = line.length - line.trimStart().length;
			if (indent <= parentIndent) {
				break;
			}

			const trimmed = line.trim();
			const separator = trimmed.indexOf(":");
			if (separator === -1) {
				index += 1;
				continue;
			}

			const key = trimmed.slice(0, separator).trim();
			mapping[key] = parseScalar(trimmed.slice(separator + 1));
			index += 1;
		}

		return mapping;
	}

	return root;
};

const validateProfile = (filePath, parseYaml) => {
	const errors = [];
	const warnings = [];

	let raw;
	try {
		raw = parseYaml(readFileSync(filePath, "utf8"));
	} catch (error) {
		errors.push(
			`YAML parse failed: ${error instanceof Error ? error.message : String(error)}`
		);
		return { errors, warnings };
	}

	if (!isPlainObject(raw)) {
		errors.push("Profile file must parse to a mapping object.");
		return { errors, warnings };
	}

	const unexpectedKeys = Object.keys(raw).filter(
		(key) => !PROFILE_KEYS.has(key)
	);
	if (unexpectedKeys.length > 0) {
		errors.push(
			`Profile contains unexpected field(s): ${unexpectedKeys.join(", ")}. Profiles support only id, openspec_root, repos, and summary.`
		);
	}

	const workspaceRoot = getWorkspaceRoot(filePath);
	const expectedId = basename(filePath, extname(filePath));

	const id = getString(raw.id);
	if (id === null) {
		errors.push('Profile must define a non-empty "id".');
	} else if (id !== expectedId) {
		errors.push(
			`Profile "id" ("${id}") must match the file name stem ("${expectedId}"). Rename the file to ${id}.yaml or fix the id.`
		);
	}

	const openspecRoot = getString(raw.openspec_root);
	if (openspecRoot === null) {
		errors.push('Profile must define a non-empty "openspec_root".');
	} else if (!existsSync(resolve(workspaceRoot, openspecRoot))) {
		errors.push(`Resolved openspec_root path does not exist: ${openspecRoot}`);
	}

	if (!Array.isArray(raw.repos) || raw.repos.length === 0) {
		errors.push('Profile must define a non-empty "repos" array.');
	} else {
		let hasDefaultChecks = false;
		raw.repos.forEach((repo, repoIndex) => {
			if (!isPlainObject(repo)) {
				errors.push(`repos[${repoIndex}] must be a mapping object.`);
				return;
			}

			const repoUnexpected = Object.keys(repo).filter(
				(key) => !REPO_KEYS.has(key)
			);
			if (repoUnexpected.length > 0) {
				errors.push(
					`repos[${repoIndex}] contains unexpected field(s): ${repoUnexpected.join(", ")}. Repos support only id, root, and default_checks.`
				);
			}

			const repoRoot = getString(repo.root);
			if (repoRoot === null) {
				errors.push(`repos[${repoIndex}] must define a non-empty "root".`);
			} else if (!existsSync(resolve(workspaceRoot, repoRoot))) {
				errors.push(
					`repos[${repoIndex}] root path does not exist: ${repoRoot}`
				);
			}

			if (
				Array.isArray(repo.default_checks) &&
				repo.default_checks.length > 0
			) {
				hasDefaultChecks = true;
			}
		});

		if (!hasDefaultChecks) {
			warnings.push(
				"No default_checks are configured for any repo in this profile."
			);
		}
	}

	return { errors, warnings };
};

const validateConfig = (configPath, parseYaml) => {
	const errors = [];
	const warnings = [];

	let raw;
	try {
		raw = parseYaml(readFileSync(configPath, "utf8"));
	} catch (error) {
		errors.push(
			`YAML parse failed: ${error instanceof Error ? error.message : String(error)}`
		);
		return { errors, warnings };
	}

	if (!isPlainObject(raw)) {
		errors.push("Config file must parse to a mapping object.");
		return { errors, warnings };
	}

	const projectsDir = join(dirname(dirname(configPath)), "projects");
	const profileExists = (projectId) =>
		existsSync(join(projectsDir, `${projectId}.yaml`));

	const activeProjects = Array.isArray(raw.active_projects)
		? raw.active_projects.filter((entry) => getString(entry) !== null)
		: [];
	if (!Array.isArray(raw.active_projects)) {
		errors.push('Config must define "active_projects" as an array.');
	}

	for (const projectId of activeProjects) {
		if (!profileExists(projectId)) {
			errors.push(
				`active_projects references "${projectId}" but .ff15/projects/${projectId}.yaml does not exist.`
			);
		}
	}

	if (
		raw.language !== undefined &&
		raw.language !== "en" &&
		raw.language !== "ja"
	) {
		errors.push('Config "language" must be "en" or "ja".');
	}

	const openspec = isPlainObject(raw.openspec) ? raw.openspec : {};
	const openspecProjectId = getString(openspec.project_id);
	if (openspecProjectId !== null) {
		if (!activeProjects.includes(openspecProjectId)) {
			errors.push(
				`openspec.project_id "${openspecProjectId}" is not listed in active_projects.`
			);
		} else if (!profileExists(openspecProjectId)) {
			errors.push(
				`openspec.project_id "${openspecProjectId}" has no profile at .ff15/projects/${openspecProjectId}.yaml.`
			);
		}
	}

	return { errors, warnings };
};

const reportResult = (filePath, result) => {
	if (result.errors.length === 0) {
		console.log(`OK ${toDisplayPath(filePath)}`);
		for (const warning of result.warnings) {
			console.log(`  ! ${warning}`);
		}
		return false;
	}

	console.error(`ERROR ${toDisplayPath(filePath)}`);
	for (const message of result.errors) {
		console.error(`  - ${message}`);
	}
	for (const warning of result.warnings) {
		console.error(`  ! ${warning}`);
	}
	return true;
};

const main = async () => {
	const args = process.argv.slice(2);
	if (args.length === 0) {
		printUsage();
		process.exit(1);
	}

	if (args.some((argument) => argument === "-h" || argument === "--help")) {
		printUsage();
		process.exit(0);
	}

	let targets;
	try {
		targets = collectTargets(args);
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}

	if (targets.profileFiles.length === 0 && targets.configFiles.length === 0) {
		console.error(
			"No project profile YAML or config.yaml found in the provided paths."
		);
		process.exit(1);
	}

	const parseYaml = await loadYamlParser();
	let hasErrors = false;

	for (const filePath of targets.profileFiles) {
		if (reportResult(filePath, validateProfile(filePath, parseYaml))) {
			hasErrors = true;
		}
	}

	for (const configPath of targets.configFiles) {
		if (reportResult(configPath, validateConfig(configPath, parseYaml))) {
			hasErrors = true;
		}
	}

	if (hasErrors) {
		process.exit(1);
	}

	const total = targets.profileFiles.length + targets.configFiles.length;
	console.log(`Validated ${total} FF15 project file(s).`);
};

main();
