import {
	type Ff15AgentId,
	FF15_AGENT_IDS,
	type Ff15LaunchClientId,
} from "../ff15-launch/launch-client";

export interface Ff15OpenCodeModelEffortOption {
	label: string;
	value: string;
}

export interface Ff15OpenCodeModelDefinition {
	efforts: Ff15OpenCodeModelEffortOption[];
	id: string;
	name: string;
}

export interface Ff15MissionAgentModelSelection {
	effort: string | null;
	modelId: string;
}

export type Ff15MissionAgentModels = Record<
	Ff15AgentId,
	Ff15MissionAgentModelSelection
>;

export interface Ff15MissionGithubCopilotCliProviderState {
	agentModels: Ff15MissionAgentModels;
}

export interface Ff15MissionOpenCodeProviderState {
	agentModels: Ff15MissionAgentModels;
}

export interface Ff15MissionProviderState {
	"github-copilot-cli": Ff15MissionGithubCopilotCliProviderState;
	opencode: Ff15MissionOpenCodeProviderState;
}

export interface Ff15MissionBulkModelPresets {
	"github-copilot-cli": Ff15MissionAgentModelSelection;
	opencode: Ff15MissionAgentModelSelection;
}

export const FF15_OPENCODE_MODEL_CATALOG: Ff15OpenCodeModelDefinition[] = [
	{
		efforts: [
			{ label: "Low", value: "1" },
			{ label: "Medium", value: "2" },
			{ label: "High", value: "3" },
		],
		id: "gpt-5.4",
		name: "GPT-5.4",
	},
	{
		efforts: [
			{ label: "Low", value: "1" },
			{ label: "Medium", value: "2" },
			{ label: "High", value: "3" },
		],
		id: "gpt-5-mini",
		name: "GPT-5 mini",
	},
	{
		efforts: [],
		id: "claude-haiku-4.5",
		name: "Claude Haiku 4.5",
	},
];

export const resolveFf15OpenCodeModelDefinition = (
	modelId: string,
	catalog: readonly Ff15OpenCodeModelDefinition[] = FF15_OPENCODE_MODEL_CATALOG
): Ff15OpenCodeModelDefinition | null =>
	catalog.find((model) => model.id === modelId) ?? null;

export const createDefaultFf15AgentModelSelection = (
	catalog: readonly Ff15OpenCodeModelDefinition[] = FF15_OPENCODE_MODEL_CATALOG
): Ff15MissionAgentModelSelection => {
	const model = catalog[0] ?? { efforts: [], id: "unknown", name: "Unknown" };

	return {
		effort: model.efforts[0]?.value ?? null,
		modelId: model.id,
	};
};

export const normalizeFf15AgentModelSelection = (
	value: unknown,
	catalog: readonly Ff15OpenCodeModelDefinition[] = FF15_OPENCODE_MODEL_CATALOG
): Ff15MissionAgentModelSelection => {
	const fallback = createDefaultFf15AgentModelSelection(catalog);
	if (!value || typeof value !== "object") {
		return fallback;
	}

	const candidate = value as Record<string, unknown>;
	if (typeof candidate.modelId !== "string") {
		return fallback;
	}

	const model = resolveFf15OpenCodeModelDefinition(candidate.modelId, catalog);
	if (!model) {
		return fallback;
	}

	const effort =
		typeof candidate.effort === "string" &&
		model.efforts.some((option) => option.value === candidate.effort)
			? candidate.effort
			: (model.efforts[0]?.value ?? null);

	return {
		effort,
		modelId: model.id,
	};
};

const normalizeFf15AgentModelSelectionPreserving = (
	value: unknown,
	fallback: Ff15MissionAgentModelSelection = createDefaultFf15AgentModelSelection()
): Ff15MissionAgentModelSelection => {
	if (!value || typeof value !== "object") {
		return fallback;
	}

	const candidate = value as Record<string, unknown>;
	if (typeof candidate.modelId !== "string" || candidate.modelId.length === 0) {
		return fallback;
	}

	return {
		effort: typeof candidate.effort === "string" ? candidate.effort : null,
		modelId: candidate.modelId,
	};
};

