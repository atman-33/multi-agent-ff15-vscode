#!/usr/bin/env node

// Validate workspace-local FF15 operation files under .ff15/operations and
// referenced workspace-local facets under .ff15/facets.
//
// Usage:
//   node validate-operation-yaml.mjs <file-or-directory> [...more-paths]
//
// Accepts operation YAML files or the .ff15/operations directory. Prints
// "OK <path>" / "ERROR <path>" lines and exits non-zero on any error.
//
// Runs on Windows and WSL with only `node`. YAML parsing prefers the `yaml`
// package when resolvable and otherwise falls back to a minimal parser scoped
// to the FF15 operation schema (block-style mappings, sequences of mappings,
// scalar values, and `|`/`>` block scalars with chomping).

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

const VALID_AGENTS = new Set(["noctis", "ignis", "gladiolus", "prompto"]);
const TERMINAL_NEXT = new Set(["ABORT", "COMPLETE"]);
const LEGACY_OPERATION_FIELDS = [
	"initial_movement",
	"movements",
	"max_movements",
	"handoff_mode",
];
const CONTENT_SOURCE_KEYS = new Set(["file", "inline"]);
const OUTPUT_CONTRACT_KEYS = new Set(["report"]);
const OUTPUT_CONTRACT_REPORT_KEYS = new Set(["name", "format"]);
const STEP_KEYS = new Set([
	"name",
	"agent",
	"instruction",
	"output_contracts",
	"rules",
]);
const OPERATION_KEYS = new Set([
	"name",
	"description",
	"initial_step",
	"jobs",
	"instructions",
	"skills",
	"policies",
	"steps",
]);
const RULE_KEYS = new Set(["condition", "next"]);
const LEGACY_STEP_FIELD_MESSAGES = {
	edit: 'contains removed field "edit".',
	handoff_mode: 'contains removed field "handoff_mode".',
	pass_previous_response:
		'contains removed field "pass_previous_response".',
	job: 'contains removed field "job". Inline the guidance directly in "instruction" instead.',
	job_file:
		'contains removed field "job_file". Inline the guidance directly in "instruction" instead.',
	instruction_file:
		'contains removed field "instruction_file". Use "instruction: { file: ... }" or "instruction: { inline: ... }" instead.',
	skills:
		'contains removed field "skills". Reference a project skill inline with {{ facet_skill("name") }} or describe it in "instruction" instead.',
	knowledge:
		'contains removed field "knowledge". Reference a project skill inline with {{ facet_skill("name") }} or describe it in "instruction" instead.',
	knowledge_files:
		'contains removed field "knowledge_files". Reference a project skill inline with {{ facet_skill("name") }} or describe it in "instruction" instead.',
	policies:
		'contains removed field "policies". Inline the guidance directly in "instruction" instead.',
	policy_files:
		'contains removed field "policy_files". Inline the guidance directly in "instruction" instead.',
};

const OUTPUT_PLACEHOLDER_PATTERN =
	/\{\{\s*output\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)\s*\}\}/g;
const SETTING_PLACEHOLDER_PATTERN =
	/\{\{\s*setting\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)\s*\}\}/g;
