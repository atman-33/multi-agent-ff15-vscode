import type {
	CreateFf15LaunchClientDependencies,
	Ff15LaunchClient,
	Ff15LaunchClientId,
} from "../ff15-launch/launch-client";
import { createFf15LaunchClient } from "../ff15-launch/launch-client";
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

export interface Ff15MissionProviderCapabilities {
	modelSelection: boolean;
}

export interface Ff15MissionProviderAdapter {
	id: Ff15LaunchClientId;
	buildContinueInputSequence: () => string[];
	buildModelInputSequence: (input: {
		effort: string | null;
		model: Ff15OpenCodeModelDefinition;
	}) => string[];
	capabilities: Ff15MissionProviderCapabilities;
	createLaunchClient: (
		dependencies: CreateFf15LaunchClientDependencies
	) => Ff15LaunchClient;
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

const buildModelInputSequence = (input: {
	effort: string | null;
	model: Ff15OpenCodeModelDefinition;
}): string[] => {
	const sequence = ["/model", input.model.name];
	if (input.effort !== null) {
		sequence.push(input.effort);
	}

	return sequence;
};

const createAdapter = (
	id: Ff15LaunchClientId,
	overrides: Partial<Ff15MissionProviderAdapter> = {}
): Ff15MissionProviderAdapter => ({
	id,
	buildContinueInputSequence: () => ["Continue"],
	buildModelInputSequence,
	capabilities: {
		modelSelection: id === "github-copilot-cli",
	},
	createLaunchClient: (dependencies) =>
		createFf15LaunchClient(id, dependencies),
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
