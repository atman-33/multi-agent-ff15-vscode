import type React from "react";
import { cn } from "@/lib/utils";

export interface SidebarListItemButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	active?: boolean;
	badge?: React.ReactNode;
	description?: React.ReactNode;
	title: React.ReactNode;
}

export const SidebarListItemButton = ({
	active = false,
	badge,
	className,
	description,
	title,
	type,
	...rest
}: SidebarListItemButtonProps) => (
	<button
		className={cn(
			"w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
			active
				? "border-[color:var(--vscode-button-background,#0e7490)]/40 bg-[color:var(--vscode-button-background,#0e7490)]/12 text-[color:var(--vscode-foreground)]"
				: "border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_78%,transparent)] text-[color:var(--vscode-foreground)] hover:bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_68%,transparent)]",
			className
		)}
		type={type ?? "button"}
		{...rest}
	>
		<div className="flex items-start justify-between gap-3">
			<div className="min-w-0 flex-1">
				<div className="truncate font-medium text-sm leading-5">{title}</div>
				{description ? (
					<div className="mt-1 truncate text-[11px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.58))] uppercase tracking-[0.12em]">
						{description}
					</div>
				) : null}
			</div>
			{badge ? <div className="shrink-0">{badge}</div> : null}
		</div>
	</button>
);
