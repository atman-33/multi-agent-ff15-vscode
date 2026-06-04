import type {
	CreateFf15LaunchClientDependencies,
	Ff15AgentId,
	Ff15LaunchClient,
	Ff15LaunchClientId,
	Ff15PaneLaunchPlanEntry,
} from "../ff15-launch/launch-client";
import {
	createFf15LaunchClient,
	FF15_AGENT_DISPLAY_NAMES,
} from "../ff15-launch/launch-client";
import {
	FF15_OPENCODE_MODEL_CATALOG,
	patchFf15MissionProviderStateAgentModelSelection,
	resolveFf15MissionModelCatalog,
	resolveFf15MissionProviderAgentModels,
	type Ff15MissionAgentModelSelection,
	type Ff15MissionAgentModels,
	type Ff15MissionProviderState,
	type Ff15OpenCodeModelDefinition,
} from "./model-contract";
import {
	createFf15MissionPaneInputSteps,
	type Ff15MissionPaneInputStep,
} from "./transport";
import type { Ff15MissionAgentPanes } from "./state";

export const FF15_MISSION_PROVIDER_MISSING_NOCTIS_PLAN_MESSAGE =
	"FF15 could not resolve a Noctis launch plan for the selected client.";

export interface Ff15MissionProviderActivationTransport {
	ensureMissionSession: (input: {
		allowCreateNoctisPane?: boolean;
		agentPanes?: Ff15MissionAgentPanes;
		missionId: string;
		paneLaunchPlanEntry: Ff15PaneLaunchPlanEntry;
		sessionName: string;
		workspaceRoot: string;
	}) => Promise<{ agentPanes?: Ff15MissionAgentPanes; paneId: string }>;
	sendPrompt: (input: {
		paneId: string;
		prompt: string;
		sessionName: string;
	}) => Promise<void>;
}

export interface Ff15MissionProviderFollowupTransport {
	reconcileMissionAgentPanes: (input: {
		agentPanes: Ff15MissionAgentPanes;
		sessionName: string;
		workspaceRoot: string;
	}) => Promise<Ff15MissionAgentPanes>;
	sendPrompt: (input: {
		paneId: string;
		prompt: string;
		sessionName: string;
	}) => Promise<void>;
}

export interface Ff15MissionProviderCapabilities {
	modelSelection: boolean;
}

export interface Ff15MissionProviderAdapter {
	id: Ff15LaunchClientId;
	buildContinueInputSequence: () => Ff15MissionPaneInputStep[];
	buildModelInputSequence: (input: {
		effort: string | null;
		model: Ff15OpenCodeModelDefinition;
	}) => Ff15MissionPaneInputStep[];
	buildVariantInputSequence: (input: {
		effort: string | null;
		model: Ff15OpenCodeModelDefinition;
	}) => Ff15MissionPaneInputStep[];
	capabilities: Ff15MissionProviderCapabilities;
	createLaunchClient: (
		dependencies: CreateFf15LaunchClientDependencies
	) => Ff15LaunchClient;
	deliverOperationActivationPrompt: (input: {
		agentPanes: Ff15MissionAgentPanes;
		allowCreateNoctisPane?: boolean;
		launchClient: Ff15LaunchClient;
		missionId: string;
		prompt: string;
		sessionName: string;
		transport: Ff15MissionProviderActivationTransport;
		workspaceRoot: string;
	}) => Promise<{ agentPanes: Ff15MissionAgentPanes; paneId: string }>;
	deliverOperationFollowupPrompt: (input: {
		agentId: Ff15AgentId;
		agentPanes: Ff15MissionAgentPanes;
		prompt: string;
		sessionName: string;
		transport: Ff15MissionProviderFollowupTransport;
		workspaceRoot: string;
	}) => Promise<{ agentPanes: Ff15MissionAgentPanes; paneId: string }>;
	getFallbackModelName: (modelId: string) => string;
	getMissionAgentModels: (input: {
		catalog?: readonly Ff15OpenCodeModelDefinition[];
		providerState: Ff15MissionProviderState | unknown;
	}) => Ff15MissionAgentModels | null;
	getModelCatalog: (
		catalog?: readonly Ff15OpenCodeModelDefinition[]
	) => Ff15OpenCodeModelDefinition[];
	patchProviderStateAgentModelSelection: (input: {
		agentId: keyof Ff15MissionAgentModels;
		catalog?: readonly Ff15OpenCodeModelDefinition[];
		providerState: Ff15MissionProviderState | unknown;
		selection: Ff15MissionAgentModelSelection;
	}) => Ff15MissionProviderState;
}

const buildGithubCopilotModelInputSequence = (input: {
	effort: string | null;
	model: Ff15OpenCodeModelDefinition;
}): Ff15MissionPaneInputStep[] => {
	const sequence = ["/model", input.model.name];
	if (input.effort !== null) {
		sequence.push(input.effort);
	}

	return createFf15MissionPaneInputSteps(sequence);
};

