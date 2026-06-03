import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useId } from "react";

type PartyRosterAgentId = "noctis" | "ignis" | "gladiolus" | "prompto";

declare global {
	interface Window {
		__FF15_WEBVIEW_ASSET_BASE__?: string;
	}
}

const getWebviewAssetUri = (path: string) => {
	const assetBase =
		typeof window === "undefined"
			? undefined
			: window.__FF15_WEBVIEW_ASSET_BASE__;

	return assetBase ? new URL(path, assetBase).toString() : `/${path}`;
};

const AGENT_PORTRAITS: Record<PartyRosterAgentId, string> = {
	gladiolus: getWebviewAssetUri("images/gladiolus.png"),
	ignis: getWebviewAssetUri("images/ignis.png"),
	noctis: getWebviewAssetUri("images/noctis.png"),
	prompto: getWebviewAssetUri("images/prompto.png"),
};

const AGENT_THEMES: Record<
	PartyRosterAgentId,
	{
		accent: string;
		glow: string;
		glowSoft: string;
		surface: string;
		text: string;
	}
> = {
	gladiolus: {
		accent: "rgba(170, 58, 73, 0.8)",
		glow: "rgba(170, 58, 73, 0.22)",
		glowSoft: "rgba(170, 58, 73, 0.46)",
		surface:
			"linear-gradient(180deg, rgba(12, 8, 10, 0.98), rgba(7, 6, 8, 0.96) 58%, rgba(18, 9, 12, 0.94))",
		text: "rgba(248, 214, 220, 0.92)",
	},
	ignis: {
		accent: "rgba(75, 146, 114, 0.82)",
		glow: "rgba(75, 146, 114, 0.2)",
		glowSoft: "rgba(75, 146, 114, 0.4)",
		surface:
			"linear-gradient(180deg, rgba(7, 11, 9, 0.98), rgba(5, 8, 7, 0.96) 58%, rgba(9, 15, 12, 0.94))",
		text: "rgba(223, 247, 234, 0.92)",
	},
	noctis: {
		accent: "rgba(143, 156, 224, 0.82)",
		glow: "rgba(143, 156, 224, 0.2)",
		glowSoft: "rgba(143, 156, 224, 0.42)",
		surface:
			"linear-gradient(180deg, rgba(8, 10, 16, 0.98), rgba(6, 8, 13, 0.96) 58%, rgba(10, 12, 21, 0.94))",
		text: "rgba(224, 231, 255, 0.94)",
	},
	prompto: {
		accent: "rgba(240, 207, 115, 0.82)",
		glow: "rgba(240, 207, 115, 0.2)",
		glowSoft: "rgba(240, 207, 115, 0.42)",
		surface:
			"linear-gradient(180deg, rgba(14, 11, 5, 0.98), rgba(9, 8, 4, 0.96) 58%, rgba(17, 14, 8, 0.94))",
		text: "rgba(255, 243, 196, 0.92)",
	},
};

const AGENT_ROLE_LABELS: Record<PartyRosterAgentId, string> = {
	gladiolus: "Shield",
	ignis: "Strategist",
	noctis: "Lead",
	prompto: "Scout",
};

interface OpenCodeModelEffortOption {
	label: string;
	value: string;
}

interface OpenCodeModelDefinition {
	efforts: OpenCodeModelEffortOption[];
	id: string;
	name: string;
}

interface PartyRosterAgent {
	agentId: PartyRosterAgentId;
	available: boolean;
	displayName: string;
	model: {
		effort: string | null;
		effortLabel: string | null;
		modelId: string;
		modelName: string;
	};
	paneId: string | null;
}

interface PartyRosterPanelProps {
	modelCatalog: OpenCodeModelDefinition[];
	modelCatalogStatusMessage: string | null;
	modelSelectionDisabledReason: string | null;
	onChangeAgentModel: (input: {
		agentId: PartyRosterAgent["agentId"];
		effort: string | null;
		modelId: string;
	}) => void;
	onChangeAgentVariant: (input: {
		agentId: PartyRosterAgent["agentId"];
		effort: string | null;
		modelId: string;
	}) => void;
	onContinueAgent: (agentId: PartyRosterAgent["agentId"]) => void;
	partyRosterEnabled: boolean;
	partyRoster: PartyRosterAgent[];
}

interface AgentModelPickerProps {
	agent: PartyRosterAgent;
	disabled: boolean;
	modelCatalog: OpenCodeModelDefinition[];
	modelSelectionDisabledReason: string | null;
	onChangeAgentModel: (input: {
		agentId: PartyRosterAgentId;
		effort: string | null;
		modelId: string;
	}) => void;
	onChangeAgentVariant: (input: {
		agentId: PartyRosterAgentId;
		effort: string | null;
		modelId: string;
	}) => void;
}

