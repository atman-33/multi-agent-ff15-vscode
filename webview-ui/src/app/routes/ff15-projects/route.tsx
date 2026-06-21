import { DevBadge } from "@/components/dev-badge";
import { SidebarActionButton } from "@/components/sidebar-action-button";
import { vscode } from "@/lib/vscode";
import { useEffect, useState } from "react";
import {
	EMPTY_SNAPSHOT,
	formatSourceKind,
	type ProjectsSnapshot,
} from "./model";

const Route = () => {
	const [snapshot, setSnapshot] = useState<ProjectsSnapshot>(EMPTY_SNAPSHOT);
	const [devMode, setDevMode] = useState(false);

	useEffect(() => {
		const listener = (event: MessageEvent) => {
			const payload = event.data;
			if (payload?.command !== "ff15-projects.state") {
				return;
			}

			setSnapshot(payload.snapshot ?? EMPTY_SNAPSHOT);
			setDevMode(payload.devMode ?? false);
		};

		window.addEventListener("message", listener);
		vscode.postMessage({ command: "ff15-projects.ready" });

		return () => {
			window.removeEventListener("message", listener);
		};
	}, []);

	const availableProfiles =
		snapshot.status === "ready" ? snapshot.profiles : [];
	const sourceSummary = formatSourceKind(snapshot.sourceKind);
	let activeProjectsSummary = "-";
	if (snapshot.activeProjects.length > 0) {
		activeProjectsSummary = snapshot.activeProjects.join(", ");
	} else if (snapshot.status === "ready") {
		activeProjectsSummary = "No active projects";
	}

	let openSpecSummary = "-";
	if (snapshot.openspec.mode === "project") {
		openSpecSummary = `project: ${snapshot.openspec.sourceProjectId ?? "-"}`;
	} else if (snapshot.openspec.mode === "harness") {
		openSpecSummary = "harness";
	}

	return (
		<div className="mx-auto flex h-full max-w-3xl flex-col gap-3 px-3 py-2">
			{devMode ? <DevBadge /> : null}
			<SidebarActionButton
				onClick={() => {
					vscode.postMessage({ command: "ff15-projects.open-editor" });
				}}
			>
				Open Projects Editor
			</SidebarActionButton>

			<div className="grid grid-cols-[68px_minmax(0,1fr)] items-center gap-x-3 gap-y-3 px-1 text-[color:var(--vscode-foreground)] text-sm">
				<div className="text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] uppercase tracking-[0.14em]">
					Source
				</div>
				<div className="min-w-0 break-all font-medium text-[13px] leading-5">
					{sourceSummary}
				</div>

				<div className="text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] uppercase tracking-[0.14em]">
					Active
				</div>
				<div className="min-w-0 break-all font-medium text-[13px] leading-5">
					{activeProjectsSummary}
				</div>

				<div className="text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] uppercase tracking-[0.14em]">
					OpenSpec
				</div>
				<div className="min-w-0 break-all font-medium text-[13px] leading-5">
					{openSpecSummary}
				</div>
			</div>

			{snapshot.status === "error" ? (
				<div className="rounded-lg border border-[color:var(--vscode-errorForeground,#f87171)]/35 bg-[color:var(--vscode-errorForeground,#f87171)]/12 px-3 py-2 text-[color:var(--vscode-errorForeground,#f87171)] text-sm leading-6">
					{snapshot.error}
				</div>
			) : null}
		</div>
	);
};

export default Route;
