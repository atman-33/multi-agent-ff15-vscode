import {
	getRuntimeStatusClassName,
	type MissionWorkbenchMission,
} from "./shared";

const renderMissionStatusSupplement = (mission: MissionWorkbenchMission) => {
	if (mission.lastError) {
		return (
			<div className="mt-3 rounded-2xl border border-[color:var(--vscode-errorForeground,#f87171)]/35 bg-[color:var(--vscode-errorForeground,#f87171)]/10 px-4 py-3 text-[color:var(--vscode-errorForeground,#f87171)] text-sm leading-6">
				{mission.lastError}
			</div>
		);
	}

	if (!mission.workflow.probe.summary) {
		return null;
	}

	return (
		<div className="mt-3 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.64))] text-xs leading-5">
			{mission.workflow.probe.summary}
		</div>
	);
};

interface MissionStatusPanelProps {
	composerStatusMessage: string;
	mission: MissionWorkbenchMission;
	probeVerdictLabel: string;
	runtimeStatusLabel: string;
}

export const MissionStatusPanel = ({
	composerStatusMessage,
	mission,
	probeVerdictLabel,
	runtimeStatusLabel,
}: MissionStatusPanelProps) => (
	<div className="rounded-3xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_74%,transparent)] px-5 py-4">
		<div className="mb-2 font-semibold text-[color:var(--vscode-foreground)] text-sm uppercase tracking-[0.18em]">
			Mission Status
		</div>
		<div className="mb-3 flex flex-wrap items-center gap-2">
			<span
				className={`rounded-full border px-2 py-0.5 font-medium text-[10px] uppercase tracking-[0.12em] ${getRuntimeStatusClassName(mission.workflow.runtimeStatus)}`}
			>
				{runtimeStatusLabel}
			</span>
			<span className="rounded-full border border-[color:color-mix(in_srgb,var(--vscode-foreground)_18%,transparent)] px-2 py-0.5 font-medium text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] uppercase tracking-[0.12em]">
				Probe {probeVerdictLabel}
			</span>
		</div>
		<div className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] text-sm leading-6">
			{composerStatusMessage}
		</div>
		{renderMissionStatusSupplement(mission)}
	</div>
);
