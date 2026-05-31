import { useEffect, useState } from "react";
import { vscode } from "@/lib/vscode";

interface ProjectProfile {
	id: string;
	warnings: string[];
}

type ProjectsSnapshot =
	| {
			status: "ready";
			sourceKind: "agents" | "ff15";
			sourcePath: string;
			configVersion: number | string | null;
			activeProjects: string[];
			profiles: ProjectProfile[];
			openspec: {
				mode: "project" | "harness";
				path: string | null;
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
			profiles: [];
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
	profiles: [],
	sourceKind: null,
	sourcePath: null,
	status: "error",
};

interface ProjectsDraft {
	activeProjects: string[];
	openspec: {
		mode: "project" | "harness";
		projectId: string | null;
	};
}

type SaveState = "error" | "idle" | "saved" | "saving";

const EMPTY_DRAFT: ProjectsDraft = {
	activeProjects: [],
	openspec: {
		mode: "project",
		projectId: null,
	},
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

const buildDraftFromSnapshot = (
	snapshot: ProjectsSnapshot,
	previousDraft: ProjectsDraft
): ProjectsDraft => {
	if (snapshot.status !== "ready") {
		return previousDraft;
	}

	return {
		activeProjects: snapshot.activeProjects,
		openspec: {
			mode: snapshot.openspec.mode,
			projectId:
				snapshot.openspec.mode === "project"
					? snapshot.openspec.sourceProjectId
					: previousDraft.openspec.projectId,
		},
	};
};

const getSaveStateColor = (state: SaveState) => {
	switch (state) {
		case "error":
			return "text-[color:var(--vscode-errorForeground,#f87171)]";
		case "saved":
			return "text-[color:var(--vscode-testing-iconPassed,#4ade80)]";
		case "saving":
			return "text-[color:var(--vscode-textLink-foreground,#60a5fa)]";
		default:
			return "text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.75))]";
	}
};

const Route = () => {
	const [snapshot, setSnapshot] = useState<ProjectsSnapshot>(EMPTY_SNAPSHOT);
	const [draft, setDraft] = useState<ProjectsDraft>(EMPTY_DRAFT);
	const [saveMessage, setSaveMessage] = useState<string>(
		"Waiting for Projects context..."
	);
	const [saveState, setSaveState] = useState<SaveState>("idle");

	useEffect(() => {
		const listener = (event: MessageEvent) => {
			const payload = event.data;
			switch (payload?.command) {
				case "ff15-projects.state": {
					const nextSnapshot = payload.snapshot ?? EMPTY_SNAPSHOT;
					setSnapshot(nextSnapshot);
					setDraft((currentDraft) =>
						buildDraftFromSnapshot(nextSnapshot, currentDraft)
					);
					return;
				}
				case "ff15-projects.save-status": {
					setSaveMessage(payload.message ?? "Projects status updated.");
					setSaveState(payload.state ?? "idle");
					return;
				}
				default:
					return;
			}
		};

		window.addEventListener("message", listener);
		vscode.postMessage({ command: "ff15-projects.ready" });

		return () => {
			window.removeEventListener("message", listener);
		};
	}, []);

	const updateDraft = (nextDraft: ProjectsDraft) => {
		setDraft(nextDraft);
		vscode.postMessage({
			command: "ff15-projects.updateDraft",
			draft: nextDraft,
		});
	};

	const availableProfiles =
		snapshot.status === "ready" ? snapshot.profiles : [];
	const warningProfiles = availableProfiles.filter(
		(profile) => profile.warnings.length > 0
	);

	return (
		<div className="mx-auto flex h-full max-w-3xl flex-col gap-3 px-3 py-1.5">
			<div className="flex items-center gap-3">
				<h1 className="font-semibold text-[color:var(--vscode-foreground)] text-sm uppercase tracking-[0.18em]">
					Projects
				</h1>
			</div>

			<div className={`text-xs ${getSaveStateColor(saveState)}`}>
				{saveMessage}
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
					<div className="mt-2 grid gap-2">
						{availableProfiles.length > 0 ? (
							availableProfiles.map((profile) => {
								const checked = draft.activeProjects.includes(profile.id);
								return (
									<label
										className="flex cursor-pointer items-start gap-2 rounded-md border border-[color:color-mix(in_srgb,var(--vscode-foreground)_10%,transparent)] px-2 py-1.5"
										key={profile.id}
									>
										<input
											checked={checked}
											disabled={snapshot.status !== "ready"}
											onChange={(event) => {
												const nextActiveProjects = event.target.checked
													? [...draft.activeProjects, profile.id]
													: draft.activeProjects.filter(
															(projectId) => projectId !== profile.id
														);
												updateDraft({
													...draft,
													activeProjects: nextActiveProjects,
												});
											}}
											type="checkbox"
										/>
										<div className="min-w-0 flex-1">
											<div className="font-medium text-[color:var(--vscode-foreground)] text-xs">
												{profile.id}
											</div>
											{profile.warnings.length > 0 ? (
												<div className="mt-1 text-[11px] text-[color:var(--vscode-warningForeground,#fbbf24)]">
													{profile.warnings.join(" ")}
												</div>
											) : null}
										</div>
									</label>
								);
							})
						) : (
							<div className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.75))] text-xs">
								No project profiles found.
							</div>
						)}
					</div>
				</div>

				<div className="rounded-lg border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_70%,transparent)] px-3 py-2 text-sm">
					<div className="text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] uppercase tracking-[0.14em]">
						OpenSpec
					</div>
					<label className="mt-2 flex flex-col gap-1 text-xs">
						<span className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.75))] uppercase tracking-[0.12em]">
							Mode
						</span>
						<select
							className="rounded-md border border-[color:color-mix(in_srgb,var(--vscode-foreground)_18%,transparent)] bg-[color:var(--vscode-input-background)] px-2 py-1 text-[color:var(--vscode-input-foreground)]"
							disabled={snapshot.status !== "ready"}
							onChange={(event) => {
								const mode = event.target.value as "project" | "harness";
								updateDraft({
									...draft,
									openspec: {
										...draft.openspec,
										mode,
									},
								});
							}}
							value={draft.openspec.mode}
						>
							<option value="project">project</option>
							<option value="harness">harness</option>
						</select>
					</label>
					{draft.openspec.mode === "project" ? (
						<label className="mt-2 flex flex-col gap-1 text-xs">
							<span className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.75))] uppercase tracking-[0.12em]">
								Project
							</span>
							<select
								className="rounded-md border border-[color:color-mix(in_srgb,var(--vscode-foreground)_18%,transparent)] bg-[color:var(--vscode-input-background)] px-2 py-1 text-[color:var(--vscode-input-foreground)]"
								disabled={snapshot.status !== "ready"}
								onChange={(event) => {
									updateDraft({
										...draft,
										openspec: {
											...draft.openspec,
											projectId: event.target.value || null,
										},
									});
								}}
								value={draft.openspec.projectId ?? ""}
							>
								<option value="">Select a project</option>
								{availableProfiles.map((profile) => (
									<option key={profile.id} value={profile.id}>
										{profile.id}
									</option>
								))}
							</select>
						</label>
					) : null}
					<div className="mt-1 break-all text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.75))] text-xs">
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
				<div className="rounded-lg border border-[color:var(--vscode-errorForeground,#f87171)]/35 bg-[color:var(--vscode-errorForeground,#f87171)]/12 px-3 py-2 text-[color:var(--vscode-errorForeground,#f87171)] text-sm">
					{snapshot.error}
				</div>
			) : null}
		</div>
	);
};

export default Route;
