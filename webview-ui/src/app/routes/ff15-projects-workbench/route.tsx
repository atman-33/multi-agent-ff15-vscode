import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { DevBadge } from "@/components/dev-badge";
import { Ff15Panel } from "@/components/ff15/ff15-panel";
import { useDevMode } from "@/hooks/use-dev-mode";
import { Ff15RuneButton } from "@/components/ff15/ff15-rune-button";
import { Ff15Screen } from "@/components/ff15/ff15-screen";
import { SidebarActionButton } from "@/components/sidebar-action-button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
	const devMode = useDevMode("ff15-projects-workbench.state");

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

	const setOpenspecProjectId = (projectId: string | null) => {
		updateDraft({
			...draft,
			openspec: {
				...draft.openspec,
				projectId,
			},
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
	const inputsDisabled = snapshot.status !== "ready" || conflictMessage != null;

	return (
		<Ff15Screen>
			<div className="mx-auto flex h-full max-w-4xl flex-col gap-4 px-6 py-5">
				{devMode ? <DevBadge /> : null}
				<div className="flex flex-col gap-2">
					<span className="font-semibold text-[color:var(--ff15-gold)] text-sm uppercase tracking-[0.18em]">
						Projects Editor
					</span>
					<div className="ff15-divider" />
					<p className="text-[color:var(--ff15-text-muted)] text-sm leading-6">
						Update active projects and OpenSpec resolution here. Changes are
						autosaved back to the harness config.
					</p>
				</div>

				<div className={`text-xs ${getSaveStateColor(saveState)}`}>
					{saveMessage}
				</div>

				{conflictMessage ? (
					<div className="rounded-xl border border-[color:rgba(252,211,77,0.4)] bg-[color:rgba(252,211,77,0.1)] px-4 py-3 text-sm">
						<div className="font-medium text-[color:#fcd34d]">
							External change conflict
						</div>
						<p className="mt-1 text-[color:var(--ff15-text-muted)] text-xs leading-5">
							{conflictMessage}
						</p>
						<div className="mt-3 flex flex-wrap gap-2">
							<SidebarActionButton
								className="h-7 w-auto px-3 text-[11px]"
								onClick={() => resolveConflict("reload")}
							>
								Reload
							</SidebarActionButton>
							<SidebarActionButton
								className="h-7 w-auto px-3 text-[11px]"
								onClick={() => resolveConflict("discard-local")}
							>
								Discard local
							</SidebarActionButton>
							<Ff15RuneButton
								className="h-7 px-3"
								onClick={() => resolveConflict("keep-local")}
							>
								Keep local
							</Ff15RuneButton>
						</div>
					</div>
				) : null}

				<div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
					<div className="grid gap-3">
						<Ff15Panel className="px-4 py-3 text-sm">
							<div className="ff15-label">Active Projects</div>
							<p className="mt-1 text-[11px] text-[color:var(--ff15-text-muted)] leading-5">
								Turn on the OpenSpec switch for one active project to use its
								openspec folder. With every switch off, the working directory
								openspec folder is used.
							</p>
							<div className="mt-2 grid gap-2">
								{availableProfiles.length > 0 ? (
									availableProfiles.map((profile) => {
										const isActive = draft.activeProjects.includes(profile.id);
										const isOpenspecSource =
											draft.openspec.projectId === profile.id;
										const activeSwitchId = `active-project-${profile.id}`;
										const switchId = `openspec-project-${profile.id}`;
										return (
											<div
												className="flex items-start gap-3 rounded-lg border border-[color:var(--ff15-border-soft)] px-3 py-2 transition-colors hover:border-[color:var(--ff15-border)]"
												key={profile.id}
											>
												<label
													className="flex min-w-0 flex-1 cursor-pointer items-start gap-2"
													htmlFor={activeSwitchId}
												>
													<Switch
														checked={isActive}
														className="mt-0.5 shrink-0"
														disabled={inputsDisabled}
														id={activeSwitchId}
														onCheckedChange={(nextCheckedState) => {
															const nextActive = nextCheckedState === true;
															const nextActiveProjects = nextActive
																? [...draft.activeProjects, profile.id]
																: draft.activeProjects.filter(
																		(projectId) => projectId !== profile.id
																	);
															// Deactivating the OpenSpec source falls back to
															// the working directory openspec folder.
															const nextProjectId =
																!nextActive && isOpenspecSource
																	? null
																	: draft.openspec.projectId;
															updateDraft({
																...draft,
																activeProjects: nextActiveProjects,
																openspec: {
																	...draft.openspec,
																	projectId: nextProjectId,
																},
															});
														}}
													/>
													<div className="min-w-0 flex-1">
														<div className="font-medium text-[color:var(--ff15-text)] text-sm">
															{profile.id}
														</div>
														{profile.warnings.length > 0 ? (
															<div className="mt-1 text-[11px] text-[color:#fcd34d]">
																{profile.warnings.join(" ")}
															</div>
														) : null}
													</div>
												</label>
												<div className="flex shrink-0 flex-col items-center gap-1">
													<label
														className="text-[10px] text-[color:var(--ff15-text-muted)] uppercase tracking-[0.12em]"
														htmlFor={switchId}
													>
														OpenSpec
													</label>
													<Switch
														checked={isOpenspecSource}
														disabled={inputsDisabled || !isActive}
														id={switchId}
														onCheckedChange={(nextCheckedState) => {
															// Single-select: enabling one clears the others;
															// disabling the active source clears it.
															if (nextCheckedState) {
																setOpenspecProjectId(profile.id);
															} else if (isOpenspecSource) {
																setOpenspecProjectId(null);
															}
														}}
													/>
												</div>
											</div>
										);
									})
								) : (
									<div className="text-[color:var(--ff15-text-muted)] text-xs">
										No project profiles found.
									</div>
								)}
							</div>
						</Ff15Panel>

						<Ff15Panel className="px-4 py-3 text-sm">
							<div className="ff15-label">OpenSpec Resolution</div>
							<div className="mt-2 break-all text-[color:var(--ff15-text-muted)] text-xs leading-5">
								Resolved Path: {snapshot.openspec.path ?? "-"}
							</div>
							<div className="mt-1 text-[color:var(--ff15-text-muted)] text-xs">
								Source Project:{" "}
								{snapshot.openspec.sourceProjectId ?? "working directory"}
							</div>
						</Ff15Panel>
					</div>

					<div className="grid gap-3">
						<Ff15Panel className="px-4 py-3 text-sm">
							<div className="ff15-label">Language</div>
							<div className="mt-2 flex flex-col gap-1 text-xs">
								<label
									className="text-[color:var(--ff15-text-muted)] uppercase tracking-[0.12em]"
									htmlFor="language"
								>
									Operation language
								</label>
								<Select
									disabled={inputsDisabled}
									onValueChange={(value) => {
										updateDraft({
											...draft,
											languageName: value as "en" | "ja",
										});
									}}
									value={draft.languageName}
								>
									<SelectTrigger
										className="w-full border-[color:var(--ff15-border-soft)] bg-[color:rgba(8,10,16,0.6)] text-[color:var(--ff15-text)]"
										id="language"
									>
										<SelectValue placeholder="Select language" />
									</SelectTrigger>
									<SelectContent
										align="start"
										className="border-[color:var(--ff15-border-soft)] bg-[rgba(8,10,16,0.98)] text-[color:var(--ff15-text)]"
										position="popper"
									>
										<SelectItem value="en">English</SelectItem>
										<SelectItem value="ja">日本語</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</Ff15Panel>

						<Ff15Panel className="px-4 py-3 text-sm">
							<div className="ff15-label">Source</div>
							<div className="mt-2 font-medium text-[color:var(--ff15-text)]">
								{formatSourceKind(snapshot.sourceKind)}
							</div>
							<div className="mt-1 break-all text-[color:var(--ff15-text-muted)] text-xs leading-5">
								{snapshot.sourcePath ?? "-"}
							</div>
						</Ff15Panel>

						{snapshot.status === "error" ? (
							<div className="rounded-xl border border-[color:rgba(248,113,113,0.4)] bg-[color:rgba(248,113,113,0.12)] px-4 py-3 text-[color:#fca5a5] text-sm leading-6">
								{snapshot.error}
							</div>
						) : null}
					</div>
				</div>
			</div>
		</Ff15Screen>
	);
};

export default Route;
