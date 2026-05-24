import type React from "react";

export type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
	className?: string;
	style?: React.CSSProperties;
	"aria-label"?: string;
	children: React.ReactNode;
};

export const IconButton = ({
	className,
	style,
	type,
	children,
	...rest
}: IconButtonProps) => (
	<button
		className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded-full ${className ?? ""}`}
		style={{
			backgroundColor:
				"color-mix(in srgb, var(--vscode-foreground) 50%, transparent)",
			color: "var(--vscode-sideBar-background)",
			...(style ?? {}),
		}}
		type={type ?? "button"}
		{...rest}
	>
		{children}
	</button>
);
