import { useEffect, useState } from "react";
import { vscode } from "@/lib/vscode";
import {
	buildDraftFromSnapshot,
	EMPTY_DRAFT,
	EMPTY_SNAPSHOT,
	formatSourceKind,
	getSaveStateColor,
	type ProjectsDraft,
	type ProjectsSnapshot,
	type SaveState,
} from "../ff15-projects/model";

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
				case "ff15-projects-workbench.state": {
					const nextSnapshot = payload.snapshot ?? EMPTY_SNAPSHOT;
					setSnapshot(nextSnapshot);
					setDraft((currentDraft) =>
						buildDraftFromSnapshot(nextSnapshot, currentDraft)
					);
					return;
				}
				case "ff15-projects-workbench.save-status": {
					setSaveMessage(payload.message ?? "Projects status updated.");
					setSaveState(payload.state ?? "idle");
					return;
				}
				default:
					return;
			}
		};

		window.addEventListener("message", listener);
		vscode.postMessage({ command: "ff15-projects-workbench.ready" });

		return () => {
			window.removeEventListener("message", listener);
		};
	}, []);

	const updateDraft = (nextDraft: ProjectsDraft) => {
		setDraft(nextDraft);
		vscode.postMessage({
			command: "ff15-projects-workbench.updateDraft",
			draft: nextDraft,
		});
	};

	const availableProfiles =
		snapshot.status === "ready" ? snapshot.profiles : [];
	const warningProfiles = availableProfiles.filter(
		(profile) => profile.warnings.length > 0
	);

	return (
		<div className="mx-auto flex h-full max-w-4xl flex-col gap-4 px-6 py-5">
			<div className="flex flex-col gap-1">
				<h1 className="font-semibold text-[color:var(--vscode-foreground)] text-base uppercase tracking-[0.08em]">
					Projects Editor
				</h1>
				<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] text-sm leading-6">
					Update active projects and OpenSpec resolution here. Changes are
					autosaved back to the harness config.
				</p>
			</div>

			<div className={`text-xs ${getSaveStateColor(saveState)}`}>
				{saveMessage}
			</div>

			<div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
				<div className="grid gap-3">
					<div className="rounded-xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_72%,transparent)] px-4 py-3 text-sm">
						<div className="text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] uppercase tracking-[0.14em]">
							Active Projects
						</div>
						<div className="mt-2 grid gap-2">
							{availableProfiles.length > 0 ? (
								availableProfiles.map((profile) => {
									const checked = draft.activeProjects.includes(profile.id);
									return (
										<label
											className="flex cursor-pointer items-start gap-2 rounded-lg border border-[color:color-mix(in_srgb,var(--vscode-foreground)_10%,transparent)] px-3 py-2"
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
												<div className="font-medium text-[color:var(--vscode-foreground)] text-sm">
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

					<div className="rounded-xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_72%,transparent)] px-4 py-3 text-sm">
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
						<div className="mt-3 break-all text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.75))] text-xs leading-5">
							Resolved Path: {snapshot.openspec.path ?? "-"}
						</div>
						<div className="mt-1 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.75))] text-xs">
							Resolved Project: {snapshot.openspec.sourceProjectId ?? "-"}
						</div>
					</div>
				</div>

				<div className="grid gap-3">
					<div className="rounded-xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_72%,transparent)] px-4 py-3 text-sm">
						<div className="text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] uppercase tracking-[0.14em]">
							Source
						</div>
						<div className="mt-2 font-medium text-[color:var(--vscode-foreground)]">
							{formatSourceKind(snapshot.sourceKind)}
						</div>
						<div className="mt-1 break-all text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.75))] text-xs leading-5">
							{snapshot.sourcePath ?? "-"}
						</div>
						<div className="mt-1 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.75))] text-xs">
							Config Version: {snapshot.configVersion ?? "-"}
						</div>
					</div>

					{warningProfiles.length > 0 ? (
						<div className="rounded-xl border border-[color:var(--vscode-warningForeground,#fbbf24)]/35 bg-[color:var(--vscode-warningForeground,#fbbf24)]/10 px-4 py-3 text-sm">
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

					{snapshot.status === "error" ? (
						<div className="rounded-xl border border-[color:var(--vscode-errorForeground,#f87171)]/35 bg-[color:var(--vscode-errorForeground,#f87171)]/12 px-4 py-3 text-[color:var(--vscode-errorForeground,#f87171)] text-sm leading-6">
							{snapshot.error}
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
};

export default Route;
