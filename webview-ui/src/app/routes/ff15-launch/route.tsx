import { SidebarActionButton } from "@/components/sidebar-action-button";
import { vscode } from "@/lib/vscode";
import { useEffect, useState } from "react";

type LaunchState = "error" | "idle" | "launched" | "launching";

const PRIMARY_ACTION_LABEL = "Launch FF15";
const LAUNCHING_ACTION_LABEL = "Launching FF15...";

const Route = () => {
	const [state, setState] = useState<LaunchState>("idle");

	useEffect(() => {
		const listener = (event: MessageEvent) => {
			const payload = event.data;
			if (payload?.command !== "ff15-launch.status") {
				return;
			}

			setState(payload.state ?? "idle");
		};

		window.addEventListener("message", listener);
		return () => {
			window.removeEventListener("message", listener);
		};
	}, []);

	return (
		<div className="px-3 py-1.5">
			<SidebarActionButton
				disabled={state === "launching"}
				onClick={() => {
					setState("launching");
					vscode.postMessage({ command: "ff15-launch.start" });
				}}
			>
				{state === "launching" ? LAUNCHING_ACTION_LABEL : PRIMARY_ACTION_LABEL}
			</SidebarActionButton>
		</div>
	);
};

export default Route;
