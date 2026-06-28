import type React from "react";
import { cn } from "@/lib/utils";

export interface Ff15SectionHeadingProps {
	/** Optional content rendered on the right (e.g. a status badge). */
	aside?: React.ReactNode;
	className?: string;
	/** Hide the gold menu rule under the heading row. */
	hideDivider?: boolean;
	title: React.ReactNode;
}

/**
 * Gold uppercase section label with an optional right-aligned slot and the
 * FF15 menu rule (gold→cyan→gold line with a center diamond) beneath it.
 */
export const Ff15SectionHeading = ({
	aside,
	className,
	hideDivider = false,
	title,
}: Ff15SectionHeadingProps) => (
	<div className={cn("flex flex-col gap-2", className)}>
		<div className="flex flex-wrap items-center justify-between gap-2">
			<span className="ff15-label">{title}</span>
			{aside ? <div className="shrink-0">{aside}</div> : null}
		</div>
		{hideDivider ? null : <div className="ff15-divider" />}
	</div>
);
