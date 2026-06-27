import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parse } from "yaml";
import {
	createEmptyFf15MissionWorkflowState,
	getWorkspaceMissionOutputFilePath,
	type Ff15MissionWorkflowStepHistoryEntry,
	type Ff15MissionWorkflowState,
	FF15_WORKSPACE_RUNTIME_DIR_NAME,
} from "../ff15-missions/state";
import {
	FF15_BUNDLED_OPERATION_DEFINITIONS,
	FF15_WORKSPACE_OPERATIONS_DIR_NAME,
} from "./catalog";

const toShellSafePath = (p: string): string => p.replace(/\\/g, "/");

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
	name?: unknown;
	output_contracts?: unknown;
	rules?: unknown;
}

interface ParsedOperationDefinition {
	initial_step?: unknown;
	name?: unknown;
	steps?: unknown;
}

const STEP_TASK_TOKEN_PATTERN = /[-_]+/u;
const XML_ESCAPE_PATTERN = /["&'<>]/gu;
const OUTPUT_PLACEHOLDER_PATTERN =
	/\{\{\s*output\("([^"]+)",\s*"([^"]+)",\s*"([^"]+)"\)\s*\}\}/gu;
const SETTING_PLACEHOLDER_PATTERN =
	/\{\{\s*setting\("([^"]+)",\s*"([^"]+)"\)\s*\}\}/gu;
const ROOT_PLACEHOLDER_PATTERN = /\{\{\s*root\("([^"]+)"\)\s*\}\}/gu;
const FACET_SKILL_PLACEHOLDER_PATTERN =
	/\{\{\s*facet_skill\("([^"]+)"\)\s*\}\}/gu;
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
	name: string;
	outputContracts: Ff15MissionOperationOutputContract[];
	rules: Ff15MissionOperationRule[];
}

export interface Ff15MissionOperationDefinition {
	initialStep: string | null;
	name: string;
	steps: Ff15MissionOperationStep[];
}

export interface Ff15OperationPromptSettings {
	languageName?: string | null;
}

interface Ff15OperationPromptResolutionContext {
	missionId: string;
	settings?: Ff15OperationPromptSettings;
	workflow: Ff15MissionWorkflowState;
	workspaceRoot: string;
}

const normalizeActiveProjects = (activeProjects?: string[]): string[] =>
	(activeProjects ?? []).filter(
		(activeProject): activeProject is string =>
			typeof activeProject === "string" && activeProject.trim().length > 0
	);

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
		name,
		outputContracts: readOutputContracts(
			operationPath,
			stepRecord?.output_contracts
		),
		rules: readRules(stepRecord?.rules),
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

const buildToolingContextLines = (input: {
	activeProjects?: string[];
	openspecRoot?: string | null;
	workspaceRoot: string;
}): string[] => {
	const activeProjects = normalizeActiveProjects(input.activeProjects);
	const openspecRoot =
		typeof input.openspecRoot === "string" &&
		input.openspecRoot.trim().length > 0
			? toShellSafePath(input.openspecRoot)
			: null;

	return [
		...(activeProjects.length === 0
			? ["active_projects: []"]
			: [
					"active_projects:",
					...activeProjects.map((activeProject) => `  - ${activeProject}`),
				]),
		...(openspecRoot ? [`openspec_root: ${openspecRoot}`] : []),
		`bridge_scripts_dir: ${toShellSafePath(
			join(input.workspaceRoot, FF15_WORKSPACE_RUNTIME_DIR_NAME, "bridge")
		)}`,
		`bridge_command: node "${toShellSafePath(
			join(
				input.workspaceRoot,
				FF15_WORKSPACE_RUNTIME_DIR_NAME,
				"bridge",
				"bridge.mjs"
			)
		)}" <command> [args]`,
		"bridge_commands: get-mission <mission_id> | get-workflow <mission_id> | submit-task <mission_id> <task> [step] | submit-report <mission_id> <task_id> <next> <message>",
	];
};

const getOperationStepTaskPrefix = (stepName: string) => `task-${stepName}`;

const getRecordedTaskAttemptNumber = (input: {
	stepName: string;
	workflow: Ff15MissionWorkflowState;
}): number => {
	const taskIdPrefix = getOperationStepTaskPrefix(input.stepName);
	let highestAttempt = 0;

	for (const historyEntry of input.workflow.stepHistory) {
		if (historyEntry.fromStep !== input.stepName) {
			continue;
		}

		const taskId =
			typeof historyEntry.taskId === "string" ? historyEntry.taskId.trim() : "";
		if (taskId.length === 0) {
			continue;
		}

		if (taskId === taskIdPrefix) {
			highestAttempt = Math.max(highestAttempt, 1);
			continue;
		}

		if (!taskId.startsWith(`${taskIdPrefix}-`)) {
			continue;
		}

		const suffix = taskId.slice(`${taskIdPrefix}-`.length);
		const parsedAttempt = Number.parseInt(suffix, 10);
		if (Number.isFinite(parsedAttempt) && parsedAttempt >= 2) {
			highestAttempt = Math.max(highestAttempt, parsedAttempt);
		}
	}

	return highestAttempt;
};

export const getOperationStepTaskId = (input: {
	stepName: string;
	workflow: Ff15MissionWorkflowState;
}): string => {
	const taskIdPrefix = getOperationStepTaskPrefix(input.stepName);
	const highestRecordedAttempt = getRecordedTaskAttemptNumber(input);
	if (highestRecordedAttempt === 0) {
		return taskIdPrefix;
	}

	return `${taskIdPrefix}-${highestRecordedAttempt + 1}`;
};

const buildOutputContractSections = (
	activation: Ff15MissionOperationActivation,
	outputContracts: Ff15MissionOperationOutputContract[],
	context: Ff15OperationPromptResolutionContext
): string[] =>
	outputContracts
		.map((outputContract) => {
			const outputPath = toShellSafePath(
				getWorkspaceMissionOutputFilePath({
					fileName: outputContract.name,
					missionId: context.missionId,
					stepName: activation.stepName,
					taskId: getOperationStepTaskId({
						stepName: activation.stepName,
						workflow: context.workflow,
					}),
					workspaceRoot: context.workspaceRoot,
				})
			);

			return buildTextSection(
				"output-contract",
				[
					`name: ${outputContract.name}`,
					`path: ${outputPath}`,
					`Create the file at ${outputPath} using the following format.`,
					resolveInstructionPlaceholders({
						content: outputContract.format,
						definition: activation.definition,
						context,
					}),
				]
					.filter((line): line is string => line != null && line.length > 0)
					.join("\n\n")
			);
		})
		.filter((section): section is string => section != null);

const normalizeLanguagePlaceholderValue = (
	languageName: string | null | undefined
): string => {
	if (!languageName || languageName.trim().length === 0) {
		return "english";
	}

	const normalized = languageName.trim().toLowerCase();
	if (normalized === "ja") {
		return "japanese";
	}

	if (normalized === "en") {
		return "english";
	}

	return normalized;
};

const resolveOutputPlaceholderPath = (input: {
	context: Ff15OperationPromptResolutionContext;
	definition: Ff15MissionOperationDefinition;
	fileName: string;
	selector: string;
	stepName: string;
}): string => {
	const referencedStep =
		input.definition.steps.find((step) => step.name === input.stepName) ?? null;
	if (!referencedStep) {
		throw new Error(
			`Could not resolve output placeholder for step "${input.stepName}" and file "${input.fileName}". Unknown step.`
		);
	}

	if (
		!referencedStep.outputContracts.some(
			(contract) => contract.name === input.fileName
		)
	) {
		throw new Error(
			`Could not resolve output placeholder for step "${input.stepName}" and file "${input.fileName}". Step does not declare output contract "${input.fileName}".`
		);
	}

	const taskId = resolveCompletedTaskId({
		selector: input.selector,
		stepName: input.stepName,
		workflow: input.context.workflow,
	});

	const outputPath = getWorkspaceMissionOutputFilePath({
		fileName: input.fileName,
		missionId: input.context.missionId,
		stepName: input.stepName,
		taskId,
		workspaceRoot: input.context.workspaceRoot,
	});
	if (!existsSync(outputPath)) {
		throw new Error(
			`Could not resolve output placeholder for step "${input.stepName}" and file "${input.fileName}". Missing file at ${outputPath}.`
		);
	}

	return toShellSafePath(outputPath);
};

const resolveCompletedTaskId = (input: {
	selector: string;
	stepName: string;
	workflow: Ff15MissionWorkflowState;
}): string => {
	if (input.selector === "latest") {
		const latestMatch = [...input.workflow.stepHistory]
			.reverse()
			.find(
				(entry) =>
					entry.fromStep === input.stepName &&
					typeof entry.taskId === "string" &&
					entry.taskId.trim().length > 0
			);

		if (!latestMatch?.taskId) {
			throw new Error(
				`Could not resolve output placeholder for step "${input.stepName}". No completed output recorded for selector "latest".`
			);
		}

		return latestMatch.taskId;
	}

	if (!input.selector.startsWith("task:")) {
		throw new Error(
			`Unsupported output placeholder selector "${input.selector}" for step "${input.stepName}".`
		);
	}

	const taskId = input.selector.slice("task:".length).trim();
	if (taskId.length === 0) {
		throw new Error(
			`Could not resolve output placeholder for step "${input.stepName}". Output selector must include a task id.`
		);
	}

	const explicitMatch = input.workflow.stepHistory.find(
		(entry) => entry.fromStep === input.stepName && entry.taskId === taskId
	);
	if (!explicitMatch) {
		throw new Error(
			`Could not resolve output placeholder for step "${input.stepName}" and file selector "${input.selector}". No completed output recorded for selector "${input.selector}".`
		);
	}

	return taskId;
};

const resolveSettingPlaceholderValue = (
	key: string,
	mode: string,
	settings?: Ff15OperationPromptSettings
): string => {
	if (key !== "language") {
		throw new Error(`Unsupported setting placeholder key "${key}".`);
	}

	if (mode !== "name") {
		throw new Error(
			`Unsupported setting placeholder mode "${mode}" for key "${key}".`
		);
	}

	return normalizeLanguagePlaceholderValue(settings?.languageName);
};

const resolveRootPlaceholderValue = (
	scope: string,
	workspaceRoot: string
): string => {
	if (scope === "app_root" || scope === "execution_root") {
		return toShellSafePath(workspaceRoot);
	}

	throw new Error(`Unsupported root placeholder scope "${scope}".`);
};

const resolveFacetSkillPlaceholderValue = (
	skillName: string,
	workspaceRoot: string
): string => {
	const skillPath = join(
		workspaceRoot,
		FF15_WORKSPACE_RUNTIME_DIR_NAME,
		"facets",
		"skills",
		skillName,
		"SKILL.md"
	);
	if (!existsSync(skillPath)) {
		throw new Error(
			`Could not resolve facet_skill placeholder for "${skillName}". Missing file at ${skillPath}.`
		);
	}

	return toShellSafePath(skillPath);
};

const resolveInstructionPlaceholders = (input: {
	content: string | null;
	context: Ff15OperationPromptResolutionContext;
	definition: Ff15MissionOperationDefinition;
}): string | null => {
	if (!input.content?.includes("{{")) {
		return input.content;
	}

	const outputResolved = input.content.replace(
		OUTPUT_PLACEHOLDER_PATTERN,
		(_match, stepName: string, selector: string, fileName: string) =>
			resolveOutputPlaceholderPath({
				context: input.context,
				definition: input.definition,
				fileName,
				selector,
				stepName,
			})
	);

	const settingResolved = outputResolved.replace(
		SETTING_PLACEHOLDER_PATTERN,
		(_match, key: string, mode: string) =>
			resolveSettingPlaceholderValue(key, mode, input.context.settings)
	);

	const rootResolved = settingResolved.replace(
		ROOT_PLACEHOLDER_PATTERN,
		(_match, scope: string) =>
			resolveRootPlaceholderValue(scope, input.context.workspaceRoot)
	);

	const resolved = rootResolved.replace(
		FACET_SKILL_PLACEHOLDER_PATTERN,
		(_match, skillName: string) =>
			resolveFacetSkillPlaceholderValue(skillName, input.context.workspaceRoot)
	);

	if (resolved.includes("{{ output(")) {
		throw new Error(
			'Invalid output placeholder syntax. Use {{ output("step", "selector", "file") }}.'
		);
	}

	if (resolved.includes("{{ setting(")) {
		throw new Error(
			'Invalid setting placeholder syntax. Use {{ setting("key", "mode") }}.'
		);
	}

	if (resolved.includes("{{ root(")) {
		throw new Error(
			'Invalid root placeholder syntax. Use {{ root("scope") }}.'
		);
	}

	if (resolved.includes("{{ facet_skill(")) {
		throw new Error(
			'Invalid facet_skill placeholder syntax. Use {{ facet_skill("name") }}.'
		);
	}

	return resolved;
};

const buildOperationStepSections = (
	activation: Ff15MissionOperationActivation,
	context: Ff15OperationPromptResolutionContext
): string[] =>
	[
		buildTextSection(
			"instruction",
			resolveInstructionPlaceholders({
				content: activation.step?.instruction ?? null,
				context,
				definition: activation.definition,
			})
		),
		...buildOutputContractSections(
			activation,
			activation.step?.outputContracts ?? [],
			context
		),
	].filter((section): section is string => section != null);

const buildHandoffContextSection = (
	handoff: Ff15MissionWorkflowStepHistoryEntry | null
): string | null =>
	buildPlainSection("handoff-context", [
		`previous_step: ${handoff?.fromStep ?? "unknown"}`,
		`previous_step_owner: ${handoff?.fromAgent ?? "unknown"}`,
		`task_id: ${handoff?.taskId ?? "unknown"}`,
		`selected_next: ${handoff?.next ?? "unknown"}`,
		`handoff_summary: ${
			handoff?.handoffSummary ?? "No handoff summary provided."
		}`,
	]);

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
	workflow: Ff15MissionWorkflowState;
	workspaceRoot: string;
}): string | null => {
	if (!input.activation.step || input.activation.step.rules.length === 0) {
		return null;
	}

	const bridgeScriptPath = toShellSafePath(
		join(
			input.workspaceRoot,
			FF15_WORKSPACE_RUNTIME_DIR_NAME,
			"bridge",
			"bridge.mjs"
		)
	);
	const taskId = getOperationStepTaskId({
		stepName: input.activation.stepName,
		workflow: input.workflow,
	});

	const commandLine = `node "${bridgeScriptPath}" submit-report ${input.missionId} ${taskId} <next> "<message>"`;

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
			`- ${commandLine}`,
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
	activeProjects?: string[];
	missionId: string;
	openspecRoot?: string | null;
	prompt: string;
	settings?: Ff15OperationPromptSettings;
	workflow?: Ff15MissionWorkflowState;
	workspaceRoot: string;
}): string => {
	const workflow = input.workflow ?? createEmptyFf15MissionWorkflowState();

	return (
		wrapXmlSection(
			"operation-prompt",
			[
				buildPlainSection("workspace-context", [
					`execution_root: ${toShellSafePath(input.workspaceRoot)}`,
				]),
				buildPlainSection(
					"tooling-context",
					buildToolingContextLines({
						activeProjects: input.activeProjects,
						openspecRoot: input.openspecRoot,
						workspaceRoot: input.workspaceRoot,
					})
				),
				buildPlainSection("workflow-context", [
					`operation: ${input.activation.operationName}`,
					`step: ${input.activation.stepName}`,
					`task: ${input.activation.activeTask}`,
					`agent: ${input.activation.stepAgent ?? "noctis"}`,
				]),
				...buildOperationStepSections(input.activation, {
					missionId: input.missionId,
					settings: input.settings,
					workflow,
					workspaceRoot: input.workspaceRoot,
				}),
				buildStepCompletionContract({
					activation: input.activation,
					missionId: input.missionId,
					workflow,
					workspaceRoot: input.workspaceRoot,
				}),
				buildTextSection("user-request", input.prompt, {
					from: "user",
					to: "noctis",
				}),
			]
				.filter((section): section is string => section != null)
				.join("\n\n")
		) ?? ""
	);
};

