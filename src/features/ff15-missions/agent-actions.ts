import { FF15_AGENT_IDS, type Ff15AgentId } from "../ff15-launch/launch-client";
import {
	FF15_OPENCODE_MODEL_CATALOG,
	resolveFf15OpenCodeModelDefinition,
	type Ff15MissionAgentModelSelection,
	type Ff15OpenCodeModelDefinition,
} from "./model-contract";
import { resolveFf15MissionProviderAdapter } from "./mission-provider-adapter";
import {
	createDefaultMissionOpenCodeModelCatalogResolution,
	resolveMissionOpenCodeModelCatalog,
} from "./opencode-model-catalog";
import type { Ff15MissionsStore } from "./state";
import type { Ff15MissionPaneInputStep } from "./transport";

export const FF15_AGENT_ACTION_PANE_UNAVAILABLE_MESSAGE =
	"FF15 could not resolve a live pane for that agent.";
export const FF15_AGENT_ACTION_SESSION_UNAVAILABLE_MESSAGE =
	"Launch Terminal before using party roster actions.";
export const FF15_AGENT_MODEL_UNAVAILABLE_MESSAGE =
	"FF15 could not resolve the selected OpenCode model.";
export const FF15_AGENT_MODEL_EFFORT_UNAVAILABLE_MESSAGE =
	"FF15 could not resolve the selected Reasoning Effort option.";
export const FF15_AGENT_MODEL_PROVIDER_UNAVAILABLE_MESSAGE =
	"FF15 model switching is unavailable for the pinned mission provider.";

interface Ff15MissionAgentActionTransport {
	reconcileMissionAgentPanes: (input: {
		agentPanes?: Record<Ff15AgentId, string | null>;
		sessionName: string;
		workspaceRoot: string;
	}) => Promise<Record<Ff15AgentId, string | null>>;
	sendPaneInputSequence: (input: {
		steps: Ff15MissionPaneInputStep[];
		paneId: string;
		sessionName: string;
	}) => Promise<void>;
}

interface CreateFf15MissionAgentActionControllerOptions {
	loadOpenCodeModelCatalog?: (workspaceRoot: string) =>
		| Promise<{
				lastError: string | null;
				refreshState: "error" | "ready" | "refreshing" | "unavailable";
				snapshot: { models: Ff15OpenCodeModelDefinition[] } | null;
				stale: boolean;
		  }>
		| {
				lastError: string | null;
				refreshState: "error" | "ready" | "refreshing" | "unavailable";
				snapshot: { models: Ff15OpenCodeModelDefinition[] } | null;
				stale: boolean;
		  };
	modelCatalog?: readonly Ff15OpenCodeModelDefinition[];
	missionTransport: Ff15MissionAgentActionTransport;
	missionsStore: Ff15MissionsStore;
}

const resolveAgentPaneActionContext = async (
	missionTransport: Ff15MissionAgentActionTransport,
	missionsStore: Ff15MissionsStore,
	missionId: string,
	agentId: Ff15AgentId
) => {
	const mission = missionsStore.getMissionRecord(missionId);
	if (!mission) {
		return { error: FF15_AGENT_ACTION_SESSION_UNAVAILABLE_MESSAGE } as const;
	}

	if (!(mission.sessionName && mission.workspaceRoot)) {
		return { error: FF15_AGENT_ACTION_SESSION_UNAVAILABLE_MESSAGE } as const;
	}

	let agentPanes = mission.agentPanes;
	let paneId = agentPanes[agentId];
	if (!paneId) {
		try {
			agentPanes = await missionTransport.reconcileMissionAgentPanes({
				agentPanes: mission.agentPanes,
				sessionName: mission.sessionName,
				workspaceRoot: mission.workspaceRoot,
			});
			paneId = agentPanes[agentId];
		} catch {
			paneId = null;
		}
	}

	if (!paneId) {
		return { error: FF15_AGENT_ACTION_PANE_UNAVAILABLE_MESSAGE } as const;
	}

	return {
		agentPanes,
		mission,
		paneId,
		sessionName: mission.sessionName,
	} as const;
};

