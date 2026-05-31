import { SidebarActionButton } from "@/components/sidebar-action-button";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import {
	getMissionStatusClassName,
	getRuntimeStatusClassName,
	MISSION_STATUS_LABELS,
	type MissionWorkbenchCatalogEntry,
	type MissionWorkbenchMission,
} from "./shared";

interface MissionWorkbenchHeaderProps {
	mission: MissionWorkbenchMission;
	onConfirmDelete: () => void;
	onOpenTerminal: () => void;
	pendingDelete: boolean;
	probeVerdictLabel: string;
	runtimeStatusLabel: string;
	selectedOperation: MissionWorkbenchCatalogEntry | null;
	terminalActionLabel: string;
}

export const MissionWorkbenchHeader = ({
	mission,
	onConfirmDelete,
	onOpenTerminal,
	pendingDelete,
	probeVerdictLabel,
	runtimeStatusLabel,
	selectedOperation,
	terminalActionLabel,
}: MissionWorkbenchHeaderProps) => (
	<div className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--vscode-editor-background)_92%,transparent),color-mix(in_srgb,var(--vscode-button-background,#0e7490)_16%,transparent))] px-5 py-4">
		<div className="flex min-w-0 flex-1 flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<h1 className="font-semibold text-[color:var(--vscode-foreground)] text-xl tracking-[0.03em]">
					{mission.title}
				</h1>
				<span
					className={`w-fit rounded-full border px-2 py-0.5 font-medium text-[10px] uppercase tracking-[0.12em] ${getMissionStatusClassName(mission.status)}`}
				>
					{MISSION_STATUS_LABELS[mission.status]}
				</span>
				<span
					className={`w-fit rounded-full border px-2 py-0.5 font-medium text-[10px] uppercase tracking-[0.12em] ${getRuntimeStatusClassName(mission.workflow.runtimeStatus)}`}
				>
					Runtime {runtimeStatusLabel}
				</span>
			</div>
			<div className="flex flex-wrap gap-2 text-[11px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] uppercase tracking-[0.12em]">
				<span className="rounded-full border border-[color:color-mix(in_srgb,var(--vscode-foreground)_16%,transparent)] px-2.5 py-1">
					Operation {selectedOperation?.name ?? "Choose below"}
				</span>
				<span className="rounded-full border border-[color:color-mix(in_srgb,var(--vscode-foreground)_16%,transparent)] px-2.5 py-1">
					Session {mission.sessionName ? "Attached" : "Not attached"}
				</span>
				<span className="rounded-full border border-[color:color-mix(in_srgb,var(--vscode-foreground)_16%,transparent)] px-2.5 py-1">
					Probe {probeVerdictLabel}
				</span>
			</div>
			<Accordion
				className="rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_10%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_64%,transparent)] px-4"
				type="multiple"
			>
				<AccordionItem className="border-none" value="mission-details">
					<AccordionTrigger className="py-3 text-[11px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] uppercase tracking-[0.16em] hover:no-underline">
						Mission Details
					</AccordionTrigger>
					<AccordionContent className="grid gap-3 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.76))] text-sm leading-6">
						<div className="grid gap-1">
							<div className="text-[10px] uppercase tracking-[0.14em]">
								Selected Operation Ref
							</div>
							<div className="break-all font-medium text-[color:var(--vscode-foreground)]">
								{selectedOperation?.ref ?? "None selected yet"}
							</div>
						</div>
						<div className="grid gap-1 sm:grid-cols-2 sm:gap-3">
							<div>
								<div className="text-[10px] uppercase tracking-[0.14em]">
									Current Step
								</div>
								<div>{mission.workflow.currentStep ?? "Not reported yet"}</div>
							</div>
							<div>
								<div className="text-[10px] uppercase tracking-[0.14em]">
									Active Task
								</div>
								<div>{mission.workflow.activeTask ?? "Not reported yet"}</div>
							</div>
						</div>
						<div className="grid gap-1">
							<div className="text-[10px] uppercase tracking-[0.14em]">
								Workspace
							</div>
							<div className="break-all">
								{mission.workspaceRoot ?? "Workspace root unavailable"}
							</div>
						</div>
					</AccordionContent>
				</AccordionItem>
				<AccordionItem className="border-none" value="runtime-notes">
					<AccordionTrigger className="py-3 text-[11px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] uppercase tracking-[0.16em] hover:no-underline">
						Runtime Notes
					</AccordionTrigger>
					<AccordionContent className="grid gap-3 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.76))] text-sm leading-6">
						<div>
							<div className="text-[10px] uppercase tracking-[0.14em]">
								Probe Summary
							</div>
							<div>
								{mission.workflow.probe.summary ??
									"No probe summary reported yet."}
							</div>
						</div>
						<div>
							<div className="text-[10px] uppercase tracking-[0.14em]">
								Last Report Summary
							</div>
							<div>
								{mission.workflow.lastReportSummary ??
									"No report summary captured yet."}
							</div>
						</div>
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
		<div className="flex flex-wrap items-center gap-2">
			<SidebarActionButton
				className="h-8 w-auto px-4 text-xs"
				onClick={onOpenTerminal}
			>
				{terminalActionLabel}
			</SidebarActionButton>
			<SidebarActionButton
				className="h-8 w-auto border border-[color:var(--vscode-errorForeground,#f87171)]/35 bg-transparent px-4 text-[color:var(--vscode-errorForeground,#f87171)] text-xs hover:bg-[color:var(--vscode-errorForeground,#f87171)]/12"
				onClick={onConfirmDelete}
			>
				{pendingDelete ? "Confirm Delete" : "Delete Mission"}
			</SidebarActionButton>
		</div>
	</div>
);