export const buildWorkerOperationAwarePrompt = (input: {
	activation: Ff15MissionOperationActivation;
	activeProjects?: string[];
	handoff: Ff15MissionWorkflowStepHistoryEntry | null;
	missionId: string;
	openspecRoot?: string | null;
	settings?: Ff15OperationPromptSettings;
	workflow?: Ff15MissionWorkflowState;
	workspaceRoot: string;
}): string => {
	const workflow = input.workflow ?? createEmptyFf15MissionWorkflowState();

	return (
		wrapXmlSection(
			"operation-prompt",
			[
				buildPlainSection("workspace-context", [
					`execution_root: ${toShellSafePath(input.workspaceRoot)}`,
				]),
				buildPlainSection(
					"tooling-context",
					buildToolingContextLines({
						activeProjects: input.activeProjects,
						openspecRoot: input.openspecRoot,
						workspaceRoot: input.workspaceRoot,
					})
				),
				buildPlainSection("workflow-context", [
					`operation: ${input.activation.operationName}`,
					`step: ${input.activation.stepName}`,
					`task: ${input.activation.activeTask}`,
					`agent: ${input.activation.stepAgent ?? "noctis"}`,
				]),
				buildHandoffContextSection(input.handoff),
				...buildOperationStepSections(input.activation, {
					missionId: input.missionId,
					settings: input.settings,
					workflow,
					workspaceRoot: input.workspaceRoot,
				}),
				buildStepCompletionContract({
					activation: input.activation,
					missionId: input.missionId,
					workflow,
					workspaceRoot: input.workspaceRoot,
				}),
			]
				.filter((section): section is string => section != null)
				.join("\n\n")
		) ?? ""
	);
};
