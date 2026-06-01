import { Button } from "@/components/ui/button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import {
	CheckIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	CpuIcon,
	MoreVerticalIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

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
		surface: string;
		text: string;
	}
> = {
	gladiolus: {
		accent: "rgba(170, 58, 73, 0.8)",
		glow: "rgba(170, 58, 73, 0.22)",
		surface:
			"linear-gradient(160deg, rgba(54, 18, 24, 0.96), rgba(26, 13, 16, 0.94))",
		text: "rgba(248, 214, 220, 0.92)",
	},
	ignis: {
		accent: "rgba(75, 146, 114, 0.82)",
		glow: "rgba(75, 146, 114, 0.2)",
		surface:
			"linear-gradient(160deg, rgba(18, 40, 32, 0.96), rgba(12, 22, 19, 0.94))",
		text: "rgba(223, 247, 234, 0.92)",
	},
	noctis: {
		accent: "rgba(143, 156, 224, 0.82)",
		glow: "rgba(143, 156, 224, 0.2)",
		surface:
			"linear-gradient(160deg, rgba(20, 26, 46, 0.96), rgba(12, 17, 33, 0.94))",
		text: "rgba(224, 231, 255, 0.94)",
	},
	prompto: {
		accent: "rgba(240, 207, 115, 0.82)",
		glow: "rgba(240, 207, 115, 0.2)",
		surface:
			"linear-gradient(160deg, rgba(48, 38, 14, 0.96), rgba(27, 22, 11, 0.94))",
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
	onChangeAgentModel: (input: {
		agentId: PartyRosterAgent["agentId"];
		effort: string | null;
		modelId: string;
	}) => void;
	onContinueAgent: (agentId: PartyRosterAgent["agentId"]) => void;
	partyRosterEnabled: boolean;
	partyRoster: PartyRosterAgent[];
}

const getAvailabilityClassName = (available: boolean) =>
	available
		? "border-emerald-500/30 bg-emerald-500/12 text-emerald-200"
		: "border-[color:color-mix(in_srgb,var(--vscode-foreground)_18%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_82%,transparent)] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))]";

const getAgentStatusLabel = (available: boolean, enabled: boolean) => {
	if (!enabled) {
		return "Locked";
	}

	return available ? "Live" : "Standby";
};

const getModelSummary = (agent: PartyRosterAgent) =>
	agent.model.effortLabel
		? `${agent.model.modelName} / ${agent.model.effortLabel}`
		: agent.model.modelName;

interface AgentModelPickerProps {
	agent: PartyRosterAgent;
	disabled: boolean;
	modelCatalog: OpenCodeModelDefinition[];
	onChangeAgentModel: (input: {
		agentId: PartyRosterAgentId;
		effort: string | null;
		modelId: string;
	}) => void;
}

const AgentModelPicker = ({
	agent,
	disabled,
	modelCatalog,
	onChangeAgentModel,
}: AgentModelPickerProps) => {
	const [open, setOpen] = useState(false);
	const [activeModelId, setActiveModelId] = useState(agent.model.modelId);
	const panelRef = useRef<HTMLDivElement | null>(null);
	const panelId = useId();

	useEffect(() => {
		if (!open) {
			return;
		}

		const handlePointerDown = (event: MouseEvent) => {
			if (!panelRef.current?.contains(event.target as Node)) {
				setOpen(false);
			}
		};

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setOpen(false);
			}
		};

		document.addEventListener("mousedown", handlePointerDown);
		document.addEventListener("keydown", handleEscape);

		return () => {
			document.removeEventListener("mousedown", handlePointerDown);
			document.removeEventListener("keydown", handleEscape);
		};
	}, [open]);

	useEffect(() => {
		setActiveModelId(agent.model.modelId);
	}, [agent.model.modelId]);

	const activeModel =
		modelCatalog.find((model) => model.id === activeModelId) ??
		modelCatalog[0] ??
		null;

	return (
		<div className="relative" ref={panelRef}>
			<Button
				aria-controls={open ? panelId : undefined}
				aria-expanded={open}
				aria-haspopup="dialog"
				className="h-10 w-full justify-between rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_14%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_80%,transparent)] px-3 text-[color:var(--vscode-foreground)] text-xs shadow-none hover:bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_88%,transparent)]"
				disabled={disabled}
				onClick={() => {
					setActiveModelId(agent.model.modelId);
					setOpen((current) => !current);
				}}
				variant="outline"
			>
				<span className="flex min-w-0 items-center gap-2">
					<CpuIcon className="h-3.5 w-3.5 shrink-0" />
					<span className="min-w-0 truncate text-left">
						{getModelSummary(agent)}
					</span>
				</span>
				<ChevronDownIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
			</Button>

			{open ? (
				<div
					className="absolute left-0 z-50 mt-2 grid min-w-[20rem] gap-0 overflow-hidden rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_16%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_98%,transparent)] shadow-[0_18px_48px_rgba(0,0,0,0.35)] md:min-w-[25rem] md:grid-cols-[minmax(0,1fr)_12rem]"
					id={panelId}
					role="dialog"
				>
					<div className="max-h-72 overflow-y-auto p-2">
						<div className="mb-1 px-2 py-1 font-medium text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.68))] uppercase tracking-[0.18em]">
							Model
						</div>
						<div className="grid gap-1">
							{modelCatalog.map((model) => {
								const hasEfforts = model.efforts.length > 0;
								const selected = agent.model.modelId === model.id;
								const active = activeModelId === model.id;

								return (
									<button
										className={cn(
											"flex w-full items-center gap-2 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors",
											active
												? "bg-[color:color-mix(in_srgb,var(--vscode-button-background,#0e7490)_14%,transparent)] text-[color:var(--vscode-foreground)]"
												: "text-[color:var(--vscode-foreground)] hover:bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_88%,transparent)]"
										)}
										key={model.id}
										onClick={() => {
											if (hasEfforts) {
												setActiveModelId(model.id);
												return;
											}

											onChangeAgentModel({
												agentId: agent.agentId,
												effort: null,
												modelId: model.id,
											});
											setOpen(false);
										}}
										onFocus={() => {
											setActiveModelId(model.id);
										}}
										onMouseEnter={() => {
											setActiveModelId(model.id);
										}}
										type="button"
									>
										<CheckIcon
											className={cn(
												"h-3.5 w-3.5 shrink-0",
												selected ? "opacity-100" : "opacity-0"
											)}
										/>
										<div className="min-w-0 flex-1">
											<div className="truncate font-medium text-xs">
												{model.name}
											</div>
											<div className="mt-0.5 text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.64))] uppercase tracking-[0.14em]">
												{hasEfforts ? "Hover for Effort" : "Direct Apply"}
											</div>
										</div>
										{hasEfforts ? (
											<ChevronRightIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
										) : null}
									</button>
								);
							})}
						</div>
					</div>

					<div className="border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] border-l bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_86%,transparent)] p-2">
						<div className="mb-1 px-2 py-1 font-medium text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.68))] uppercase tracking-[0.18em]">
							Effort
						</div>
						{activeModel?.efforts.length ? (
							<div className="grid gap-1">
								{activeModel.efforts.map((effort) => {
									const selected =
										agent.model.modelId === activeModel.id &&
										agent.model.effort === effort.value;

									return (
										<button
											className={cn(
												"rounded-xl border px-3 py-2 text-left transition-colors",
												selected
													? "border-[color:var(--vscode-button-background,#0e7490)] bg-[color:var(--vscode-button-background,#0e7490)]/14 text-[color:var(--vscode-foreground)]"
													: "border-transparent text-[color:var(--vscode-foreground)] hover:bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_92%,transparent)]"
											)}
											key={effort.value}
											onClick={() => {
												onChangeAgentModel({
													agentId: agent.agentId,
													effort: effort.value,
													modelId: activeModel.id,
												});
												setOpen(false);
											}}
											type="button"
										>
											<div className="font-medium text-xs">{effort.value}</div>
											<div className="mt-0.5 text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.64))] leading-4">
												{effort.label}
											</div>
										</button>
									);
								})}
							</div>
						) : (
							<div
								className={cn(
									"flex h-full min-h-28 items-center justify-center rounded-xl border border-dashed px-3 text-center",
									"border-[color:color-mix(in_srgb,var(--vscode-foreground)_14%,transparent)]",
									"text-[11px]",
									"leading-5",
									"text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.62))]"
								)}
							>
								Select a model with effort options to tune it here.
							</div>
						)}
					</div>
				</div>
			) : null}
		</div>
	);
};

