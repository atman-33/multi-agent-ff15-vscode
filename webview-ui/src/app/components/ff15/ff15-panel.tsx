import type React from "react";
import { cn } from "@/lib/utils";

export interface Ff15PanelProps extends React.HTMLAttributes<HTMLDivElement> {
	children: React.ReactNode;
}

/**
 * Translucent, blurred FF15 card with a gold top hairline (see `.ff15-panel`
 * in app.css). Use as the chrome for every panel on the mission screens so
 * they share one surface treatment.
 */
export const Ff15Panel = ({ children, className, ...rest }: Ff15PanelProps) => (
	<div className={cn("ff15-panel", className)} {...rest}>
		{children}
	</div>
);
