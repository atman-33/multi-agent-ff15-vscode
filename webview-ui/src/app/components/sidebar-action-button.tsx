import type React from "react";
import { cn } from "@/lib/utils";

export interface SidebarActionButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	className?: string;
	children: React.ReactNode;
}

/**
 * Compact secondary-action button in the FF15 "ghost" treatment: a translucent
 * dark surface with a hairline border that warms to gold on hover. Reserves the
 * gold gradient `Ff15RuneButton` for headline primary actions. Relies on the
 * `--ff15-*` tokens, so it must render inside an `.ff15-screen` scope (all
 * current call sites are FF15 routes).
 */
export const SidebarActionButton = ({
	className,
	type,
	children,
	...rest
}: SidebarActionButtonProps) => (
	<button
		className={cn(
			"inline-flex h-7 w-full cursor-pointer items-center justify-center rounded-md border border-[color:var(--ff15-border-soft)] bg-[color:rgba(8,10,16,0.5)] px-3 text-[13px] text-[color:var(--ff15-text)] transition-colors hover:border-[color:var(--ff15-gold-soft)] hover:bg-[color:var(--ff15-gold-faint)] hover:text-[color:var(--ff15-gold)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--ff15-gold)] disabled:pointer-events-none disabled:opacity-50",
			className
		)}
		type={type ?? "button"}
		{...rest}
	>
		{children}
	</button>
);