const ROOT_PLACEHOLDER_PATTERN = /\{\{\s*root\(\s*"([^"]+)"\s*\)\s*\}\}/g;
const FACET_SKILL_PLACEHOLDER_PATTERN =
	/\{\{\s*facet_skill\(\s*"([^"]+)"\s*\)\s*\}\}/g;

const BLOCK_SCALAR_HEADERS = new Set([
	"|",
	"|-",
	"|+",
	">",
	">-",
	">+",
]);

const printUsage = () => {
	console.log(
		"Usage: node .claude/skills/ff15-workspace-operation-customization/scripts/validate-operation-yaml.mjs <file-or-directory> [...more-paths]"
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

const walkYamlFiles = (directoryPath, files) => {
	for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
		const childPath = join(directoryPath, entry.name);
		if (entry.isDirectory()) {
			walkYamlFiles(childPath, files);
			continue;
		}

		if (entry.isFile() && isYamlFile(childPath)) {
			files.add(resolve(childPath));
		}
	}
};

const collectYamlFiles = (inputPaths) => {
	const files = new Set();

	for (const inputPath of inputPaths) {
		const resolvedPath = resolve(process.cwd(), inputPath);
		if (!existsSync(resolvedPath)) {
			throw new Error(`Path does not exist: ${inputPath}`);
		}

		if (statSync(resolvedPath).isDirectory()) {
			walkYamlFiles(resolvedPath, files);
			continue;
		}

		if (isYamlFile(resolvedPath)) {
			files.add(resolvedPath);
		}
	}

	return [...files].sort();
};

const getString = (value) => {
	if (typeof value !== "string") {
		return null;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
};

const isPlainObject = (value) =>
	Boolean(value) && typeof value === "object" && !Array.isArray(value);

const pushError = (errors, message) => {
	errors.push(message);
};

const findMatches = (pattern, content) => [...content.matchAll(pattern)];

const validateNoUnexpectedKeys = (record, label, allowedKeys, guidance, errors) => {
	const unexpectedKeys = Object.keys(record).filter(
		(key) => !allowedKeys.has(key)
	);
	if (unexpectedKeys.length === 0) {
		return;
	}

	pushError(
		errors,
		`${label} contains unexpected field(s): ${unexpectedKeys.join(", ")}. ${guidance}`
	);
};

const collectOutputPlaceholders = (content) => {
	if (typeof content !== "string" || !content.includes("{{")) {
		return [];
	}

	return findMatches(OUTPUT_PLACEHOLDER_PATTERN, content).map((match) => [
		match[1],
		match[2],
		match[3],
	]);
};

const validatePlaceholderSyntax = (content, label, errors) => {
	if (typeof content !== "string" || !content.includes("{{")) {
		return;
	}

	if (
		content.includes("{{ output(") &&
		findMatches(OUTPUT_PLACEHOLDER_PATTERN, content).length === 0
	) {
		pushError(
			errors,
			`${label} contains invalid output placeholder syntax. Use {{ output("step", "selector", "file") }}.`
		);
	}

	if (content.includes("{{ setting(")) {
		const matches = findMatches(SETTING_PLACEHOLDER_PATTERN, content);
		if (matches.length === 0) {
			pushError(
				errors,
				`${label} contains invalid setting placeholder syntax. Use {{ setting("key", "mode") }}.`
			);
		}

		for (const match of matches) {
			const key = match[1];
			const mode = match[2];
			if (key !== "language") {
				pushError(
					errors,
					`${label} contains unsupported setting placeholder key "${key}".`
				);
			}

			if (mode !== "name") {
				pushError(
					errors,
					`${label} contains unsupported setting placeholder mode "${mode}" for key "${key}".`
				);
			}
		}
	}

	if (content.includes("{{ root(")) {
		const matches = findMatches(ROOT_PLACEHOLDER_PATTERN, content);
		if (matches.length === 0) {
			pushError(
				errors,
				`${label} contains invalid root placeholder syntax. Use {{ root("scope") }}.`
			);
		}

		for (const match of matches) {
			const scope = match[1];
			if (scope !== "app_root" && scope !== "execution_root") {
				pushError(
					errors,
					`${label} contains unsupported root placeholder scope "${scope}".`
				);
			}
		}
	}

	if (
		content.includes("{{ facet_skill(") &&
		findMatches(FACET_SKILL_PLACEHOLDER_PATTERN, content).length === 0
	) {
		pushError(
			errors,
			`${label} contains invalid facet_skill placeholder syntax. Use {{ facet_skill("name") }}.`
		);
	}
};

const validateOutputPlaceholdersInContent = (
	content,
	label,
	declaredOutputsByStep,
	errors
) => {
	validatePlaceholderSyntax(content, label, errors);

	for (const [stepName, selector, fileName] of collectOutputPlaceholders(
		content
	)) {
		if (!declaredOutputsByStep.has(stepName)) {
			pushError(
				errors,
				`${label} references unknown output step "${stepName}" via output("${stepName}", "${selector}", "${fileName}").`
			);
			continue;
		}

		const declaredFiles = declaredOutputsByStep.get(stepName);
		if (!declaredFiles.has(fileName)) {
			pushError(
				errors,
				`${label} references undeclared output file "${fileName}" for step "${stepName}". Declare it in output_contracts.report or fix the placeholder.`
			);
		}
	}
};

const validateFacetSkillReferences = (
	content,
	label,
	operationDirectory,
	errors
) => {
	if (typeof content !== "string" || !content.includes("{{")) {
		return;
	}

	const skillsDir = resolve(
		dirname(operationDirectory),
		"facets",
		"skills"
	);
	if (!existsSync(skillsDir)) {
		return;
	}

	for (const match of findMatches(FACET_SKILL_PLACEHOLDER_PATTERN, content)) {
		const skillName = match[1];
		const skillPath = join(skillsDir, skillName, "SKILL.md");
		if (!existsSync(skillPath)) {
			pushError(
				errors,
				`${label} references unknown facet skill "${skillName}" via facet_skill("${skillName}"). Expected file at ${skillPath}.`
			);
		}
	}
};

const validateContentSource = (raw, label, operationDirectory, errors) => {
	if (raw === null || raw === undefined) {
		return;
	}

	if (!isPlainObject(raw)) {
		pushError(
			errors,
			`${label} must be an object with exactly one of "file" or "inline".`
		);
		return;
	}

	validateNoUnexpectedKeys(
		raw,
		label,
		CONTENT_SOURCE_KEYS,
		'Content sources support only "file" or "inline". Check indentation so sibling step fields are not nested inside the source object.',
		errors
	);

	const fileRef = getString(raw.file);
	const inlineValue = getString(raw.inline);
	const hasFile = fileRef !== null;
	const hasInline = inlineValue !== null;

	if (hasFile === hasInline) {
		pushError(
			errors,
			`${label} must define exactly one of "file" or "inline".`
		);
		return;
	}

	if (
		hasFile &&
		!existsSync(resolve(operationDirectory, fileRef))
	) {
		pushError(errors, `${label} file source does not exist: ${fileRef}`);
	}
};

const getDeclaredOutputNames = (outputContracts) => {
	if (!isPlainObject(outputContracts)) {
		return new Set();
	}

	const report = outputContracts.report;
	if (!Array.isArray(report)) {
		return new Set();
	}

	const declaredNames = new Set();
	for (const entry of report) {
		if (!isPlainObject(entry)) {
			continue;
		}

		const name = getString(entry.name);
		if (name !== null) {
			declaredNames.add(name);
		}
	}

	return declaredNames;
};

const validateOutputContracts = (
	raw,
	stepName,
	operationDirectory,
	errors
) => {
	if (raw === null || raw === undefined) {
		return;
	}

	if (!isPlainObject(raw)) {
		pushError(
			errors,
			`Step "${stepName}" output_contracts must be an object.`
		);
		return;
	}

	validateNoUnexpectedKeys(
		raw,
		`Step "${stepName}" output_contracts`,
		OUTPUT_CONTRACT_KEYS,
		'Step output_contracts currently supports only the "report" field.',
		errors
	);

	const report = raw.report;
	if (report === null || report === undefined) {
		return;
	}

	if (!Array.isArray(report)) {
		pushError(
			errors,
			`Step "${stepName}" output_contracts.report must be an array.`
		);
		return;
	}

	for (const [index, entry] of report.entries()) {
		if (!isPlainObject(entry)) {
			pushError(
				errors,
				`Step "${stepName}" output_contracts.report[${index}] must be an object.`
			);
			continue;
		}

		if ("format_file" in entry) {
			pushError(
				errors,
				`Step "${stepName}" output_contracts.report[${index}] contains removed field "format_file". Use "format: { file: ... }" or "format: { inline: ... }" instead.`
			);
		}

		validateNoUnexpectedKeys(
			entry,
			`Step "${stepName}" output_contracts.report[${index}]`,
			OUTPUT_CONTRACT_REPORT_KEYS,
			'Output contract report entries support only "name" and "format".',
			errors
		);

		const name = getString(entry.name);
		if (name === null) {
			pushError(
				errors,
				`Step "${stepName}" output_contracts.report[${index}] must define "name".`
			);
		}

		validateContentSource(
			entry.format,
			`Step "${stepName}" output_contracts.report[${index}].format`,
			operationDirectory,
			errors
		);
	}
};

const validateRules = (raw, stepName, errors) => {
	if (raw === null || raw === undefined) {
		pushError(
			errors,
			`Step "${stepName}" must define a non-empty "rules" array.`
		);
		return [];
	}

	if (!Array.isArray(raw)) {
		pushError(errors, `Step "${stepName}" rules must be an array.`);
		return [];
	}

	const targets = [];
	for (const [index, rule] of raw.entries()) {
		if (!isPlainObject(rule)) {
			pushError(
				errors,
				`Step "${stepName}" rules[${index}] must be an object.`
			);
			continue;
		}

		validateNoUnexpectedKeys(
			rule,
			`Step "${stepName}" rules[${index}]`,
			RULE_KEYS,
			'Rules support only "condition" and "next".',
			errors
		);

		const condition = getString(rule.condition);
		const nextTarget = getString(rule.next);

		if (condition === null) {
			pushError(
				errors,
				`Step "${stepName}" rules[${index}] must define a non-empty condition.`
			);
		}

		if (nextTarget === null) {
			pushError(
				errors,
				`Step "${stepName}" rules[${index}] must define a non-empty next target.`
			);
			continue;
		}

		targets.push(nextTarget);
	}

	return targets;
};

const validateOperationFile = (filePath, parseYaml) => {
	const operationDirectory = dirname(filePath);
	const errors = [];

	let raw;
	try {
		raw = parseYaml(readFileSync(filePath, "utf8"));
	} catch (error) {
		pushError(
			errors,
			`YAML parse failed: ${error instanceof Error ? error.message : String(error)}`
		);
		return errors;
	}

	if (!isPlainObject(raw)) {
		pushError(errors, "Operation file must parse to an object.");
		return errors;
	}

	for (const field of LEGACY_OPERATION_FIELDS) {
		if (field in raw) {
			pushError(errors, `Operation contains removed field "${field}".`);
		}
	}

	validateNoUnexpectedKeys(
		raw,
		"Operation schema",
		OPERATION_KEYS,
		"Operations support only name, description, initial_step, jobs, instructions, skills, policies, and steps.",
		errors
	);

	const initialStep = getString(raw.initial_step);
	if (initialStep === null) {
		pushError(errors, 'Operation must define a non-empty "initial_step".');
	}

	const steps = raw.steps;
	if (!Array.isArray(steps)) {
		pushError(errors, 'Operation must define "steps" as an array.');
		return errors;
	}

	const stepNames = new Set();
	const stepAgents = new Map();
	const stepRuleTargets = new Map();
	const declaredOutputsByStep = new Map();

	for (const [index, step] of steps.entries()) {
		if (!isPlainObject(step)) {
			pushError(errors, `steps[${index}] must be an object.`);
			continue;
		}

		const stepName = getString(step.name);
		if (stepName === null) {
			pushError(errors, `steps[${index}] must define a non-empty name.`);
			continue;
		}

		if (stepNames.has(stepName)) {
			pushError(errors, `Duplicate step name: "${stepName}".`);
		}
		stepNames.add(stepName);

		const agent = getString(step.agent) ?? "";
		if (!VALID_AGENTS.has(agent)) {
			pushError(
				errors,
				`Step "${stepName}" agent must be one of noctis, ignis, gladiolus, or prompto.`
			);
		}
		stepAgents.set(stepName, agent);

		for (const [field, message] of Object.entries(
			LEGACY_STEP_FIELD_MESSAGES
		)) {
			if (field in step) {
				pushError(errors, `Step "${stepName}" ${message}`);
			}
		}

		validateNoUnexpectedKeys(
			step,
			`Step "${stepName}"`,
			STEP_KEYS,
			"Steps support only name, agent, instruction, output_contracts, and rules.",
			errors
		);

		validateContentSource(
			step.instruction,
			`Step "${stepName}" instruction`,
			operationDirectory,
			errors
		);
		validateOutputContracts(
			step.output_contracts,
			stepName,
			operationDirectory,
			errors
		);

		declaredOutputsByStep.set(
			stepName,
			getDeclaredOutputNames(step.output_contracts)
		);
		stepRuleTargets.set(
			stepName,
			validateRules(step.rules, stepName, errors)
		);
	}

	if (initialStep !== null) {
		if (!stepNames.has(initialStep)) {
			pushError(
				errors,
				`initial_step references an undefined step: "${initialStep}".`
			);
		} else {
			const initialAgent = stepAgents.get(initialStep);
			if (initialAgent !== "noctis") {
				pushError(
					errors,
					`initial_step "${initialStep}" must be owned by noctis.`
				);
			}

			for (const nextTarget of stepRuleTargets.get(initialStep) ?? []) {
				if (TERMINAL_NEXT.has(nextTarget)) {
					pushError(
						errors,
						`initial_step "${initialStep}" must not route directly to ${nextTarget}. Route through a named non-initial step instead.`
					);
				}
			}
		}
	}

	for (const [stepName, targets] of stepRuleTargets.entries()) {
		for (const nextTarget of targets) {
			if (TERMINAL_NEXT.has(nextTarget)) {
				continue;
			}

			if (!stepNames.has(nextTarget)) {
				pushError(
					errors,
					`Step "${stepName}" routes to an undefined next target: "${nextTarget}".`
				);
			}
		}
	}

	for (const step of steps) {
		if (!isPlainObject(step)) {
			continue;
		}

		const stepName = getString(step.name);
		if (stepName === null) {
			continue;
		}

		const instruction = step.instruction;
		if (!isPlainObject(instruction)) {
			continue;
		}

		const inlineInstruction = getString(instruction.inline);
		if (inlineInstruction === null) {
			continue;
		}

		validateOutputPlaceholdersInContent(
			inlineInstruction,
			`Step "${stepName}" instruction.inline`,
			declaredOutputsByStep,
			errors
		);
		validateFacetSkillReferences(
			inlineInstruction,
			`Step "${stepName}" instruction.inline`,
			operationDirectory,
			errors
		);
	}

	return errors;
};

// --- YAML parsing ----------------------------------------------------------

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

// Minimal YAML reader scoped to the FF15 operation schema: top-level mappings,
// `steps:`-style sequences of mappings, scalar values, and `|`/`>` block
// scalars with `-`/`+` chomping. It is not a general YAML parser; it exists
// only so the validator runs with just `node`. Flow style (`{}`/`[]`), anchors,
// aliases, and tags are not supported — install the `yaml` package for those.
const parseMinimalYaml = (source) => {
	const lines = source.split(/\r?\n/);
	let index = 0;

	const indentOf = (line) => /^\s*/.exec(line)[0].length;
	const isBlankOrComment = (line) => /^\s*(#.*)?$/.test(line);

	const isBlockScalarHeader = (value) =>
		BLOCK_SCALAR_HEADERS.has(value);

	const parseScalar = (raw) => {
		const value = raw.trim();
		if (value === "" || value === "~" || value.toLowerCase() === "null") {
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

	// Split a block-style mapping line into [key, rawValue]. Locates the first
	// `:` separator (followed by space or end-of-line) outside any quotes.
	const splitKeyValue = (line) => {
		const trimmed = line.trim();
		let inSingle = false;
		let inDouble = false;
		let separator = -1;

		for (let i = 0; i < trimmed.length; i += 1) {
			const ch = trimmed[i];
			if (ch === "'" && !inDouble) {
				inSingle = !inSingle;
				continue;
			}

			if (ch === '"' && !inSingle) {
				inDouble = !inDouble;
				continue;
			}

			if (ch === ":" && !inSingle && !inDouble) {
				const next = trimmed[i + 1];
				if (next === undefined || next === " " || next === "\t") {
					separator = i;
					break;
				}
			}
		}

		if (separator === -1) {
			return null;
		}

		const key = trimmed.slice(0, separator).trim();
		const rawValue = trimmed.slice(separator + 1).trim();
		return [key, rawValue];
	};

	const buildBlockScalar = (rawContentLines, header) => {
		const fold = header.startsWith(">");
		let chomp = "clip";
		if (header.endsWith("-")) chomp = "strip";
		else if (header.endsWith("+")) chomp = "keep";

		let trailingBlanks = 0;
		const workLines = [...rawContentLines];
		while (
			workLines.length > 0 &&
			workLines[workLines.length - 1] === ""
		) {
			workLines.pop();
			trailingBlanks += 1;
		}

		let body;
		if (fold) {
			const parts = [];
			for (const line of workLines) {
				if (line === "") {
					parts.push("\n");
				} else if (parts.length === 0) {
					parts.push(line);
				} else {
					const last = parts[parts.length - 1];
					if (last.endsWith("\n")) {
						parts.push(line);
					} else {
						parts[parts.length - 1] = `${last} ${line}`;
					}
				}
			}
			body = parts.join("");
		} else {
			body = workLines.join("\n");
		}

		if (body === "") {
			if (chomp === "keep") {
				return "\n".repeat(trailingBlanks);
			}
			return "";
		}

		if (chomp === "strip") {
			return body;
		}

		if (chomp === "clip") {
			return `${body}\n`;
		}

		// keep
		return `${body}\n${"\n".repeat(trailingBlanks)}`;
	};

	const parseBlockScalar = (parentIndent, header) => {
		const contentLines = [];
		let contentIndent = -1;

		while (index < lines.length) {
			const line = lines[index];
			if (line.trim() === "") {
				contentLines.push("");
				index += 1;
				continue;
			}

			const ind = indentOf(line);
			if (ind <= parentIndent) {
				break;
			}

			if (contentIndent === -1) {
				contentIndent = ind;
			}

			if (ind < contentIndent) {
				break;
			}

			contentLines.push(line.slice(contentIndent));
			index += 1;
		}

		return buildBlockScalar(contentLines, header);
	};

	const parseBlock = (parentIndent) => {
		if (index >= lines.length) {
			return null;
		}

		const line = lines[index];
		const ind = indentOf(line);
		if (ind <= parentIndent) {
			return null;
		}

		if (line.trim().startsWith("- ")) {
			return parseSequence(ind);
		}

		return parseMapping(ind);
	};

	const parseNestedValue = (parentIndent) => {
		if (index >= lines.length) {
			return null;
		}

		const savedIndex = index;
		while (index < lines.length && isBlankOrComment(lines[index])) {
			index += 1;
		}

		if (index >= lines.length) {
			index = savedIndex;
			return null;
		}

		const line = lines[index];
		const ind = indentOf(line);
		if (ind <= parentIndent) {
			index = savedIndex;
			return null;
		}

		return parseBlock(parentIndent);
	};

	const parseMapping = (indent) => {
		const result = {};

		while (index < lines.length) {
			const line = lines[index];
			if (isBlankOrComment(line)) {
				index += 1;
				continue;
			}

			const ind = indentOf(line);
			if (ind < indent) {
				break;
			}

			if (ind > indent) {
				throw new Error(
					`Unexpected indentation at line ${index + 1}: ${JSON.stringify(line)}`
				);
			}

			if (line.trim().startsWith("- ")) {
				throw new Error(
					`Unexpected sequence entry inside mapping at line ${index + 1}`
				);
			}

			const kv = splitKeyValue(line);
			if (kv === null) {
				throw new Error(
					`Invalid mapping line ${index + 1}: ${JSON.stringify(line)}`
				);
			}

			const [key, rawValue] = kv;
			index += 1;

			if (rawValue === "") {
				result[key] = parseNestedValue(indent);
			} else if (isBlockScalarHeader(rawValue)) {
				result[key] = parseBlockScalar(indent, rawValue);
			} else {
				result[key] = parseScalar(rawValue);
			}
		}

		return result;
	};

	const parseSequence = (indent) => {
		const result = [];

		while (index < lines.length) {
			const line = lines[index];
			if (isBlankOrComment(line)) {
				index += 1;
				continue;
			}

			const ind = indentOf(line);
			if (ind !== indent) {
				break;
			}

			const trimmed = line.trim();
			if (!trimmed.startsWith("- ")) {
				break;
			}

			const dashIndex = line.indexOf("-");
			const contentStart = dashIndex + 2;
			const entryIndent = contentStart;
			const rest = trimmed.slice(2);

			if (rest === "") {
				index += 1;
				result.push(parseBlock(indent));
				continue;
			}

			// A "- key: value" line begins a mapping entry; the mapping's keys
			// sit at column `entryIndent`, the same indent as `key`.
			const kv = splitKeyValue(rest);
			if (kv !== null) {
				const entryMapping = {};
				const [firstKey, firstRawValue] = kv;
				index += 1;

				if (firstRawValue === "") {
					entryMapping[firstKey] = parseNestedValue(entryIndent - 1);
				} else if (isBlockScalarHeader(firstRawValue)) {
					entryMapping[firstKey] = parseBlockScalar(
						entryIndent - 1,
						firstRawValue
					);
				} else {
					entryMapping[firstKey] = parseScalar(firstRawValue);
				}

				while (index < lines.length) {
					if (isBlankOrComment(lines[index])) {
						index += 1;
						continue;
					}

					const entryLine = lines[index];
					const entryInd = indentOf(entryLine);
					if (entryInd < entryIndent) {
						break;
					}

					if (entryInd > entryIndent) {
						throw new Error(
							`Unexpected indentation at line ${index + 1}: ${JSON.stringify(entryLine)}`
						);
					}

					if (entryLine.trim().startsWith("- ")) {
						break;
					}

					const entryKv = splitKeyValue(entryLine);
					if (entryKv === null) {
						throw new Error(
							`Invalid mapping line ${index + 1}: ${JSON.stringify(entryLine)}`
						);
					}

					const [entryKey, entryRawValue] = entryKv;
					index += 1;

					if (entryRawValue === "") {
						entryMapping[entryKey] = parseNestedValue(entryIndent);
					} else if (isBlockScalarHeader(entryRawValue)) {
						entryMapping[entryKey] = parseBlockScalar(
							entryIndent - 1,
							entryRawValue
						);
					} else {
						entryMapping[entryKey] = parseScalar(entryRawValue);
					}
				}

				result.push(entryMapping);
				continue;
			}

			// Scalar sequence entry.
			result.push(parseScalar(rest));
			index += 1;
		}

		return result;
	};

	const root = parseBlock(-1);
	if (index < lines.length) {
		throw new Error(
			`Unexpected trailing content at line ${index + 1}: ${JSON.stringify(lines[index])}`
		);
	}

	return root ?? {};
};

// --- entrypoint ------------------------------------------------------------

const reportResult = (filePath, errors) => {
	if (errors.length === 0) {
		console.log(`OK ${toDisplayPath(filePath)}`);
		return false;
	}

	console.error(`ERROR ${toDisplayPath(filePath)}`);
	for (const message of errors) {
		console.error(`  - ${message}`);
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

	let files;
	try {
		files = collectYamlFiles(args);
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}

	if (files.length === 0) {
		console.error("No YAML files found in the provided paths.");
		process.exit(1);
	}

	const parseYaml = await loadYamlParser();
	let hasErrors = false;

	for (const filePath of files) {
		if (reportResult(filePath, validateOperationFile(filePath, parseYaml))) {
			hasErrors = true;
		}
	}

	if (hasErrors) {
		process.exit(1);
	}

	console.log(`Validated ${files.length} operation YAML file(s).`);
};

main();