import { useEffect, useState } from "react";
import { vscode } from "@/lib/vscode";

type ProjectsSnapshot =
	| {
			status: "ready";
			sourceKind: "agents" | "ff15";
			sourcePath: string;
			configVersion: number | string | null;
			activeProjects: string[];
			openspec: {
				mode: "project" | "harness";
				path: string;
				sourceProjectId: string | null;
			};
			error: null;
	  }
	| {
			status: "error";
			sourceKind: "agents" | "ff15" | null;
			sourcePath: string | null;
			configVersion: null;
			activeProjects: string[];
			openspec: {
				mode: null;
				path: null;
				sourceProjectId: null;
			};
			error: string;
	  };

const EMPTY_SNAPSHOT: ProjectsSnapshot = {
	activeProjects: [],
	configVersion: null,
	error: "Waiting for Projects context...",
	openspec: {
		mode: null,
		path: null,
		sourceProjectId: null,
	},
	sourceKind: null,
	sourcePath: null,
	status: "error",
};

const formatSourceKind = (sourceKind: ProjectsSnapshot["sourceKind"]) => {
	if (sourceKind === "agents") {
		return ".agents/harness";
	}

	if (sourceKind === "ff15") {
		return ".ff15/harness";
	}

	return "-";
};

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

	return (
		<div className="mx-auto flex h-full max-w-3xl flex-col gap-3 px-3 py-1.5">
			<div className="flex items-center gap-3">
				<h1 className="font-semibold text-[color:var(--vscode-foreground)] text-sm uppercase tracking-[0.18em]">
					Projects
				</h1>
			</div>

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
					<div className="mt-1 flex flex-wrap gap-1.5">
						{snapshot.activeProjects.length > 0
							? snapshot.activeProjects.map((projectId) => (
									<span
										className="rounded-md border border-[color:color-mix(in_srgb,var(--vscode-foreground)_15%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_78%,transparent)] px-2 py-0.5 font-medium text-[11px]"
										key={projectId}
									>
										{projectId}
									</span>
								))
							: "-"}
					</div>
				</div>

				<div className="rounded-lg border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_70%,transparent)] px-3 py-2 text-sm">
					<div className="text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] uppercase tracking-[0.14em]">
						OpenSpec
					</div>
					<div className="mt-1 font-medium text-[color:var(--vscode-foreground)]">
						Mode: {snapshot.openspec.mode ?? "-"}
					</div>
					<div className="mt-1 break-all text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.75))] text-xs">
						{snapshot.openspec.path ?? "-"}
					</div>
					<div className="mt-1 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.75))] text-xs">
						Source Project: {snapshot.openspec.sourceProjectId ?? "-"}
					</div>
				</div>
			</div>

			{snapshot.status === "error" ? (
				<div className="rounded-lg border border-[color:var(--vscode-errorForeground,#f87171)]/35 bg-[color:var(--vscode-errorForeground,#f87171)]/12 px-3 py-2 text-[color:var(--vscode-errorForeground,#f87171)] text-sm">
					{snapshot.error}
				</div>
			) : null}
		</div>
	);
};

export default Route;
