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

	useEffect(() => {
		const listener = (event: MessageEvent) => {
			const payload = event.data;
			if (payload?.command !== "ff15-projects.state") {
				return;
			}

			setSnapshot(payload.snapshot ?? EMPTY_SNAPSHOT);
		};

		window.addEventListener("message", listener);
		vscode.postMessage({ command: "ff15-projects.ready" });

		return () => {
			window.removeEventListener("message", listener);
		};
	}, []);

	const availableProfiles =
		snapshot.status === "ready" ? snapshot.profiles : [];
	const warningProfiles = availableProfiles.filter(
		(profile) => profile.warnings.length > 0
	);
	let activeProjectsSummary = "Projects context unavailable.";
	if (snapshot.activeProjects.length > 0) {
		activeProjectsSummary = snapshot.activeProjects.join(", ");
	} else if (snapshot.status === "ready") {
		activeProjectsSummary = "No active projects selected.";
	}

	return (
		<div className="mx-auto flex h-full max-w-3xl flex-col gap-3 px-3 py-2">
			<div className="flex items-center gap-3">
				<h1 className="font-semibold text-[color:var(--vscode-foreground)] text-sm uppercase tracking-[0.18em]">
					Projects
				</h1>
			</div>

			<div className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] text-xs leading-5">
				Review the current harness source here. Open the editor when you need to
				change active projects or OpenSpec resolution.
			</div>

			<SidebarActionButton
				onClick={() => {
					vscode.postMessage({ command: "ff15-projects.open-editor" });
				}}
			>
				Open Projects Editor
			</SidebarActionButton>

			<div className="grid gap-2">
				<div className="rounded-lg border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_70%,transparent)] px-3 py-2 text-sm">
					<div className="text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] uppercase tracking-[0.14em]">
						Source
					</div>
					<div className="mt-1 font-medium text-[color:var(--vscode-foreground)]">
						{formatSourceKind(snapshot.sourceKind)}
					</div>
					<div className="mt-1 break-all text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.75))] text-xs">
						{snapshot.sourcePath ?? "-"}
					</div>
					<div className="mt-1 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.75))] text-xs">
						Config Version: {snapshot.configVersion ?? "-"}
					</div>
				</div>

				<div className="rounded-lg border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_70%,transparent)] px-3 py-2 text-sm">
					<div className="text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] uppercase tracking-[0.14em]">
						Active Projects
					</div>
					<div className="mt-1 text-[color:var(--vscode-foreground)] text-sm leading-5">
						{activeProjectsSummary}
					</div>
					<div className="mt-2 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.75))] text-xs">
						Profiles Available: {availableProfiles.length}
					</div>
				</div>

				<div className="rounded-lg border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_70%,transparent)] px-3 py-2 text-sm">
					<div className="text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] uppercase tracking-[0.14em]">
						OpenSpec
					</div>
					<div className="mt-1 text-[color:var(--vscode-foreground)] text-sm">
						Mode: {snapshot.openspec.mode ?? "-"}
					</div>
					<div className="mt-1 break-all text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.75))] text-xs leading-5">
						{snapshot.openspec.path ?? "-"}
					</div>
					<div className="mt-1 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.75))] text-xs">
						Resolved Project: {snapshot.openspec.sourceProjectId ?? "-"}
					</div>
				</div>

				{warningProfiles.length > 0 ? (
					<div className="rounded-lg border border-[color:var(--vscode-warningForeground,#fbbf24)]/35 bg-[color:var(--vscode-warningForeground,#fbbf24)]/10 px-3 py-2 text-sm">
						<div className="text-[10px] text-[color:var(--vscode-warningForeground,#fbbf24)] uppercase tracking-[0.14em]">
							Warnings
						</div>
						<div className="mt-2 grid gap-2 text-[11px] text-[color:var(--vscode-warningForeground,#fbbf24)]">
							{warningProfiles.map((profile) => (
								<div key={profile.id}>
									<span className="font-semibold">{profile.id}:</span>{" "}
									{profile.warnings.join(" ")}
								</div>
							))}
						</div>
					</div>
				) : null}
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
