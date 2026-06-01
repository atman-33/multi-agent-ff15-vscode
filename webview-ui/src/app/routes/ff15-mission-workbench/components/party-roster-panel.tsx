import { SidebarActionButton } from "@/components/sidebar-action-button";
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
import { MoreVerticalIcon } from "lucide-react";

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
	agentId: "noctis" | "ignis" | "gladiolus" | "prompto";
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

const getModelEffortValue = (agent: PartyRosterAgent) =>
	agent.model.effort ?? "__none";

export const PartyRosterPanel = ({
	modelCatalog,
	onChangeAgentModel,
	onContinueAgent,
	partyRosterEnabled,
	partyRoster,
}: PartyRosterPanelProps) => (
	<div className="rounded-3xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_74%,transparent)] px-5 py-4">
		<div className="mb-3 flex flex-wrap items-center justify-between gap-3">
			<div className="font-semibold text-[color:var(--vscode-foreground)] text-sm uppercase tracking-[0.18em]">
				Party Roster
			</div>
			<span className="rounded-full border border-[color:color-mix(in_srgb,var(--vscode-foreground)_16%,transparent)] px-2.5 py-1 font-medium text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] uppercase tracking-[0.12em]">
				{partyRoster.filter((agent) => agent.available).length} Live Panes
			</span>
		</div>

		<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
			{partyRoster.map((agent) => {
				const selectedModel =
					modelCatalog.find((model) => model.id === agent.model.modelId) ??
					modelCatalog[0];
				const effortOptions = selectedModel?.efforts ?? [];

				return (
					<div
						className="min-w-0 rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_82%,transparent)] px-4 py-3"
						key={agent.agentId}
					>
						<div className="mb-3 flex min-w-0 items-start justify-between gap-2">
							<div className="min-w-0">
								<div className="truncate font-semibold text-[color:var(--vscode-foreground)] text-sm">
									{agent.displayName}
								</div>
								<div className="mt-1 truncate text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.68))] text-xs">
									{agent.model.modelName}
									{agent.model.effortLabel
										? ` / ${agent.model.effortLabel}`
										: ""}
								</div>
							</div>
							<ContextMenu>
								<ContextMenuTrigger asChild>
									<SidebarActionButton
										aria-label={`${agent.displayName} actions`}
										className="h-8 w-8 rounded-xl px-0"
									>
										<MoreVerticalIcon className="h-4 w-4" />
									</SidebarActionButton>
								</ContextMenuTrigger>
								<ContextMenuContent className="w-44">
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
						</div>

						<div className="mb-3 flex flex-wrap items-center gap-2">
							<span
								className={cn(
									"w-fit rounded-full border px-2 py-0.5 font-medium text-[10px] uppercase tracking-[0.12em]",
									getAvailabilityClassName(agent.available)
								)}
							>
								{agent.available ? "Live" : "Unavailable"}
							</span>
							<span className="min-w-0 truncate rounded-full border border-[color:color-mix(in_srgb,var(--vscode-foreground)_16%,transparent)] px-2 py-0.5 text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] uppercase tracking-[0.12em]">
								{agent.paneId ?? "No Pane"}
							</span>
						</div>

						<div className="grid gap-2">
							<Select
								disabled={!partyRosterEnabled}
								onValueChange={(modelId) => {
									const nextModel = modelCatalog.find(
										(model) => model.id === modelId
									);
									onChangeAgentModel({
										agentId: agent.agentId,
										effort: nextModel?.efforts[0]?.value ?? null,
										modelId,
									});
								}}
								value={agent.model.modelId}
							>
								<SelectTrigger className="h-9 w-full border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_78%,transparent)] text-[color:var(--vscode-foreground)]">
									<SelectValue placeholder="Model" />
								</SelectTrigger>
								<SelectContent>
									{modelCatalog.map((model) => (
										<SelectItem key={model.id} value={model.id}>
											{model.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							{effortOptions.length > 0 ? (
								<Select
									disabled={!partyRosterEnabled}
									onValueChange={(effort) => {
										onChangeAgentModel({
											agentId: agent.agentId,
											effort,
											modelId: agent.model.modelId,
										});
									}}
									value={getModelEffortValue(agent)}
								>
									<SelectTrigger className="h-9 w-full border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_78%,transparent)] text-[color:var(--vscode-foreground)]">
										<SelectValue placeholder="Effort" />
									</SelectTrigger>
									<SelectContent>
										{effortOptions.map((effort) => (
											<SelectItem key={effort.value} value={effort.value}>
												{effort.value} - {effort.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							) : null}
						</div>
					</div>
				);
			})}
		</div>
	</div>
);
