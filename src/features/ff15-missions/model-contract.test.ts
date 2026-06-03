import { describe, expect, it } from "vitest";
import {
	FF15_OPENCODE_MODEL_CATALOG,
	patchFf15MissionProviderStateAgentModelSelection,
	normalizeFf15AgentModelSelection,
	normalizeFf15MissionProviderState,
	resolveFf15MissionModelCatalog,
	resolveFf15MissionProviderAgentModels,
} from "./model-contract";

describe("OpenCode model contract", () => {
	it("stores Reasoning Effort options on each model definition", () => {
		expect(FF15_OPENCODE_MODEL_CATALOG).toEqual([
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
		]);
	});

	it("normalizes against model-scoped effort ranges and no-effort models", () => {
		const catalog = [
			{
				efforts: [
					{ label: "Low", value: "1" },
					{ label: "Medium", value: "2" },
					{ label: "High", value: "3" },
					{ label: "Max", value: "4" },
				],
				id: "future-four-step",
				name: "Future Four Step",
			},
			{ efforts: [], id: "instant", name: "Instant" },
		];

		expect(
			normalizeFf15AgentModelSelection(
				{ effort: "4", modelId: "future-four-step" },
				catalog
			)
		).toEqual({ effort: "4", modelId: "future-four-step" });
		expect(
			normalizeFf15AgentModelSelection(
				{ effort: "2", modelId: "instant" },
				catalog
			)
		).toEqual({ effort: null, modelId: "instant" });
	});

	it("resolves provider-aware mission model state from the pinned provider only", () => {
		const providerState = normalizeFf15MissionProviderState({
			"github-copilot-cli": {
				agentModels: {
					ignis: { effort: "3", modelId: "gpt-5-mini" },
				},
			},
		});

		expect(resolveFf15MissionModelCatalog("github-copilot-cli")).toEqual(
			FF15_OPENCODE_MODEL_CATALOG
		);
		expect(
			resolveFf15MissionProviderAgentModels({
				providerId: "opencode",
				providerState,
			})
		).toBeNull();
		expect(
			resolveFf15MissionProviderAgentModels({
				providerId: "github-copilot-cli",
				providerState,
			})
		).toEqual(
			expect.objectContaining({
				ignis: { effort: "3", modelId: "gpt-5-mini" },
			})
		);
	});

	it("patches only the provider-owned model state for the active provider", () => {
		const providerState = patchFf15MissionProviderStateAgentModelSelection({
			agentId: "noctis",
			providerId: "github-copilot-cli",
			providerState: {},
			selection: { effort: "3", modelId: "gpt-5.4" },
		});

		expect(providerState["github-copilot-cli"].agentModels.noctis).toEqual({
			effort: "3",
			modelId: "gpt-5.4",
		});
		expect(providerState.opencode.agentModels).toBeNull();
	});
});
