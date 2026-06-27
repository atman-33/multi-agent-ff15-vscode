import { Ff15Screen } from "@/components/ff15/ff15-screen";
import { SidebarActionButton } from "@/components/sidebar-action-button";
import { vscode } from "@/lib/vscode";
import { useEffect, useState } from "react";

type LaunchState = "error" | "idle" | "launched" | "launching";

const Route = () => {
	const [launchState, setLaunchState] = useState<LaunchState>("idle");

	useEffect(() => {
		const listener = (event: MessageEvent) => {
			const payload = event.data;
			if (payload?.command !== "ff15-launch.status") {
				return;
			}

			setLaunchState(payload.state ?? "idle");
		};

		window.addEventListener("message", listener);
		return () => {
			window.removeEventListener("message", listener);
		};
	}, []);

	return (
		<Ff15Screen background={false}>
			<div className="flex flex-col gap-2 px-3 py-1.5">
				<SidebarActionButton
					disabled={launchState === "launching"}
					onClick={() => {
						setLaunchState("launching");
						vscode.postMessage({ command: "ff15-launch.start" });
					}}
				>
					{launchState === "launching" ? "Launching FF15..." : "Launch FF15"}
				</SidebarActionButton>

				<SidebarActionButton
					onClick={() => {
						vscode.postMessage({ command: "ff15-settings.open" });
					}}
				>
					Open FF15 Settings
				</SidebarActionButton>
			</div>
		</Ff15Screen>
	);
};

export default Route;