export const createDefaultFf15MissionAgentModels = (
	catalog: readonly Ff15OpenCodeModelDefinition[] = FF15_OPENCODE_MODEL_CATALOG
): Ff15MissionAgentModels =>
	Object.fromEntries(
		FF15_AGENT_IDS.map((agentId) => [
			agentId,
			createDefaultFf15AgentModelSelection(catalog),
		])
	) as Ff15MissionAgentModels;

export const normalizeFf15MissionAgentModels = (
	value: unknown,
	catalog: readonly Ff15OpenCodeModelDefinition[] = FF15_OPENCODE_MODEL_CATALOG
): Ff15MissionAgentModels => {
	const normalized = createDefaultFf15MissionAgentModels(catalog);
	if (!value || typeof value !== "object") {
		return normalized;
	}

	const agentModels = value as Record<string, unknown>;
	for (const agentId of FF15_AGENT_IDS) {
		normalized[agentId] = normalizeFf15AgentModelSelection(
			agentModels[agentId],
			catalog
		);
	}

	return normalized;
};

const normalizeFf15MissionAgentModelsPreserving = (
	value: unknown,
	catalog: readonly Ff15OpenCodeModelDefinition[] = FF15_OPENCODE_MODEL_CATALOG
): Ff15MissionAgentModels => {
	const normalized = createDefaultFf15MissionAgentModels(catalog);
	if (!value || typeof value !== "object") {
		return normalized;
	}

	const agentModels = value as Record<string, unknown>;
	for (const agentId of FF15_AGENT_IDS) {
		normalized[agentId] = normalizeFf15AgentModelSelectionPreserving(
			agentModels[agentId],
			normalized[agentId]
		);
	}

	return normalized;
};

export const createDefaultFf15MissionProviderState = (
	catalog: readonly Ff15OpenCodeModelDefinition[] = FF15_OPENCODE_MODEL_CATALOG
): Ff15MissionProviderState => ({
	"github-copilot-cli": {
		agentModels: createDefaultFf15MissionAgentModels(catalog),
	},
	opencode: {
		agentModels: createDefaultFf15MissionAgentModels(catalog),
	},
});

export const createDefaultFf15MissionBulkModelPresets = (
	catalog: readonly Ff15OpenCodeModelDefinition[] = FF15_OPENCODE_MODEL_CATALOG
): Ff15MissionBulkModelPresets => ({
	"github-copilot-cli": createDefaultFf15AgentModelSelection(catalog),
	opencode: createDefaultFf15AgentModelSelection(catalog),
});

export const normalizeFf15MissionBulkModelPresets = (
	value: unknown,
	catalog: readonly Ff15OpenCodeModelDefinition[] = FF15_OPENCODE_MODEL_CATALOG
): Ff15MissionBulkModelPresets => {
	const presets =
		value && typeof value === "object"
			? (value as Record<string, unknown>)
			: {};

	return {
		"github-copilot-cli": normalizeFf15AgentModelSelection(
			presets["github-copilot-cli"],
			catalog
		),
		opencode: normalizeFf15AgentModelSelectionPreserving(
			presets.opencode,
			createDefaultFf15AgentModelSelection(catalog)
		),
	};
};

export const createFf15MissionProviderStateFromBulkModelPresets = (
	presets: Ff15MissionBulkModelPresets,
	catalog: readonly Ff15OpenCodeModelDefinition[] = FF15_OPENCODE_MODEL_CATALOG
): Ff15MissionProviderState => ({
	"github-copilot-cli": {
		agentModels: Object.fromEntries(
			FF15_AGENT_IDS.map((agentId) => [
				agentId,
				normalizeFf15AgentModelSelection(
					presets["github-copilot-cli"],
					catalog
				),
			])
		) as Ff15MissionAgentModels,
	},
	opencode: {
		agentModels: Object.fromEntries(
			FF15_AGENT_IDS.map((agentId) => [
				agentId,
				normalizeFf15AgentModelSelectionPreserving(
					presets.opencode,
					createDefaultFf15AgentModelSelection(catalog)
				),
			])
		) as Ff15MissionAgentModels,
	},
});