export const createFf15MissionAgentActionController = (
	options: CreateFf15MissionAgentActionControllerOptions
) => {
	const modelCatalog = options.modelCatalog ?? FF15_OPENCODE_MODEL_CATALOG;
	const getResolvedCatalog = (
		mission: NonNullable<ReturnType<Ff15MissionsStore["getMissionRecord"]>>
	) => {
		if (
			!(mission.providerId === "opencode" && options.loadOpenCodeModelCatalog)
		) {
			return createDefaultMissionOpenCodeModelCatalogResolution({
				defaultCatalog: modelCatalog,
				mission,
			});
		}

		return resolveMissionOpenCodeModelCatalog({
			defaultCatalog: modelCatalog,
			loadOpenCodeModelCatalog: options.loadOpenCodeModelCatalog,
			mission,
		});
	};
	const getBulkActionMission = (missionId: string) => {
		const mission = options.missionsStore.getMissionRecord(missionId);
		if (!(mission?.sessionName && mission.workspaceRoot)) {
			return null;
		}

		return mission;
	};
	const resolveModelSelection = async (input: {
		mission: NonNullable<ReturnType<Ff15MissionsStore["getMissionRecord"]>>;
		selection: Ff15MissionAgentModelSelection;
	}) => {
		const adapter = resolveFf15MissionProviderAdapter(input.mission.providerId);
		const resolvedCatalog = await getResolvedCatalog(input.mission);
		const missionModelCatalog = adapter.getModelCatalog(
			resolvedCatalog.modelCatalog
		);
		if (
			!adapter.capabilities.modelSelection ||
			missionModelCatalog.length === 0
		) {
			return {
				error: FF15_AGENT_MODEL_PROVIDER_UNAVAILABLE_MESSAGE,
			} as const;
		}

		const model = resolveFf15OpenCodeModelDefinition(
			input.selection.modelId,
			missionModelCatalog
		);
		if (!model) {
			return { error: FF15_AGENT_MODEL_UNAVAILABLE_MESSAGE } as const;
		}

		const effort = input.selection.effort;
		if (
			effort !== null &&
			!model.efforts.some((option) => option.value === effort)
		) {
			return {
				error: FF15_AGENT_MODEL_EFFORT_UNAVAILABLE_MESSAGE,
			} as const;
		}

		return {
			adapter,
			missionModelCatalog,
			model,
			selection: {
				effort:
					model.efforts.length > 0 ? (effort ?? model.efforts[0].value) : null,
				modelId: model.id,
			},
		} as const;
	};
	const reconcileBulkAgentPanes = async (
		mission: NonNullable<ReturnType<Ff15MissionsStore["getMissionRecord"]>>
	) => {
		try {
			return await options.missionTransport.reconcileMissionAgentPanes({
				agentPanes: mission.agentPanes,
				sessionName: mission.sessionName,
				workspaceRoot: mission.workspaceRoot,
			});
		} catch {
			return mission.agentPanes;
		}
	};
	const patchBulkProviderState = (input: {
		adapter: ReturnType<typeof resolveFf15MissionProviderAdapter>;
		catalog: readonly Ff15OpenCodeModelDefinition[];
		providerState: NonNullable<
			ReturnType<Ff15MissionsStore["getMissionRecord"]>
		>["providerState"];
		selection: Ff15MissionAgentModelSelection;
	}) => {
		let providerState = input.providerState;
		for (const agentId of FF15_AGENT_IDS) {
			providerState = input.adapter.patchProviderStateAgentModelSelection({
				agentId,
				catalog: input.catalog,
				providerState,
				selection: input.selection,
			});
		}

		return providerState;
	};

	return {
		async applyBulkModelSelection(input: {
			missionId: string;
			selection: Ff15MissionAgentModelSelection;
		}) {
			const mission = getBulkActionMission(input.missionId);
			if (!mission) {
				return options.missionsStore.updateMission(input.missionId, {
					lastError: FF15_AGENT_ACTION_SESSION_UNAVAILABLE_MESSAGE,
				});
			}

			const resolvedSelection = await resolveModelSelection({
				mission,
				selection: input.selection,
			});
			if ("error" in resolvedSelection) {
				return options.missionsStore.updateMission(input.missionId, {
					lastError: resolvedSelection.error,
				});
			}

			const agentPanes = await reconcileBulkAgentPanes(mission);

			const livePaneEntries = FF15_AGENT_IDS.flatMap((agentId) => {
				const paneId = agentPanes[agentId];
				return paneId ? [{ agentId, paneId }] : [];
			});
			if (livePaneEntries.length === 0) {
				return options.missionsStore.updateMission(input.missionId, {
					agentPanes,
					lastError: FF15_AGENT_ACTION_PANE_UNAVAILABLE_MESSAGE,
				});
			}

			const steps = resolvedSelection.adapter.buildModelInputSequence({
				effort: resolvedSelection.selection.effort,
				model: resolvedSelection.model,
			});
			await Promise.all(
				livePaneEntries.map(({ paneId }) =>
					options.missionTransport.sendPaneInputSequence({
						steps,
						paneId,
						sessionName: mission.sessionName,
					})
				)
			);

			return options.missionsStore.updateMission(input.missionId, {
				providerState: patchBulkProviderState({
					adapter: resolvedSelection.adapter,
					catalog: resolvedSelection.missionModelCatalog,
					providerState: mission.providerState,
					selection: resolvedSelection.selection,
				}),
				agentPanes,
				lastError: null,
			});
		},

		async continueAgent(input: { agentId: Ff15AgentId; missionId: string }) {
			const context = await resolveAgentPaneActionContext(
				options.missionTransport,
				options.missionsStore,
				input.missionId,
				input.agentId
			);
			if ("error" in context) {
				return options.missionsStore.updateMission(input.missionId, {
					lastError: context.error,
				});
			}

			const adapter = resolveFf15MissionProviderAdapter(
				context.mission.providerId
			);

			await options.missionTransport.sendPaneInputSequence({
				steps: adapter.buildContinueInputSequence(),
				paneId: context.paneId,
				sessionName: context.sessionName,
			});

			return options.missionsStore.updateMission(input.missionId, {
				agentPanes: context.agentPanes,
				lastError: null,
			});
		},

		async changeAgentModel(input: {
			agentId: Ff15AgentId;
			effort: string | null;
			missionId: string;
			modelId: string;
		}) {
			const context = await resolveAgentPaneActionContext(
				options.missionTransport,
				options.missionsStore,
				input.missionId,
				input.agentId
			);
			if ("error" in context) {
				return options.missionsStore.updateMission(input.missionId, {
					lastError: context.error,
				});
			}

			const adapter = resolveFf15MissionProviderAdapter(
				context.mission.providerId
			);

			const resolvedCatalog = await getResolvedCatalog(context.mission);
			const missionModelCatalog = adapter.getModelCatalog(
				resolvedCatalog.modelCatalog
			);
			if (
				!adapter.capabilities.modelSelection ||
				missionModelCatalog.length === 0
			) {
				return options.missionsStore.updateMission(input.missionId, {
					lastError: FF15_AGENT_MODEL_PROVIDER_UNAVAILABLE_MESSAGE,
				});
			}

			const model = resolveFf15OpenCodeModelDefinition(
				input.modelId,
				missionModelCatalog
			);
			if (!model) {
				return options.missionsStore.updateMission(input.missionId, {
					lastError: FF15_AGENT_MODEL_UNAVAILABLE_MESSAGE,
				});
			}

			const effort = input.effort;
			if (
				effort !== null &&
				!model.efforts.some((option) => option.value === effort)
			) {
				return options.missionsStore.updateMission(input.missionId, {
					lastError: FF15_AGENT_MODEL_EFFORT_UNAVAILABLE_MESSAGE,
				});
			}

			const selection: Ff15MissionAgentModelSelection = {
				effort:
					model.efforts.length > 0 ? (effort ?? model.efforts[0].value) : null,
				modelId: model.id,
			};

			await options.missionTransport.sendPaneInputSequence({
				steps: adapter.buildModelInputSequence({
					effort: selection.effort,
					model,
				}),
				paneId: context.paneId,
				sessionName: context.sessionName,
			});

			return options.missionsStore.updateMission(input.missionId, {
				providerState: adapter.patchProviderStateAgentModelSelection({
					agentId: input.agentId,
					catalog: missionModelCatalog,
					providerState: context.mission.providerState,
					selection,
				}),
				agentPanes: context.agentPanes,
				lastError: null,
			});
		},

		async changeAgentVariant(input: {
			agentId: Ff15AgentId;
			effort: string | null;
			missionId: string;
			modelId: string;
		}) {
			const context = await resolveAgentPaneActionContext(
				options.missionTransport,
				options.missionsStore,
				input.missionId,
				input.agentId
			);
			if ("error" in context) {
				return options.missionsStore.updateMission(input.missionId, {
					lastError: context.error,
				});
			}

			const adapter = resolveFf15MissionProviderAdapter(
				context.mission.providerId
			);

			const resolvedCatalog = await getResolvedCatalog(context.mission);
			const missionModelCatalog = adapter.getModelCatalog(
				resolvedCatalog.modelCatalog
			);
			if (
				!adapter.capabilities.modelSelection ||
				missionModelCatalog.length === 0
			) {
				return options.missionsStore.updateMission(input.missionId, {
					lastError: FF15_AGENT_MODEL_PROVIDER_UNAVAILABLE_MESSAGE,
				});
			}

			const model = resolveFf15OpenCodeModelDefinition(
				input.modelId,
				missionModelCatalog
			);
			if (!model) {
				return options.missionsStore.updateMission(input.missionId, {
					lastError: FF15_AGENT_MODEL_UNAVAILABLE_MESSAGE,
				});
			}

			const effort = input.effort;
			if (
				effort !== null &&
				!model.efforts.some((option) => option.value === effort)
			) {
				return options.missionsStore.updateMission(input.missionId, {
					lastError: FF15_AGENT_MODEL_EFFORT_UNAVAILABLE_MESSAGE,
				});
			}

			const selection: Ff15MissionAgentModelSelection = {
				effort:
					model.efforts.length > 0 ? (effort ?? model.efforts[0].value) : null,
				modelId: model.id,
			};

			await options.missionTransport.sendPaneInputSequence({
				steps: adapter.buildVariantInputSequence({
					effort: selection.effort,
					model,
				}),
				paneId: context.paneId,
				sessionName: context.sessionName,
			});

			return options.missionsStore.updateMission(input.missionId, {
				providerState: adapter.patchProviderStateAgentModelSelection({
					agentId: input.agentId,
					catalog: missionModelCatalog,
					providerState: context.mission.providerState,
					selection,
				}),
				agentPanes: context.agentPanes,
				lastError: null,
			});
		},
	};
};
