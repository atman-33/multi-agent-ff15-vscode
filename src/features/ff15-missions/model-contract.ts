import { type Ff15AgentId, FF15_AGENT_IDS } from "../ff15-launch/launch-client";

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
