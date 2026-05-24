import { PillButton } from "@/components/pill-button";
import { vscode } from "@/lib/vscode";

const Route = () => (
	<div className="mx-auto flex h-full max-w-3xl flex-col gap-6 px-3 py-1.5">
		<header className="flex flex-col gap-2">
			<p className="font-semibold text-[color:var(--vscode-foreground)] text-xl leading-tight">
				FF15 Settings
			</p>
			<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] text-sm leading-6">
				Keep launch focused and open FF15 configuration from one dedicated
				place. This view sends you to VS Code&apos;s native Settings UI for the
				FF15 extension namespace.
			</p>
		</header>

		<section className="rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_78%,transparent)] px-4 py-4 shadow-[0_12px_32px_rgba(0,0,0,0.22)]">
			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-1.5">
					<p className="font-medium text-[color:var(--vscode-foreground)] text-base">
						Open FF15 Settings
					</p>
					<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] text-sm leading-6">
						Use the native Settings editor for launch-client selection and other
						FF15 extension options as they land. The Launch view stays focused
						on starting FF15 for the active workspace.
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-3">
					<PillButton
						className="bg-[color:var(--vscode-button-background,#0e7490)] text-[color:var(--vscode-button-foreground,#ffffff)] hover:bg-[color:var(--vscode-button-hoverBackground,var(--vscode-button-background,#0e7490)))]"
						onClick={() => {
							vscode.postMessage({ command: "ff15-settings.open" });
						}}
					>
						Open FF15 Settings
					</PillButton>
				</div>
			</div>
		</section>
	</div>
);

export default Route;
