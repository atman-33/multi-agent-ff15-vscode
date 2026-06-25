import type React from "react";
import { cn } from "@/lib/utils";
import { getWebviewAssetUri } from "@/lib/webview-asset";

const BACKGROUND_URI = getWebviewAssetUri(
	"images/backgrounds/background-1.jpg"
);

export interface Ff15ScreenProps {
	/**
	 * Renders the full-bleed background image and darkening overlay. Disable
	 * for sidebar views (e.g. the missions list) that sit alongside the plain
	 * projects/settings views, where the photo backdrop would feel out of place.
	 */
	background?: boolean;
	children: React.ReactNode;
	className?: string;
	/** Class names applied to the scrollable content layer. */
	contentClassName?: string;
}

/**
 * Full-bleed FF15 backdrop for the mission screens. Optionally renders the
 * shared background image plus a darkening gradient overlay, then layers the
 * page content above it. The `.ff15-screen` scope switches on the fixed dark
 * Final Fantasy XV palette (see app.css) regardless of the background image.
 */
export const Ff15Screen = ({
	background = true,
	children,
	className,
	contentClassName,
}: Ff15ScreenProps) => (
	<div
		className={cn(
			"ff15-screen relative h-full overflow-hidden",
			background ? null : "ff15-screen--bare",
			className
		)}
	>
		{background ? (
			<>
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 bg-center bg-cover"
					style={{ backgroundImage: `url('${BACKGROUND_URI}')` }}
				/>
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0"
					style={{
						background:
							"linear-gradient(180deg, rgba(5,7,13,0.92) 0%, rgba(6,9,16,0.78) 38%, rgba(5,7,13,0.9) 100%)",
					}}
				/>
			</>
		) : null}
		<div className={cn("relative h-full overflow-y-auto", contentClassName)}>
			{children}
		</div>
	</div>
);
