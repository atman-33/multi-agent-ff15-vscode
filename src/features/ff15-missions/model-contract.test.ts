import { describe, expect, it } from "vitest";
import {
	FF15_OPENCODE_MODEL_CATALOG,
	normalizeFf15AgentModelSelection,
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
});
