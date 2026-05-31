import { SidebarActionButton } from "@/components/sidebar-action-button";
import { TextareaPanel } from "@/components/textarea-panel";
import { cn } from "@/lib/utils";
import {
	MISSION_STATUS_LABELS,
	OPERATION_REQUIRED_MESSAGE,
	type MissionWorkbenchMission,
} from "./shared";

interface PromptComposerPanelProps {
	composerActionDisabled: boolean;
	composerActionLabel: string;
	composerDisabled: boolean;
	composerPlaceholder: string;
	draft: string;
	hasDeliverableOperation: boolean;
	mission: MissionWorkbenchMission;
	onDraftChange: (value: string) => void;
	onSend: () => void;
}

export const PromptComposerPanel = ({
	composerActionDisabled,
	composerActionLabel,
	composerDisabled,
	composerPlaceholder,
	draft,
	hasDeliverableOperation,
	mission,
	onDraftChange,
	onSend,
}: PromptComposerPanelProps) => {
	const footerMessage = hasDeliverableOperation
		? (mission.lastError ??
			"Prompt delivery stays mission-scoped and preserves this workbench context.")
		: OPERATION_REQUIRED_MESSAGE;

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div>
				<div className="font-semibold text-[color:var(--vscode-foreground)] text-sm uppercase tracking-[0.18em]">
					Prompt Composer
				</div>
				<div className="mt-2 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] text-sm leading-6">
					Write the message after choosing an operation. Delivery stays
					mission-scoped and runs through the selected operation context.
				</div>
			</div>

			<div className="min-h-0 flex-1">
				<TextareaPanel
					containerClassName=" px-0"
					disabled={composerDisabled}
					onChange={(event) => {
						onDraftChange(event.target.value);
					}}
					placeholder={composerPlaceholder}
					rows={10}
					textareaClassName="min-h-[16rem] px-5 text-sm leading-7"
					value={draft}
				>
					<div className="flex items-center justify-between gap-3 border-[color:color-mix(in_srgb,var(--vscode-foreground)_10%,transparent)] border-t px-5 pt-3">
						<div className="flex min-w-0 flex-col gap-1">
							<span
								className={cn(
									"w-fit rounded-full border px-2 py-0.5 font-medium text-[10px] uppercase tracking-[0.12em]",
									hasDeliverableOperation
										? "border-emerald-500/30 bg-emerald-500/12 text-emerald-200"
										: "border-[color:var(--vscode-warningForeground,#fbbf24)]/35 bg-[color:var(--vscode-warningForeground,#fbbf24)]/12 text-[color:var(--vscode-warningForeground,#fbbf24)]"
								)}
							>
								{hasDeliverableOperation
									? MISSION_STATUS_LABELS[mission.status]
									: "Operation Required"}
							</span>
							<span className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
								{footerMessage}
							</span>
						</div>
						<SidebarActionButton
							className="h-8 w-auto px-4 text-xs"
							disabled={composerActionDisabled}
							onClick={onSend}
						>
							{composerActionLabel}
						</SidebarActionButton>
					</div>
				</TextareaPanel>
			</div>
		</div>
	);
};