const AgentModelPicker = ({
	agent,
	disabled,
	modelCatalog,
	modelSelectionDisabledReason,
	onChangeAgentModel,
	onChangeAgentVariant,
}: AgentModelPickerProps) => {
	const panelId = useId();
	const activeModel =
		modelCatalog.find((model) => model.id === agent.model.modelId) ??
		modelCatalog[0] ??
		null;
	const effortEnabled = Boolean(activeModel?.efforts.length);
	const effortValue =
		agent.model.effort ?? activeModel?.efforts[0]?.value ?? undefined;

	const handleModelChange = (modelId: string) => {
		const nextModel = modelCatalog.find((model) => model.id === modelId);
		if (!nextModel) {
			return;
		}

		const nextEffort = nextModel.efforts.some(
			(option) => option.value === agent.model.effort
		)
			? agent.model.effort
			: (nextModel.efforts[0]?.value ?? null);

		onChangeAgentModel({
			agentId: agent.agentId,
			effort: nextEffort,
			modelId,
		});
	};

	const handleEffortChange = (value: string) => {
		onChangeAgentVariant({
			agentId: agent.agentId,
			effort: value,
			modelId: activeModel?.id ?? agent.model.modelId,
		});
	};

	return (
		<div className="flex items-stretch gap-1.5" id={panelId}>
			<div className="min-w-0 flex-1 basis-0">
				<Select
					disabled={disabled || modelSelectionDisabledReason !== null}
					onValueChange={handleModelChange}
					value={activeModel?.id ?? agent.model.modelId}
				>
					<SelectTrigger
						className={cn(
							"h-6 w-full min-w-0 px-2 font-mono text-[10px] uppercase tracking-[0.18em]",
							"hover:bg-black/60",
							"data-[placeholder]:text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.82))]",
							"[&_svg]:text-[color:var(--vscode-foreground)]"
						)}
						size="sm"
						style={{
							backgroundColor: "rgba(0, 0, 0, 0.5)",
							borderColor: "rgba(255, 255, 255, 0.12)",
							boxShadow: "none",
							color: "var(--vscode-foreground)",
						}}
					>
						<SelectValue placeholder="Select model" />
					</SelectTrigger>
					<SelectContent
						align="end"
						className="border-white/12 bg-[rgba(8,10,16,0.98)] text-[color:var(--vscode-foreground)]"
					>
						{modelCatalog.map((model) => (
							<SelectItem key={model.id} value={model.id}>
								{model.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className="min-w-0 flex-1 basis-0">
				<Select
					disabled={
						disabled || modelSelectionDisabledReason !== null || !effortEnabled
					}
					onValueChange={handleEffortChange}
					value={effortValue}
				>
					<SelectTrigger
						className={cn(
							"h-6 w-full min-w-0 px-2 font-mono text-[10px] uppercase tracking-[0.18em]",
							"hover:bg-black/60",
							"disabled:text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.58))]",
							"data-[placeholder]:text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.82))]",
							"[&_svg]:text-[color:var(--vscode-foreground)]",
							"disabled:[&_svg]:text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.58))]"
						)}
						size="sm"
						style={{
							backgroundColor: "rgba(0, 0, 0, 0.5)",
							borderColor: "rgba(255, 255, 255, 0.12)",
							boxShadow: "none",
							color: "var(--vscode-foreground)",
						}}
					>
						<SelectValue placeholder="Effort unavailable" />
					</SelectTrigger>
					<SelectContent
						align="end"
						className="border-white/12 bg-[rgba(8,10,16,0.98)] text-[color:var(--vscode-foreground)]"
					>
						{activeModel?.efforts.map((effort) => (
							<SelectItem key={effort.value} value={effort.value}>
								{effort.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
};

export const PartyRosterPanel = ({
	modelCatalog,
	modelCatalogStatusMessage,
	modelSelectionDisabledReason,
	onChangeAgentModel,
	onChangeAgentVariant,
	onContinueAgent,
	partyRosterEnabled,
	partyRoster,
}: PartyRosterPanelProps) => (
	<div className="rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--vscode-editor-background)_72%,transparent),color-mix(in_srgb,var(--vscode-button-background,#0e7490)_12%,transparent))] px-3 py-2.5 shadow-[0_20px_56px_rgba(0,0,0,0.16)]">
		<div className="mb-2 flex flex-wrap items-end justify-between gap-2">
			<div>
				<div className="font-semibold text-[color:var(--vscode-foreground)] text-xs uppercase tracking-[0.18em]">
					Party Roster
				</div>
				<div className="mt-0.5 text-[9px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.64))] leading-4">
					Right-click a card to continue. Model controls stay on each card.
				</div>
				{modelCatalogStatusMessage ? (
					<div className="mt-1 text-[9px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] leading-4">
						{modelCatalogStatusMessage}
					</div>
				) : null}
				{modelSelectionDisabledReason ? (
					<div className="mt-1 text-[9px] text-[color:var(--vscode-errorForeground,#f87171)] leading-4">
						{modelSelectionDisabledReason}
					</div>
				) : null}
			</div>
			<span className="rounded-full border border-[color:color-mix(in_srgb,var(--vscode-foreground)_16%,transparent)] px-2 py-0.5 font-medium text-[9px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] uppercase tracking-[0.12em]">
				{partyRoster.filter((agent) => agent.available).length} Live Panes
			</span>
		</div>

		<div className="grid gap-2">
			{partyRoster.map((agent) => {
				const theme = AGENT_THEMES[agent.agentId];
				const portraitFilter = [
					`drop-shadow(0 0 3px ${theme.glowSoft})`,
					`drop-shadow(0 0 7px ${theme.glow})`,
					agent.available
						? `drop-shadow(0 0 12px ${theme.accent})`
						: `drop-shadow(0 0 5px ${theme.glow})`,
				].join(" ");

				return (
					<ContextMenu key={agent.agentId}>
						<ContextMenuTrigger asChild>
							<div
								className={cn(
									"min-w-0",
									"rounded-xl",
									"border border-transparent",
									"px-3 py-3",
									"transition-transform",
									"hover:-translate-y-0.5",
									"shadow-[0_16px_34px_rgba(0,0,0,0.34)]"
								)}
								style={{
									background: theme.surface,
									boxShadow: `0 16px 34px rgba(0,0,0,0.34), 0 1px 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(255,255,255,0.03) inset, 0 0 18px ${theme.glow}`,
								}}
							>
								<div className="flex min-w-0 items-center gap-3.5">
									<div className="relative flex h-16 w-10 shrink-0 items-end justify-center">
										<span
											aria-hidden="true"
											className="pointer-events-none absolute rounded-full"
											style={{
												background: `radial-gradient(circle, ${agent.available ? theme.glowSoft : theme.glow} 0%, ${theme.glow} 62%, rgba(0,0,0,0) 100%)`,
												bottom: 0,
												height: "2rem",
												left: "50%",
												opacity: agent.available ? 1 : 0.72,
												transform: "translateX(-50%)",
												width: "2rem",
											}}
										/>
										{agent.available ? (
											<span
												aria-hidden="true"
												className="pointer-events-none absolute inset-x-1 bottom-1 h-8 rounded-full"
												style={{
													background: theme.glow,
													filter: "blur(16px)",
												}}
											/>
										) : null}
										<img
											alt={agent.displayName}
											className="relative z-10 h-full w-full object-contain object-bottom"
											height={64}
											src={AGENT_PORTRAITS[agent.agentId]}
											style={{ filter: portraitFilter }}
											width={40}
										/>
									</div>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<div
												className="truncate font-bold text-sm uppercase tracking-wider"
												style={{ color: theme.text }}
											>
												{agent.displayName}
											</div>
											<div
												className="font-mono text-[9px]"
												style={{
													color:
														"var(--vscode-descriptionForeground, rgba(255,255,255,0.76))",
													letterSpacing: "0.12em",
													textTransform: "uppercase",
												}}
											>
												{AGENT_ROLE_LABELS[agent.agentId]}
											</div>
										</div>
										<div className="mt-1 w-full max-w-[17rem]">
											<AgentModelPicker
												agent={agent}
												disabled={!partyRosterEnabled}
												modelCatalog={modelCatalog}
												modelSelectionDisabledReason={
													modelSelectionDisabledReason
												}
												onChangeAgentModel={onChangeAgentModel}
												onChangeAgentVariant={onChangeAgentVariant}
											/>
										</div>
									</div>
								</div>
							</div>
						</ContextMenuTrigger>
						<ContextMenuContent className="w-52">
							<ContextMenuLabel>{agent.displayName}</ContextMenuLabel>
							<ContextMenuSeparator />
							<ContextMenuItem
								disabled={!partyRosterEnabled}
								onSelect={() => {
									onContinueAgent(agent.agentId);
								}}
							>
								Continue
							</ContextMenuItem>
						</ContextMenuContent>
					</ContextMenu>
				);
			})}
		</div>
	</div>
);