const normalizeFf15MissionGithubCopilotCliProviderState = (
	value: unknown,
	catalog: readonly Ff15OpenCodeModelDefinition[] = FF15_OPENCODE_MODEL_CATALOG
): Ff15MissionGithubCopilotCliProviderState => {
	if (!value || typeof value !== "object") {
		return createDefaultFf15MissionProviderState(catalog)["github-copilot-cli"];
	}

	const providerState = value as Record<string, unknown>;
	return {
		agentModels: normalizeFf15MissionAgentModels(
			providerState.agentModels,
			catalog
		),
	};
};

const normalizeFf15MissionOpenCodeProviderState = (
	value: unknown,
	catalog: readonly Ff15OpenCodeModelDefinition[] = FF15_OPENCODE_MODEL_CATALOG
): Ff15MissionOpenCodeProviderState => {
	if (!value || typeof value !== "object") {
		return createDefaultFf15MissionProviderState(catalog).opencode;
	}

	const providerState = value as Record<string, unknown>;
	return {
		agentModels: normalizeFf15MissionAgentModelsPreserving(
			providerState.agentModels,
			catalog
		),
	};
};

export const normalizeFf15MissionProviderState = (
	value: unknown,
	catalog: readonly Ff15OpenCodeModelDefinition[] = FF15_OPENCODE_MODEL_CATALOG
): Ff15MissionProviderState => {
	const providerState =
		value && typeof value === "object"
			? (value as Record<string, unknown>)
			: {};

	return {
		"github-copilot-cli": normalizeFf15MissionGithubCopilotCliProviderState(
			providerState["github-copilot-cli"],
			catalog
		),
		opencode: normalizeFf15MissionOpenCodeProviderState(
			providerState.opencode,
			catalog
		),
	};
};

export const resolveFf15MissionModelCatalog = (
	providerId: Ff15LaunchClientId,
	catalog: readonly Ff15OpenCodeModelDefinition[] = FF15_OPENCODE_MODEL_CATALOG
): Ff15OpenCodeModelDefinition[] =>
	providerId === "github-copilot-cli" ? [...catalog] : [];

export const resolveFf15MissionProviderAgentModels = (input: {
	providerId: Ff15LaunchClientId;
	providerState: Ff15MissionProviderState | unknown;
	catalog?: readonly Ff15OpenCodeModelDefinition[];
}): Ff15MissionAgentModels | null => {
	const catalog = input.catalog ?? FF15_OPENCODE_MODEL_CATALOG;
	const providerState = normalizeFf15MissionProviderState(
		input.providerState,
		catalog
	);

	if (input.providerId === "opencode") {
		return providerState.opencode.agentModels;
	}

	if (input.providerId !== "github-copilot-cli") {
		return null;
	}

	return providerState["github-copilot-cli"].agentModels;
};

export const patchFf15MissionProviderStateAgentModelSelection = (input: {
	agentId: Ff15AgentId;
	catalog?: readonly Ff15OpenCodeModelDefinition[];
	providerId: Ff15LaunchClientId;
	providerState: Ff15MissionProviderState | unknown;
	selection: Ff15MissionAgentModelSelection;
}): Ff15MissionProviderState => {
	const catalog = input.catalog ?? FF15_OPENCODE_MODEL_CATALOG;
	const providerState = normalizeFf15MissionProviderState(
		input.providerState,
		catalog
	);

	if (input.providerId === "opencode") {
		return {
			...providerState,
			opencode: {
				agentModels: {
					...providerState.opencode.agentModels,
					[input.agentId]: normalizeFf15AgentModelSelectionPreserving(
						input.selection,
						providerState.opencode.agentModels[input.agentId]
					),
				},
			},
		};
	}

	if (input.providerId !== "github-copilot-cli") {
		return providerState;
	}

	return {
		...providerState,
		"github-copilot-cli": {
			agentModels: {
				...providerState["github-copilot-cli"].agentModels,
				[input.agentId]: normalizeFf15AgentModelSelection(
					input.selection,
					catalog
				),
			},
		},
	};
};
