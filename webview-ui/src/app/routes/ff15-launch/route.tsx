import { PillButton } from "@/components/pill-button";
import { vscode } from "@/lib/vscode";
import { useEffect, useState } from "react";

type LaunchState = "error" | "idle" | "launched" | "launching";

const STATUS_COPY: Record<LaunchState, string> = {
	error: "Launch failed. Check the VS Code notification for details.",
	idle: "Open Zellij for the current workspace from one place.",
	launched: "Zellij is opening inside the VS Code terminal.",
	launching: "Checking dependencies and opening Zellij...",
};

const Route = () => {
	const [message, setMessage] = useState(STATUS_COPY.idle);
	const [state, setState] = useState<LaunchState>("idle");

	useEffect(() => {
		const listener = (event: MessageEvent) => {
			const payload = event.data;
			if (payload?.command !== "ff15-launch.status") {
				return;
			}

			setState(payload.state ?? "idle");
			setMessage(payload.message ?? STATUS_COPY.idle);
		};

		window.addEventListener("message", listener);
		return () => {
			window.removeEventListener("message", listener);
		};
	}, []);

	return (
		<div className="mx-auto flex h-full max-w-3xl flex-col gap-6 px-3 py-1.5">
			<header className="flex flex-col gap-2">
				<p className="font-semibold text-[color:var(--vscode-foreground)] text-xl leading-tight">
					FF15 Launch Surface
				</p>
				<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] text-sm leading-6">
					Start the FF15 workspace from the current VS Code root. This first
					slice checks local dependencies, opens a VS Code terminal, and starts
					Zellij without relying on the sibling multi-agent-ff15 repository.
				</p>
			</header>

			<section className="rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_78%,transparent)] px-4 py-4 shadow-[0_12px_32px_rgba(0,0,0,0.22)]">
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<p className="font-medium text-[color:var(--vscode-foreground)] text-base">
							Launch FF15
						</p>
						<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] text-sm leading-6">
							The launcher validates `zellij` and `opencode` first, then opens
							Zellij in the integrated terminal for the active workspace.
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-3">
						<PillButton
							className="bg-[color:var(--vscode-button-background,#0e7490)] text-[color:var(--vscode-button-foreground,#ffffff)] hover:bg-[color:var(--vscode-button-hoverBackground,var(--vscode-button-background,#0e7490)))]"
							disabled={state === "launching"}
							onClick={() => {
								setState("launching");
								setMessage(STATUS_COPY.launching);
								vscode.postMessage({ command: "ff15-launch.start" });
							}}
						>
							{state === "launching" ? "Launching..." : "Open Zellij"}
						</PillButton>
					</div>

					<div className="rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_62%,transparent)] px-3 py-3">
						<p className="font-medium text-[color:var(--vscode-foreground)] text-sm">
							Status
						</p>
						<p className="mt-2 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] text-sm leading-6">
							{message}
						</p>
					</div>
				</div>
			</section>
		</div>
	);
};

export default Route;
