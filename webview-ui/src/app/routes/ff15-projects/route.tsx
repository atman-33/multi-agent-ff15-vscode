import { DevBadge } from "@/components/dev-badge";
import { Ff15Screen } from "@/components/ff15/ff15-screen";
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
		<Ff15Screen background={false}>
			<div className="mx-auto flex h-full max-w-3xl flex-col gap-3 px-3 py-2">
				{devMode ? <DevBadge /> : null}
				<SidebarActionButton
					onClick={() => {
						vscode.postMessage({ command: "ff15-projects.open-editor" });
					}}
				>
					Open Projects Editor
				</SidebarActionButton>

				<div className="grid grid-cols-[68px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-1 text-[color:var(--ff15-text)] text-sm">
					<div className="text-[color:var(--ff15-text-muted)] text-xs">
						Source
					</div>
					<div className="min-w-0 break-all font-medium text-[13px] leading-5">
						{sourceSummary}
					</div>

					<div className="text-[color:var(--ff15-text-muted)] text-xs">
						Active
					</div>
					<div className="min-w-0 break-all font-medium text-[13px] leading-5">
						{activeProjectsSummary}
					</div>

					<div className="text-[color:var(--ff15-text-muted)] text-xs">
						OpenSpec
					</div>
					<div className="min-w-0 break-all font-medium text-[13px] leading-5">
						{openSpecSummary}
					</div>
				</div>

				{snapshot.status === "error" ? (
					<div className="rounded-md border border-[color:rgba(248,113,113,0.4)] bg-[color:rgba(248,113,113,0.12)] px-3 py-2 text-[color:#fca5a5] text-sm leading-6">
						{snapshot.error}
					</div>
				) : null}
			</div>
		</Ff15Screen>
	);
};

export default Route;
