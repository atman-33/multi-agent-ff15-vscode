import { SidebarListItemButton } from "@/components/sidebar-list-item-button";
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
		<div className="mx-auto flex h-full max-w-3xl flex-col gap-3 px-3 py-1.5">
			<div className="flex items-center gap-3">
				<h1 className="font-semibold text-[color:var(--vscode-foreground)] text-sm uppercase tracking-[0.18em]">
					Missions
				</h1>
			</div>

			<SidebarActionButton
				onClick={() => {
					vscode.postMessage({ command: "ff15-missions.create" });
				}}
			>
				New Mission
			</SidebarActionButton>

			<div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
				{snapshot.missions.map((mission) => (
					<SidebarListItemButton
						active={mission.id === snapshot.activeMissionId}
						badge={
							<span
								className={`rounded-md border px-2 py-0.5 font-medium text-[10px] uppercase tracking-[0.12em] ${getMissionStatusClassName(mission.status)}`}
							>
								{MISSION_STATUS_LABELS[mission.status]}
							</span>
						}
						description={mission.sessionName ?? "Not attached yet"}
						key={mission.id}
						label={mission.title}
						onClick={() => {
							vscode.postMessage({
								command: "ff15-missions.select",
								missionId: mission.id,
							});
						}}
					/>
				))}

				{hasMissions ? null : (
					<div className="rounded-lg border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_70%,transparent)] px-3 py-3 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.7))] text-sm">
						No missions yet.
					</div>
				)}
			</div>
		</div>
	);
};

export default Route;
