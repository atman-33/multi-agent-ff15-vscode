import { SidebarActionButton } from "@/components/sidebar-action-button";
import { vscode } from "@/lib/vscode";

const Route = () => (
	<div className="px-3 py-1.5">
		<SidebarActionButton
			onClick={() => {
				vscode.postMessage({ command: "ff15-settings.open" });
			}}
		>
			Open FF15 Settings
		</SidebarActionButton>
	</div>
);

export default Route;
