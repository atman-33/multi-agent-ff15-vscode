import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FF15_WORKSPACE_RUNTIME_DIR_NAME } from "../ff15-missions/state";
import {
	FF15_BUNDLED_OPERATION_DEFINITIONS,
	FF15_WORKSPACE_OPERATIONS_DIR_NAME,
} from "./catalog";

interface ParsedOperationStep {
	agent: string | null;
	name: string;
}

interface ParsedOperationDefinition {
	initialStep: string | null;
	name: string | null;
	steps: ParsedOperationStep[];
}

const QUOTED_SCALAR_PATTERN = /^['"]|['"]$/gu;
const ROOT_NAME_PATTERN = /^name:\s*(.+?)\s*$/u;
const INITIAL_STEP_PATTERN = /^initial_step:\s*(.+?)\s*$/u;
const STEPS_HEADER_PATTERN = /^steps:\s*$/u;
const STEP_NAME_PATTERN = /^\s*-\s+name:\s*(.+?)\s*$/u;
const STEP_AGENT_PATTERN = /^\s*agent:\s*(.+?)\s*$/u;
const STEP_TASK_TOKEN_PATTERN = /[-_]+/u;
const LINE_SPLIT_PATTERN = /\r?\n/u;

export interface Ff15MissionOperationActivation {
	activeTask: string;
	operationName: string;
	stepAgent: string | null;
	stepName: string;
}

const getOperationFileName = (operationRef: string): string | null =>
	FF15_BUNDLED_OPERATION_DEFINITIONS.find(
		(operationDefinition) => operationDefinition.ref === operationRef
	)?.fileName ?? null;

const cleanScalar = (value: string): string =>
	value.trim().replace(QUOTED_SCALAR_PATTERN, "");

export const formatFf15OperationTaskLabel = (stepName: string): string =>
	stepName
		.split(STEP_TASK_TOKEN_PATTERN)
		.filter((segment) => segment.length > 0)
		.map((segment) => `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`)
		.join(" ");

const tryReadRootField = (
	line: string,
	parsed: ParsedOperationDefinition
): boolean => {
	const nameMatch = ROOT_NAME_PATTERN.exec(line);
	if (nameMatch) {
		parsed.name = cleanScalar(nameMatch[1]);
		return true;
	}

	const initialStepMatch = INITIAL_STEP_PATTERN.exec(line);
	if (initialStepMatch) {
		parsed.initialStep = cleanScalar(initialStepMatch[1]);
		return true;
	}

	return STEPS_HEADER_PATTERN.test(line);
};

const shouldStopReadingSteps = (line: string): boolean =>
	line.trim().length > 0 && !line.startsWith(" ");

const consumeStepLine = (
	line: string,
	currentStep: ParsedOperationStep | null,
	steps: ParsedOperationStep[]
): ParsedOperationStep | null => {
	if (line.trim().length === 0) {
		return currentStep;
	}

	const stepNameMatch = STEP_NAME_PATTERN.exec(line);
	if (stepNameMatch) {
		if (currentStep) {
			steps.push(currentStep);
		}

		return {
			agent: null,
			name: cleanScalar(stepNameMatch[1]),
		};
	}

	if (!currentStep) {
		return currentStep;
	}

	const agentMatch = STEP_AGENT_PATTERN.exec(line);
	if (agentMatch) {
		currentStep.agent = cleanScalar(agentMatch[1]);
	}

	return currentStep;
};

const parseOperationDefinition = (
	definitionSource: string
): ParsedOperationDefinition => {
	const parsed: ParsedOperationDefinition = {
		initialStep: null,
		name: null,
		steps: [],
	};
	let currentStep: ParsedOperationStep | null = null;
	let readingSteps = false;

	for (const line of definitionSource.split(LINE_SPLIT_PATTERN)) {
		if (!readingSteps) {
			if (tryReadRootField(line, parsed)) {
				readingSteps = STEPS_HEADER_PATTERN.test(line);
			}

			continue;
		}

		if (shouldStopReadingSteps(line)) {
			break;
		}

		currentStep = consumeStepLine(line, currentStep, parsed.steps);
	}

	if (currentStep) {
		parsed.steps.push(currentStep);
	}

	return parsed;
};

export const loadMissionOperationActivation = (
	workspaceRoot: string,
	operationRef: string
): Ff15MissionOperationActivation | null => {
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
	const stepName = parsedDefinition.initialStep;
	if (!stepName) {
		return null;
	}

	const activeStep =
		parsedDefinition.steps.find((step) => step.name === stepName) ?? null;
	const operationName = parsedDefinition.name ?? operationRef;

	return {
		activeTask: formatFf15OperationTaskLabel(stepName),
		operationName,
		stepAgent: activeStep?.agent ?? null,
		stepName,
	};
};

export const buildOperationAwarePrompt = (input: {
	activation: Ff15MissionOperationActivation;
	prompt: string;
}): string =>
	[
		"You are executing an FF15 operation-backed mission.",
		`Operation: ${input.activation.operationName}`,
		`Active step: ${input.activation.stepName}`,
		`Active task: ${input.activation.activeTask}`,
		input.activation.stepAgent
			? `Step agent: ${input.activation.stepAgent}`
			: null,
		"",
		"User request:",
		input.prompt,
	]
		.filter((line): line is string => line != null)
		.join("\n");