const buildOpenCodeModelInputSequence = (input: {
	effort: string | null;
	model: Ff15OpenCodeModelDefinition;
}): Ff15MissionPaneInputStep[] => {
	const sequence: Ff15MissionPaneInputStep[] = [
		{ kind: "write", value: "/models" },
		{ kind: "enter" },
		{ kind: "write", value: input.model.name },
		{ kind: "enter" },
	];
	if (input.effort !== null) {
		sequence.push(
			{ kind: "enter" },
			{ kind: "write", value: "/variants" },
			{ kind: "enter" },
			{ kind: "write", value: input.effort },
			{ kind: "enter" }
		);
	}

	return sequence;
};

const buildOpenCodeVariantInputSequence = (input: {
	effort: string | null;
	model: Ff15OpenCodeModelDefinition;
}): Ff15MissionPaneInputStep[] => {
	if (input.effort === null) {
		return [];
	}

	return [
		{ kind: "write", value: "/variants" },
		{ kind: "enter" },
		{ kind: "write", value: input.effort },
		{ kind: "enter" },
	];
};

const getNoctisPaneLaunchPlanEntry = (
	launchClient: Ff15LaunchClient
): Ff15PaneLaunchPlanEntry | undefined =>
	launchClient
		.getPaneLaunchPlan()
		.find((paneLaunchPlanEntry) => paneLaunchPlanEntry.agentId === "noctis");

const createAdapter = (
	id: Ff15LaunchClientId,
	overrides: Partial<Ff15MissionProviderAdapter> = {}
): Ff15MissionProviderAdapter => ({
	id,
	buildContinueInputSequence: () =>
		createFf15MissionPaneInputSteps(["Continue"]),
	buildModelInputSequence: buildGithubCopilotModelInputSequence,
	buildVariantInputSequence: buildGithubCopilotModelInputSequence,
	capabilities: {
		modelSelection: id === "github-copilot-cli",
	},
	createLaunchClient: (dependencies) =>
		createFf15LaunchClient(id, dependencies),
	deliverOperationActivationPrompt: async ({
		agentPanes,
		allowCreateNoctisPane,
		launchClient,
		missionId,
		prompt,
		sessionName,
		transport,
		workspaceRoot,
	}) => {
		const paneLaunchPlanEntry = getNoctisPaneLaunchPlanEntry(launchClient);
		if (!paneLaunchPlanEntry) {
			throw new Error(FF15_MISSION_PROVIDER_MISSING_NOCTIS_PLAN_MESSAGE);
		}

		const { agentPanes: resolvedAgentPanes, paneId } =
			await transport.ensureMissionSession({
				allowCreateNoctisPane,
				agentPanes,
				missionId,
				paneLaunchPlanEntry,
				sessionName,
				workspaceRoot,
			});
		const nextAgentPanes = resolvedAgentPanes ?? {
			...agentPanes,
			noctis: paneId,
		};

		await transport.sendPrompt({
			paneId,
			prompt,
			sessionName,
		});

		return {
			agentPanes: nextAgentPanes,
			paneId,
		};
	},
	deliverOperationFollowupPrompt: async ({
		agentId,
		agentPanes,
		prompt,
		sessionName,
		transport,
		workspaceRoot,
	}) => {
		const reconciledAgentPanes = await transport.reconcileMissionAgentPanes({
			agentPanes,
			sessionName,
			workspaceRoot,
		});
		const paneId = reconciledAgentPanes[agentId];
		if (!paneId) {
			throw new Error(
				`FF15 could not resolve a live ${FF15_AGENT_DISPLAY_NAMES[agentId]} pane for this mission.`
			);
		}

		await transport.sendPrompt({
			paneId,
			prompt,
			sessionName,
		});

		return {
			agentPanes: reconciledAgentPanes,
			paneId,
		};
	},
	getFallbackModelName: (modelId) =>
		id === "opencode" ? "OpenCode managed" : modelId,
	getMissionAgentModels: ({ catalog, providerState }) =>
		resolveFf15MissionProviderAgentModels({
			catalog,
			providerId: id,
			providerState,
		}),
	getModelCatalog: (catalog = FF15_OPENCODE_MODEL_CATALOG) =>
		resolveFf15MissionModelCatalog(id, catalog),
	patchProviderStateAgentModelSelection: ({
		agentId,
		catalog,
		providerState,
		selection,
	}) =>
		patchFf15MissionProviderStateAgentModelSelection({
			agentId,
			catalog,
			providerId: id,
			providerState,
			selection,
		}),
	...overrides,
});

const DEFAULT_FF15_MISSION_PROVIDER_ADAPTERS = {
	"github-copilot-cli": createAdapter("github-copilot-cli"),
	opencode: createAdapter("opencode", {
		buildModelInputSequence: buildOpenCodeModelInputSequence,
		buildVariantInputSequence: buildOpenCodeVariantInputSequence,
		capabilities: {
			modelSelection: true,
		},
		getModelCatalog: (catalog = FF15_OPENCODE_MODEL_CATALOG) => [...catalog],
	}),
} as const satisfies Record<Ff15LaunchClientId, Ff15MissionProviderAdapter>;

export const resolveFf15MissionProviderAdapter = (
	providerId: Ff15LaunchClientId
): Ff15MissionProviderAdapter =>
	DEFAULT_FF15_MISSION_PROVIDER_ADAPTERS[providerId];
