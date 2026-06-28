import type React from "react";
import { cn } from "@/lib/utils";

export type Ff15BadgeTone = "active" | "sending" | "error" | "gold" | "neutral";

const TONE_CLASSES: Record<Ff15BadgeTone, string> = {
	active: "border-emerald-400/35 bg-emerald-400/12 text-emerald-200",
	sending: "border-amber-300/40 bg-amber-300/12 text-amber-100",
	error:
		"border-[color:rgba(248,113,113,0.4)] bg-[color:rgba(248,113,113,0.12)] text-[color:#fca5a5]",
	gold: "border-[color:var(--ff15-gold-soft)] bg-[color:var(--ff15-gold-faint)] text-[color:var(--ff15-gold)]",
	neutral:
		"border-[color:var(--ff15-border-soft)] bg-[color:rgba(143,156,224,0.08)] text-[color:var(--ff15-text-muted)]",
};

export interface Ff15BadgeProps {
	children: React.ReactNode;
	className?: string;
	/** Pill (rounded-full) by default; set to false for a rounded rectangle. */
	pill?: boolean;
	tone?: Ff15BadgeTone;
}

/** Status badge in the FF15 palette, shared across the mission screens. */
export const Ff15Badge = ({
	children,
	className,
	pill = true,
	tone = "neutral",
}: Ff15BadgeProps) => (
	<span
		className={cn(
			"inline-flex w-fit items-center border px-2 py-0.5 font-medium text-[10px] uppercase tracking-[0.12em]",
			pill ? "rounded-full" : "rounded-md",
			TONE_CLASSES[tone],
			className
		)}
	>
		{children}
	</span>
);