export const PartyRosterPanel = ({
	modelCatalog,
	onChangeAgentModel,
	onContinueAgent,
	partyRosterEnabled,
	partyRoster,
}: PartyRosterPanelProps) => (
	<div className="rounded-3xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--vscode-editor-background)_72%,transparent),color-mix(in_srgb,var(--vscode-button-background,#0e7490)_12%,transparent))] px-5 py-4 shadow-[0_24px_72px_rgba(0,0,0,0.18)]">
		<div className="mb-3 flex flex-wrap items-center justify-between gap-3">
			<div>
				<div className="font-semibold text-[color:var(--vscode-foreground)] text-sm uppercase tracking-[0.18em]">
					Party Roster
				</div>
				<div className="mt-1 text-[11px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.64))] leading-5">
					Right-click a card to continue. Left-click the model field to retune
					the agent.
				</div>
			</div>
			<span className="rounded-full border border-[color:color-mix(in_srgb,var(--vscode-foreground)_16%,transparent)] px-2.5 py-1 font-medium text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] uppercase tracking-[0.12em]">
				{partyRoster.filter((agent) => agent.available).length} Live Panes
			</span>
		</div>

		<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
			{partyRoster.map((agent) => {
				const theme = AGENT_THEMES[agent.agentId];

				return (
					<ContextMenu key={agent.agentId}>
						<ContextMenuTrigger asChild>
							<div
								className={cn(
									"min-w-0",
									"rounded-[1.75rem]",
									"border",
									"px-4 py-4",
									"transition-transform",
									"hover:-translate-y-0.5",
									"border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)]",
									"shadow-[0_16px_36px_rgba(0,0,0,0.18)]"
								)}
								style={{
									background: theme.surface,
									boxShadow: `0 18px 36px rgba(0,0,0,0.18), 0 0 0 1px ${theme.glow} inset`,
								}}
							>
								<div className="mb-3 flex items-start justify-between gap-3">
									<div className="flex min-w-0 items-center gap-3">
										<div
											className="relative flex h-18 w-14 shrink-0 items-end justify-center overflow-hidden rounded-2xl border"
											style={{
												background: `radial-gradient(circle at 50% 100%, ${theme.glow}, transparent 72%)`,
												borderColor: theme.accent,
											}}
										>
											<img
												alt={agent.displayName}
												className="h-full w-full object-contain object-bottom"
												height={72}
												src={AGENT_PORTRAITS[agent.agentId]}
												width={56}
											/>
										</div>
										<div className="min-w-0">
											<div
												className="truncate font-semibold text-sm"
												style={{ color: theme.text }}
											>
												{agent.displayName}
											</div>
											<div className="mt-1 text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.66))] uppercase tracking-[0.18em]">
												{AGENT_ROLE_LABELS[agent.agentId]}
											</div>
											<div className="mt-2 truncate text-[11px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] leading-5">
												{getModelSummary(agent)}
											</div>
										</div>
									</div>
									<div className="rounded-full border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_72%,transparent)] p-2 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))]">
										<MoreVerticalIcon className="h-4 w-4" />
									</div>
								</div>

								<div className="mb-3 flex flex-wrap items-center gap-2">
									<span
										className={cn(
											"w-fit rounded-full border px-2 py-0.5 font-medium text-[10px] uppercase tracking-[0.12em]",
											getAvailabilityClassName(agent.available)
										)}
									>
										{getAgentStatusLabel(agent.available, partyRosterEnabled)}
									</span>
									<span className="min-w-0 truncate rounded-full border border-[color:color-mix(in_srgb,var(--vscode-foreground)_16%,transparent)] px-2 py-0.5 text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] uppercase tracking-[0.12em]">
										{agent.paneId ?? "No Pane"}
									</span>
								</div>

								<div className="grid gap-2">
									<AgentModelPicker
										agent={agent}
										disabled={!partyRosterEnabled}
										modelCatalog={modelCatalog}
										onChangeAgentModel={onChangeAgentModel}
									/>
									<div className="rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_72%,transparent)] px-3 py-2 text-[11px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.64))] leading-5">
										Current routing target:{" "}
										{agent.available ? "resolved pane" : "resolved on demand"}
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
