import { PillButton } from "@/components/pill-button";
import { SidebarActionButton } from "@/components/sidebar-action-button";
import { TextareaPanel } from "@/components/textarea-panel";
import { vscode } from "@/lib/vscode";
import { useEffect, useMemo, useState } from "react";

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

const EMPTY_SNAPSHOT: MissionSnapshot = {
	activeMissionId: null,
	missions: [],
};

const Route = () => {
	const [draft, setDraft] = useState("");
	const [pendingDeleteMissionId, setPendingDeleteMissionId] = useState<
		string | null
	>(null);
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

	const activeMission = useMemo(
		() =>
			snapshot.missions.find(
				(mission) => mission.id === snapshot.activeMissionId
			) ?? null,
		[snapshot.activeMissionId, snapshot.missions]
	);

	const hasMissions = snapshot.missions.length > 0;
	const composerDisabled = activeMission === null;
	const sendDisabled =
		composerDisabled ||
		draft.trim().length === 0 ||
		activeMission?.status === "sending";
	const composerStatusMessage = (() => {
		if (composerDisabled) {
			return "Noctis composer is disabled until a mission is active.";
		}

		if (activeMission.lastError) {
			return activeMission.lastError;
		}

		if (activeMission.status === "sending") {
			return `Launching or attaching ${activeMission.title} and delivering the prompt...`;
		}

		if (activeMission.status === "active") {
			return `${activeMission.title} is active in ${activeMission.sessionName ?? "the mission session"}. Click its mission chip to reopen the external terminal.`;
		}

		return "Click a mission chip to open its external terminal. The first send will also deliver the prompt to Noctis.";
	})();
	const deleteArmed =
		activeMission !== null && pendingDeleteMissionId === activeMission.id;

	return (
		<div className="mx-auto flex h-full max-w-3xl flex-col gap-4 px-3 py-1.5">
			<div className="flex items-center justify-between gap-3">
				<h1 className="font-semibold text-[color:var(--vscode-foreground)] text-sm uppercase tracking-[0.18em]">
					Missions
				</h1>
				<div className="flex items-center gap-2">
					{activeMission ? (
						<SidebarActionButton
							className="h-7 w-auto border border-[color:var(--vscode-errorForeground,#f87171)]/35 px-3 text-[color:var(--vscode-errorForeground,#f87171)] text-xs"
							onClick={() => {
								if (!deleteArmed) {
									setPendingDeleteMissionId(activeMission.id);
									return;
								}

								setPendingDeleteMissionId(null);
								setDraft("");
								vscode.postMessage({
									command: "ff15-missions.delete",
									missionId: activeMission.id,
								});
							}}
						>
							{deleteArmed ? "Confirm Delete" : "Delete Mission"}
						</SidebarActionButton>
					) : null}
					<SidebarActionButton
						className="h-7 w-auto px-3 text-xs"
						onClick={() => {
							setPendingDeleteMissionId(null);
							setDraft("");
							vscode.postMessage({ command: "ff15-missions.create" });
						}}
					>
						New Mission
					</SidebarActionButton>
				</div>
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
							setPendingDeleteMissionId(null);
							setDraft("");
							vscode.postMessage({
								command: "ff15-missions.select",
								missionId: mission.id,
							});
						}}
					>
						{mission.title}
					</PillButton>
				))}
			</div>

			<div className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
				{deleteArmed
					? `Click Confirm Delete to close ${activeMission.title} and remove its mission record.`
					: "Click a mission to attach its external Zellij window."}
			</div>

			{hasMissions ? null : (
				<div className="rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_70%,transparent)] px-3 py-3 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.7))] text-sm">
					No missions yet. Create one to open its dedicated Zellij terminal.
				</div>
			)}

			<TextareaPanel
				containerClassName="px-2"
				disabled={composerDisabled}
				onChange={(event) => {
					setDraft(event.target.value);
				}}
				placeholder={
					composerDisabled
						? "Create or select a mission to message Noctis..."
						: `Draft a message for ${activeMission.title}...`
				}
				rows={4}
				textareaClassName="min-h-[5rem] text-sm leading-6"
				value={draft}
			>
				<div className="flex items-center justify-between gap-3 p-2">
					<span className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
						{composerStatusMessage}
					</span>
					<SidebarActionButton
						className="h-7 w-auto px-3 text-xs"
						disabled={sendDisabled}
						onClick={() => {
							if (!activeMission || draft.trim().length === 0) {
								return;
							}

							vscode.postMessage({
								command: "ff15-missions.send",
								missionId: activeMission.id,
								prompt: draft.trim(),
							});
						}}
					>
						Send to Noctis
					</SidebarActionButton>
				</div>
			</TextareaPanel>
		</div>
	);
};

export default Route;
