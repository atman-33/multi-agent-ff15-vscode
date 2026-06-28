import type React from "react";

export interface PillButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	className?: string;
	style?: React.CSSProperties;
	children: React.ReactNode;
}

export const PillButton = ({
	className,
	style,
	type,
	children,
	...rest
}: PillButtonProps) => (
	<button
		className={[
			"inline-flex select-none items-center gap-1 rounded-full border-[1px] px-3 py-1.5 text-xs transition-colors",
			"hover:bg-[color:var(--vscode-list-hoverBackground)]",
			"cursor-pointer focus-visible:outline-none focus-visible:ring-1",
			className ?? "",
		].join(" ")}
		style={{
			borderColor:
				"color-mix(in srgb, var(--vscode-foreground) 10%, transparent)",
			color: "var(--vscode-textLink-foreground)",
			...(style ?? {}),
		}}
		type={type ?? "button"}
		{...rest}
	>
		{children}
	</button>
);
