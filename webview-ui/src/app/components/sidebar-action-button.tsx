import type React from "react";
import { cn } from "@/lib/utils";

export interface SidebarActionButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	className?: string;
	children: React.ReactNode;
}

export const SidebarActionButton = ({
	className,
	type,
	children,
	...rest
}: SidebarActionButtonProps) => (
	<button
		className={cn(
			"inline-flex h-7 w-full cursor-pointer items-center justify-center rounded-md bg-[color:var(--vscode-button-background)] px-3 text-[13px] text-[color:var(--vscode-button-foreground)] transition-colors hover:bg-[color:var(--vscode-button-hoverBackground,var(--vscode-button-background))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--vscode-focusBorder)] disabled:pointer-events-none disabled:opacity-50",
			className
		)}
		type={type ?? "button"}
		{...rest}
	>
		{children}
	</button>
);
