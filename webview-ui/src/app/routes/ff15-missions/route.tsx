import { PillButton } from "@/components/pill-button";
import { SidebarActionButton } from "@/components/sidebar-action-button";
import { vscode } from "@/lib/vscode";
import { useEffect, useState } from "react";

interface MissionSummary {
	id: string;
	title: string;
	createdAt: string;
	updatedAt: string;
	status: "active" | "draft" | "error" | "sending";
	sessionName: string | null;
	workspaceRoot: string | null;
	lastError: string | null;
}

interface MissionSnapshot {
	activeMissionId: string | null;
	missions: MissionSummary[];
}

const MISSION_STATUS_LABELS: Record<MissionSummary["status"], string> = {
	active: "Active",
	draft: "Draft",
	error: "Delivery Error",
	sending: "Sending",
};

const getMissionStatusClassName = (status: MissionSummary["status"]) => {
	switch (status) {
		case "active":
			return "border-emerald-500/30 bg-emerald-500/12 text-emerald-200";
		case "error":
			return "border-[color:var(--vscode-errorForeground,#f87171)]/35 bg-[color:var(--vscode-errorForeground,#f87171)]/12 text-[color:var(--vscode-errorForeground,#f87171)]";
		case "sending":
			return "border-amber-400/35 bg-amber-400/12 text-amber-100";
		default:
			return "border-[color:color-mix(in_srgb,var(--vscode-foreground)_18%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_82%,transparent)] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))]";
	}
};

const EMPTY_SNAPSHOT: MissionSnapshot = {
	activeMissionId: null,
	missions: [],
};

const Route = () => {
	const [snapshot, setSnapshot] = useState<MissionSnapshot>(EMPTY_SNAPSHOT);

	useEffect(() => {
		const listener = (event: MessageEvent) => {
			const payload = event.data;
			if (payload?.command !== "ff15-missions.state") {
				return;
			}

			setSnapshot(payload.snapshot ?? EMPTY_SNAPSHOT);
		};

		window.addEventListener("message", listener);
		vscode.postMessage({ command: "ff15-missions.ready" });

		return () => {
			window.removeEventListener("message", listener);
		};
	}, []);

	const hasMissions = snapshot.missions.length > 0;

	return (
		<div className="mx-auto flex h-full max-w-3xl flex-col gap-4 px-3 py-1.5">
			<div className="flex items-center justify-between gap-3">
				<h1 className="font-semibold text-[color:var(--vscode-foreground)] text-sm uppercase tracking-[0.18em]">
					Missions
				</h1>
				<SidebarActionButton
					className="h-7 w-auto px-3 text-xs"
					onClick={() => {
						vscode.postMessage({ command: "ff15-missions.create" });
					}}
				>
					New Mission
				</SidebarActionButton>
			</div>

			<div className="flex flex-wrap gap-2">
				{snapshot.missions.map((mission) => (
					<PillButton
						className={
							mission.id === snapshot.activeMissionId
								? "bg-[color:var(--vscode-button-background,#0e7490)]/15 text-[color:var(--vscode-button-foreground,#ffffff)]"
								: ""
						}
						key={mission.id}
						onClick={() => {
							vscode.postMessage({
								command: "ff15-missions.select",
								missionId: mission.id,
							});
						}}
					>
						<span>{mission.title}</span>
						<span
							className={`rounded-full border px-2 py-0.5 font-medium text-[10px] uppercase tracking-[0.12em] ${getMissionStatusClassName(mission.status)}`}
						>
							{MISSION_STATUS_LABELS[mission.status]}
						</span>
					</PillButton>
				))}
			</div>

			<div className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
				Select a mission to open or focus its Mission Workbench in the editor
				area.
			</div>

			{hasMissions ? null : (
				<div className="rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_70%,transparent)] px-3 py-3 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.7))] text-sm">
					No missions yet. Create one to open its Mission Workbench.
				</div>
			)}

			<div className="rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_72%,transparent)] px-3 py-3 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.7))] text-sm leading-6">
				The full mission surface now lives in the editor-area Mission Workbench.
				The sidebar stays focused on mission creation, selection, and status
				navigation.
			</div>
		</div>
	);
};

export default Route;
