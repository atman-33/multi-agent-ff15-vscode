import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { parse } from "yaml";
import { FF15_WORKSPACE_RUNTIME_DIR_NAME } from "../ff15-missions/state";
import {
	FF15_BUNDLED_OPERATION_DEFINITIONS,
	FF15_WORKSPACE_OPERATIONS_DIR_NAME,
} from "./catalog";

interface ParsedOperationContentSource {
	file?: unknown;
	inline?: unknown;
}

interface ParsedOperationRule {
	condition?: unknown;
	next?: unknown;
}

interface ParsedOperationOutputContract {
	format?: unknown;
	name?: unknown;
}

interface ParsedOperationStep {
	agent?: unknown;
	instruction?: unknown;
	job?: unknown;
	name?: unknown;
	output_contracts?: unknown;
	policies?: unknown;
	rules?: unknown;
	skills?: unknown;
}

interface ParsedOperationDefinition {
	initial_step?: unknown;
	name?: unknown;
	steps?: unknown;
}

const STEP_TASK_TOKEN_PATTERN = /[-_]+/u;
const LINE_SPLIT_PATTERN = /\r?\n/u;
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---/u;
const FILE_EXTENSION_PATTERN = /\.[^.]+$/u;
const XML_ESCAPE_PATTERN = /["&'<>]/gu;
const XML_ESCAPES: Record<string, string> = {
	'"': "&quot;",
	"&": "&amp;",
	"'": "&apos;",
	"<": "&lt;",
	">": "&gt;",
};

export interface Ff15MissionOperationActivation {
	activeTask: string;
	definition: Ff15MissionOperationDefinition;
	operationName: string;
	step: Ff15MissionOperationStep | null;
	stepAgent: string | null;
	stepName: string;
}

export interface Ff15MissionOperationRule {
	condition: string | null;
	next: string;
}

export interface Ff15MissionOperationOutputContract {
	format: string | null;
	name: string;
}

export interface Ff15MissionOperationStep {
	agent: string | null;
	instruction: string | null;
	job: string | null;
	name: string;
	outputContracts: Ff15MissionOperationOutputContract[];
	policies: string[];
	rules: Ff15MissionOperationRule[];
	skills: string[];
}

export interface Ff15MissionOperationDefinition {
	initialStep: string | null;
	name: string;
	steps: Ff15MissionOperationStep[];
}

const getOperationFileName = (operationRef: string): string | null =>
	FF15_BUNDLED_OPERATION_DEFINITIONS.find(
		(operationDefinition) => operationDefinition.ref === operationRef
	)?.fileName ?? null;

const getString = (value: unknown): string | null =>
	typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const getRecord = (value: unknown): Record<string, unknown> | null =>
	value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;

const getArray = (value: unknown): unknown[] =>
	Array.isArray(value) ? value : [];

const resolveOperationAssetPath = (operationPath: string, fileRef: string) =>
	join(dirname(operationPath), fileRef);

const readOperationAsset = (
	operationPath: string,
	source: unknown
): string | null => {
	const sourceRecord = getRecord(source as ParsedOperationContentSource);
	const inlineValue = getString(sourceRecord?.inline);
	if (inlineValue) {
		return inlineValue;
	}

	const fileRef = getString(sourceRecord?.file);
	if (!fileRef) {
		return null;
	}

	const assetPath = resolveOperationAssetPath(operationPath, fileRef);
	if (!existsSync(assetPath)) {
		return null;
	}

	return readFileSync(assetPath, "utf8").trim();
};

const resolveOperationAssetReference = (
	operationPath: string,
	source: unknown
): string | null => {
	const sourceRecord = getRecord(source as ParsedOperationContentSource);
	const fileRef = getString(sourceRecord?.file);
	if (!fileRef) {
		return null;
	}

	const assetPath = resolveOperationAssetPath(operationPath, fileRef);
	return existsSync(assetPath) ? assetPath : null;
};

const readPolicies = (operationPath: string, source: unknown): string[] =>
	getArray(source)
		.map((policySource) => readOperationAsset(operationPath, policySource))
		.filter((policy): policy is string => policy != null && policy.length > 0);

const readSkills = (operationPath: string, source: unknown): string[] =>
	getArray(source)
		.map((skillSource) =>
			resolveOperationAssetReference(operationPath, skillSource)
		)
		.filter((skillPath): skillPath is string => skillPath != null);

const readRules = (source: unknown): Ff15MissionOperationRule[] =>
	getArray(source)
		.map((ruleValue) => {
			const ruleRecord = getRecord(ruleValue as ParsedOperationRule);
			const next = getString(ruleRecord?.next);
			if (!next) {
				return null;
			}

			return {
				condition: getString(ruleRecord?.condition),
				next,
			};
		})
		.filter((rule): rule is Ff15MissionOperationRule => rule != null);

const readOutputContracts = (
	operationPath: string,
	source: unknown
): Ff15MissionOperationOutputContract[] => {
	const outputContracts = getRecord(source);
	return getArray(outputContracts?.report)
		.map((contractValue) => {
			const contractRecord = getRecord(
				contractValue as ParsedOperationOutputContract
			);
			const name = getString(contractRecord?.name);
			if (!name) {
				return null;
			}

			return {
				format: readOperationAsset(operationPath, contractRecord?.format),
				name,
			};
		})
		.filter(
			(contract): contract is Ff15MissionOperationOutputContract =>
				contract != null
		);
};

const parseOperationDefinition = (
	definitionSource: string
): ParsedOperationDefinition | null => {
	try {
		const parsed = parse(definitionSource) as ParsedOperationDefinition | null;
		return parsed && typeof parsed === "object" ? parsed : null;
	} catch {
		return null;
	}
};

const readOperationStep = (
	operationPath: string,
	stepValue: unknown
): Ff15MissionOperationStep | null => {
	const stepRecord = getRecord(stepValue as ParsedOperationStep);
	const name = getString(stepRecord?.name);
	if (!name) {
		return null;
	}

	return {
		agent: getString(stepRecord?.agent),
		instruction: readOperationAsset(operationPath, stepRecord?.instruction),
		job: readOperationAsset(operationPath, stepRecord?.job),
		name,
		outputContracts: readOutputContracts(
			operationPath,
			stepRecord?.output_contracts
		),
		policies: readPolicies(operationPath, stepRecord?.policies),
		rules: readRules(stepRecord?.rules),
		skills: readSkills(operationPath, stepRecord?.skills),
	};
};

const escapeXml = (value: string): string =>
	value.replace(XML_ESCAPE_PATTERN, (character) => XML_ESCAPES[character]);

const formatXmlAttributes = (attributes?: Record<string, string>): string => {
	if (!attributes) {
		return "";
	}

	const attributeEntries = Object.entries(attributes).filter(
		([, value]) => value.length > 0
	);
	if (attributeEntries.length === 0) {
		return "";
	}

	return ` ${attributeEntries
		.map(([name, value]) => `${name}="${escapeXml(value)}"`)
		.join(" ")}`;
};

const wrapXmlSection = (
	tagName: string,
	content: string | null,
	attributes?: Record<string, string>
): string | null => {
	if (!content) {
		return null;
	}

	const normalized = content.trim();
	if (normalized.length === 0) {
		return null;
	}

	return `<${tagName}${formatXmlAttributes(attributes)}>\n${normalized}\n</${tagName}>`;
};

const buildTextSection = (
	tagName: string,
	content: string | null,
	attributes?: Record<string, string>
): string | null => {
	if (!content) {
		return null;
	}

	return wrapXmlSection(tagName, escapeXml(content), attributes);
};

const buildPlainSection = (tagName: string, lines: string[]): string | null =>
	buildTextSection(tagName, lines.filter((line) => line.length > 0).join("\n"));

const readFrontmatterValue = (
	source: string,
	fieldName: string
): string | null => {
	const match = FRONTMATTER_PATTERN.exec(source);
	if (!match) {
		return null;
	}

	for (const line of match[1].split(LINE_SPLIT_PATTERN)) {
		const separatorIndex = line.indexOf(":");
		if (separatorIndex <= 0) {
			continue;
		}

		const key = line.slice(0, separatorIndex).trim();
		if (key !== fieldName) {
			continue;
		}

		const value = line.slice(separatorIndex + 1).trim();
		return value.replace(/^['"]|['"]$/gu, "");
	}

	return null;
};

const readSkillMetadata = (skillPath: string) => {
	const source = readFileSync(skillPath, "utf8");
	const fileName = basename(skillPath).replace(FILE_EXTENSION_PATTERN, "");

	return {
		description: readFrontmatterValue(source, "description"),
		name: readFrontmatterValue(source, "name") ?? fileName,
		path: skillPath,
	};
};

const getOperationStepTaskId = (stepName: string) => `task-${stepName}`;

const buildReferenceFilesSection = (skillPaths: string[]): string | null => {
	const referenceFiles = skillPaths
		.map((skillPath) => {
			const metadata = readSkillMetadata(skillPath);
			return wrapXmlSection(
				"reference-file",
				[
					buildTextSection("name", metadata.name),
					buildTextSection("path", metadata.path),
					buildTextSection("description", metadata.description),
				]
					.filter((section): section is string => section != null)
					.join("\n\n")
			);
		})
		.filter((section): section is string => section != null)
		.join("\n\n");

	return wrapXmlSection("reference-files", referenceFiles);
};

const buildOutputContractSections = (
	outputContracts: Ff15MissionOperationOutputContract[]
): string[] =>
	outputContracts
		.map((outputContract) =>
			buildTextSection(
				"output-contract",
				[`name: ${outputContract.name}`, outputContract.format]
					.filter((line): line is string => line != null && line.length > 0)
					.join("\n\n")
			)
		)
		.filter((section): section is string => section != null);

const describeNextMessageGuidance = (
	operationDefinition: Ff15MissionOperationDefinition,
	next: string
): string => {
	if (next === "COMPLETE") {
		return "Write message as the final completion summary for User.";
	}

	if (next === "ABORT") {
		return "Write message as the blocking reason and what remains unresolved.";
	}

	const nextStep =
		operationDefinition.steps.find((step) => step.name === next) ?? null;
	if (!nextStep) {
		return `Write message as the handoff summary for the "${next}" step.`;
	}

	if (nextStep.agent && nextStep.agent !== "noctis") {
		return `Write message as the handoff summary for ${nextStep.agent}. Runtime will pass it into the "${next}" step.`;
	}

	return `Write message as the canonical summary for the "${next}" step.`;
};

const buildStepCompletionContract = (input: {
	activation: Ff15MissionOperationActivation;
	missionId: string;
	workspaceRoot: string;
}): string | null => {
	if (!input.activation.step || input.activation.step.rules.length === 0) {
		return null;
	}

	const submitReportPath = join(
		input.workspaceRoot,
		FF15_WORKSPACE_RUNTIME_DIR_NAME,
		"bridge",
		"submit-report.ps1"
	);
	const taskId = getOperationStepTaskId(input.activation.stepName);

	return buildTextSection(
		"step-completion-contract",
		[
			"Allowed next values:",
			...input.activation.step.rules.map(
				(rule) =>
					`- ${rule.next}${rule.condition ? ` - ${rule.condition}` : ""}`
			),
			"",
			"Report completion with the runtime bridge command:",
			`- ${submitReportPath} -MissionId ${input.missionId} -TaskId ${taskId} -Next <next> -Message "<message>"`,
			"",
			"Message guidance:",
			...input.activation.step.rules.map(
				(rule) =>
					`- ${rule.next}: ${describeNextMessageGuidance(
						input.activation.definition,
						rule.next
					)}`
			),
		].join("\n")
	);
};

export const formatFf15OperationTaskLabel = (stepName: string): string =>
	stepName
		.split(STEP_TASK_TOKEN_PATTERN)
		.filter((segment) => segment.length > 0)
		.map((segment) => `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`)
		.join(" ");

export const loadMissionOperationDefinition = (
	workspaceRoot: string,
	operationRef: string
): Ff15MissionOperationDefinition | null => {
	const operationFileName = getOperationFileName(operationRef);
	if (!operationFileName) {
		return null;
	}

	const operationPath = join(
		workspaceRoot,
		FF15_WORKSPACE_RUNTIME_DIR_NAME,
		FF15_WORKSPACE_OPERATIONS_DIR_NAME,
		operationFileName
	);
	if (!existsSync(operationPath)) {
		return null;
	}

	const parsedDefinition = parseOperationDefinition(
		readFileSync(operationPath, "utf8")
	);
	if (!parsedDefinition) {
		return null;
	}

	return {
		initialStep: getString(parsedDefinition.initial_step),
		name: getString(parsedDefinition.name) ?? operationRef,
		steps: getArray(parsedDefinition.steps)
			.map((stepValue) => readOperationStep(operationPath, stepValue))
			.filter((step): step is Ff15MissionOperationStep => step != null),
	};
};

export const loadMissionOperationActivation = (
	workspaceRoot: string,
	operationRef: string,
	stepNameOverride?: string
): Ff15MissionOperationActivation | null => {
	const parsedDefinition = loadMissionOperationDefinition(
		workspaceRoot,
		operationRef
	);
	if (!parsedDefinition) {
		return null;
	}

	const stepName = stepNameOverride ?? parsedDefinition?.initialStep;
	if (!stepName) {
		return null;
	}

	const activeStep =
		parsedDefinition.steps.find((step) => step.name === stepName) ?? null;

	return {
		activeTask: formatFf15OperationTaskLabel(stepName),
		definition: parsedDefinition,
		operationName: parsedDefinition.name,
		step: activeStep,
		stepAgent: activeStep?.agent ?? null,
		stepName,
	};
};

export const buildOperationAwarePrompt = (input: {
	activation: Ff15MissionOperationActivation;
	missionId: string;
	prompt: string;
	workspaceRoot: string;
}): string =>
	wrapXmlSection(
		"operation-prompt",
		[
			buildPlainSection("workspace-context", [
				`project_root: ${input.workspaceRoot}`,
			]),
			buildPlainSection("tooling-context", [
				`activate_project: ${input.workspaceRoot}`,
				`openspec_root: ${input.workspaceRoot}`,
				`bridge_scripts_dir: ${join(
					input.workspaceRoot,
					FF15_WORKSPACE_RUNTIME_DIR_NAME,
					"bridge"
				)}`,
			]),
			buildPlainSection("workflow-context", [
				`operation: ${input.activation.operationName}`,
				`step: ${input.activation.stepName}`,
				`task: ${input.activation.activeTask}`,
				`agent: ${input.activation.stepAgent ?? "noctis"}`,
			]),
			buildTextSection("job", input.activation.step?.job ?? null),
			buildReferenceFilesSection(input.activation.step?.skills ?? []),
			buildTextSection(
				"instruction",
				input.activation.step?.instruction ?? null
			),
			...(input.activation.step?.policies ?? [])
				.map((policy) => buildTextSection("policy", policy))
				.filter((section): section is string => section != null),
			...buildOutputContractSections(
				input.activation.step?.outputContracts ?? []
			),
			buildStepCompletionContract({
				activation: input.activation,
				missionId: input.missionId,
				workspaceRoot: input.workspaceRoot,
			}),
			buildTextSection("user-request", input.prompt, {
				from: "user",
				to: "noctis",
			}),
		]
			.filter((section): section is string => section != null)
			.join("\n\n")
	) ?? "";
