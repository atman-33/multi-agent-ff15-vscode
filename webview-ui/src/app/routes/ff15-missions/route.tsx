import { DevBadge } from "@/components/dev-badge";
import { Ff15Badge, type Ff15BadgeTone } from "@/components/ff15/ff15-badge";
import { Ff15Panel } from "@/components/ff15/ff15-panel";
import { Ff15RuneButton } from "@/components/ff15/ff15-rune-button";
import { Ff15Screen } from "@/components/ff15/ff15-screen";
import { useDevMode } from "@/hooks/use-dev-mode";
import { cn } from "@/lib/utils";
import { vscode } from "@/lib/vscode";
import { PlusIcon } from "lucide-react";
import type React from "react";
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

const MISSION_STATUS_TONES: Record<MissionSummary["status"], Ff15BadgeTone> = {
	active: "active",
	draft: "neutral",
	error: "error",
	sending: "sending",
};

const EMPTY_SNAPSHOT: MissionSnapshot = {
	activeMissionId: null,
	missions: [],
};

const Route = () => {
	const [snapshot, setSnapshot] = useState<MissionSnapshot>(EMPTY_SNAPSHOT);
	const devMode = useDevMode("ff15-missions.state");

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
		<Ff15Screen background={false}>
			<div className="mx-auto flex h-full max-w-3xl flex-col gap-3 px-4 py-3">
				{devMode ? <DevBadge /> : null}
				<Ff15RuneButton
					className="w-full"
					onClick={() => {
						vscode.postMessage({ command: "ff15-missions.create" });
					}}
				>
					<PlusIcon className="h-4 w-4" />
					New Mission
				</Ff15RuneButton>

				<div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-0.5">
					{snapshot.missions.map((mission) => {
						const active = mission.id === snapshot.activeMissionId;

						return (
							<Ff15Panel
								className={cn(
									"group relative cursor-pointer overflow-hidden px-3.5 py-3 text-left transition-shadow",
									active
										? "border-[color:var(--ff15-gold-soft)] shadow-[0_0_22px_-6px_var(--ff15-gold-soft)]"
										: "hover:border-[color:var(--ff15-border)]"
								)}
								key={mission.id}
								onClick={() => {
									vscode.postMessage({
										command: "ff15-missions.select",
										missionId: mission.id,
									});
								}}
								onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
									if (event.key === "Enter" || event.key === " ") {
										event.preventDefault();
										vscode.postMessage({
											command: "ff15-missions.select",
											missionId: mission.id,
										});
									}
								}}
								role="button"
								tabIndex={0}
							>
								<span
									aria-hidden
									className={cn(
										"absolute inset-y-2 left-0 w-[3px] rounded-full transition-opacity",
										active
											? "bg-[color:var(--ff15-gold)] opacity-100"
											: "bg-[color:var(--ff15-blue)] opacity-0 group-hover:opacity-60"
									)}
								/>
								<div className="flex items-start justify-between gap-3 pl-2">
									<div className="min-w-0 flex-1">
										<div className="truncate font-medium text-[color:var(--ff15-text)] text-sm leading-5">
											{mission.title}
										</div>
										<div className="mt-1 truncate text-[color:var(--ff15-text-muted)] text-xs">
											{mission.sessionName ?? "Not attached yet"}
										</div>
									</div>
									<Ff15Badge
										pill={false}
										tone={MISSION_STATUS_TONES[mission.status]}
									>
										{MISSION_STATUS_LABELS[mission.status]}
									</Ff15Badge>
								</div>
							</Ff15Panel>
						);
					})}

					{hasMissions ? null : (
						<div className="rounded-xl border border-[color:var(--ff15-border-soft)] border-dashed px-4 py-6 text-center text-[color:var(--ff15-text-muted)] text-sm leading-6">
							No missions yet. Begin a new journey with{" "}
							<span className="text-[color:var(--ff15-gold)]">New Mission</span>
							.
						</div>
					)}
				</div>
			</div>
		</Ff15Screen>
	);
};

export default Route;
