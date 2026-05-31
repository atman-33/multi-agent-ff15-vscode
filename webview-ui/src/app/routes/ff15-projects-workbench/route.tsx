import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Checkbox } from "@/components/ui/checkbox";
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

const applyStateMessage = (input: {
	payload: { snapshot?: ProjectsSnapshot };
	setConflictMessage: (message: string | null) => void;
	setDraft: Dispatch<SetStateAction<ProjectsDraft>>;
	setSnapshot: (snapshot: ProjectsSnapshot) => void;
}) => {
	const nextSnapshot = input.payload.snapshot ?? EMPTY_SNAPSHOT;
	input.setSnapshot(nextSnapshot);
	input.setConflictMessage(null);
	input.setDraft((currentDraft) =>
		buildDraftFromSnapshot(nextSnapshot, currentDraft)
	);
};

const applyConflictMessage = (input: {
	payload: { active?: boolean; message?: string };
	setConflictMessage: (message: string | null) => void;
	setSaveMessage: (message: string) => void;
	setSaveState: (state: SaveState) => void;
}) => {
	input.setConflictMessage(
		input.payload.active
			? (input.payload.message ?? "External Projects changes detected.")
			: null
	);

	if (!input.payload.active) {
		return;
	}

	input.setSaveMessage(
		input.payload.message ??
			"External Projects changes detected. Resolve the conflict to continue."
	);
	input.setSaveState("conflict");
};

const applySaveStatusMessage = (input: {
	payload: { message?: string; state?: SaveState };
	setSaveMessage: (message: string) => void;
	setSaveState: (state: SaveState) => void;
}) => {
	input.setSaveMessage(input.payload.message ?? "Projects status updated.");
	input.setSaveState(input.payload.state ?? "idle");
};

const Route = () => {
	const [snapshot, setSnapshot] = useState<ProjectsSnapshot>(EMPTY_SNAPSHOT);
	const [draft, setDraft] = useState<ProjectsDraft>(EMPTY_DRAFT);
	const [conflictMessage, setConflictMessage] = useState<string | null>(null);
	const [saveMessage, setSaveMessage] = useState<string>(
		"Waiting for Projects context..."
	);
	const [saveState, setSaveState] = useState<SaveState>("idle");

	useEffect(() => {
		const listener = (event: MessageEvent) => {
			const payload = event.data;
			switch (payload?.command) {
				case "ff15-projects-workbench.state": {
					applyStateMessage({
						payload,
						setConflictMessage,
						setDraft,
						setSnapshot,
					});
					return;
				}
				case "ff15-projects-workbench.conflict": {
					applyConflictMessage({
						payload,
						setConflictMessage,
						setSaveMessage,
						setSaveState,
					});
					return;
				}
				case "ff15-projects-workbench.save-status": {
					applySaveStatusMessage({
						payload,
						setSaveMessage,
						setSaveState,
					});
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

	const resolveConflict = (
		resolution: "discard-local" | "keep-local" | "reload"
	) => {
		vscode.postMessage({
			command: "ff15-projects-workbench.resolveConflict",
			resolution,
		});
	};

	const availableProfiles =
		snapshot.status === "ready" ? snapshot.profiles : [];
	const warningProfiles = availableProfiles.filter(
		(profile) => profile.warnings.length > 0
	);
	const inputsDisabled = snapshot.status !== "ready" || conflictMessage != null;

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

			{conflictMessage ? (
				<div className="rounded-xl border border-[color:var(--vscode-warningForeground,#fbbf24)]/40 bg-[color:var(--vscode-warningForeground,#fbbf24)]/10 px-4 py-3 text-sm">
					<div className="font-medium text-[color:var(--vscode-warningForeground,#fbbf24)]">
						External change conflict
					</div>
					<p className="mt-1 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.82))] text-xs leading-5">
						{conflictMessage}
					</p>
					<div className="mt-3 flex flex-wrap gap-2">
						<button
							className="rounded-md border border-[color:color-mix(in_srgb,var(--vscode-foreground)_18%,transparent)] px-3 py-1 text-xs"
							onClick={() => resolveConflict("reload")}
							type="button"
						>
							Reload
						</button>
						<button
							className="rounded-md border border-[color:color-mix(in_srgb,var(--vscode-foreground)_18%,transparent)] px-3 py-1 text-xs"
							onClick={() => resolveConflict("discard-local")}
							type="button"
						>
							Discard local
						</button>
						<button
							className="rounded-md border border-[color:var(--vscode-textLink-foreground,#60a5fa)] bg-[color:color-mix(in_srgb,var(--vscode-textLink-foreground,#60a5fa)_14%,transparent)] px-3 py-1 text-xs"
							onClick={() => resolveConflict("keep-local")}
							type="button"
						>
							Keep local
						</button>
					</div>
				</div>
			) : null}

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
									const checkboxId = `active-project-${profile.id}`;
									return (
										<label
											className="flex cursor-pointer items-start gap-2 rounded-lg border border-[color:color-mix(in_srgb,var(--vscode-foreground)_10%,transparent)] px-3 py-2"
											htmlFor={checkboxId}
											key={profile.id}
										>
											<Checkbox
												checked={checked}
												className="mt-0.5 shrink-0"
												disabled={inputsDisabled}
												id={checkboxId}
												onCheckedChange={(nextCheckedState) => {
													const nextActiveProjects =
														nextCheckedState === true
															? [...draft.activeProjects, profile.id]
															: draft.activeProjects.filter(
																	(projectId) => projectId !== profile.id
																);
													updateDraft({
														...draft,
														activeProjects: nextActiveProjects,
													});
												}}
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
								disabled={inputsDisabled}
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
									disabled={inputsDisabled}
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
