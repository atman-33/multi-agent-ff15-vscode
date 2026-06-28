import type React from "react";
import { cn } from "@/lib/utils";

export interface Ff15RuneButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	children: React.ReactNode;
}

/**
 * Gold "rune" primary action button used for the headline actions on the
 * mission screens (New Mission, Launch Terminal, Send to Noctis). Styling
 * lives in `.ff15-rune-button` (app.css); sizing defaults can be overridden
 * via `className`.
 */
export const Ff15RuneButton = ({
	children,
	className,
	type,
	...rest
}: Ff15RuneButtonProps) => (
	<button
		className={cn(
			"ff15-rune-button h-8 px-3.5 text-[11px]",
			"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--ff15-gold)]",
			className
		)}
		type={type ?? "button"}
		{...rest}
	>
		{children}
	</button>
);
