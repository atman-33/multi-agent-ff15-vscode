import type React from "react";
import { cn } from "@/lib/utils";

export interface SidebarListItemButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	active?: boolean;
	badge?: React.ReactNode;
	description?: React.ReactNode;
	label: React.ReactNode;
}

export const SidebarListItemButton = ({
	active = false,
	badge,
	className,
	description,
	label,
	type,
	...rest
}: SidebarListItemButtonProps) => (
	<button
		className={cn(
			"w-full cursor-pointer rounded-md border px-3 py-2.5 text-left transition-colors",
			active
				? "border-transparent bg-[color:var(--vscode-list-activeSelectionBackground)] text-[color:var(--vscode-list-activeSelectionForeground,var(--vscode-foreground))]"
				: "border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] text-[color:var(--vscode-foreground)] hover:bg-[color:var(--vscode-list-hoverBackground)]",
			className
		)}
		type={type ?? "button"}
		{...rest}
	>
		<div className="flex items-start justify-between gap-3">
			<div className="min-w-0 flex-1">
				<div className="truncate font-medium text-sm leading-5">{label}</div>
				{description ? (
					<div className="mt-1 truncate text-[color:var(--vscode-descriptionForeground)] text-xs">
						{description}
					</div>
				) : null}
			</div>
			{badge ? <div className="shrink-0">{badge}</div> : null}
		</div>
	</button>
);
