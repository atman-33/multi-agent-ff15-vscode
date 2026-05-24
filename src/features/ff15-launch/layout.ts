import { existsSync } from "node:fs";
import { join } from "node:path";

const FF15_LAYOUT_PATH_SEGMENTS = [
	"src",
	"features",
	"ff15-launch",
	"assets",
	"ff15-roster.kdl",
] as const;

export const resolveBundledFf15LayoutPath = (extensionRoot: string): string => {
	const layoutPath = join(extensionRoot, ...FF15_LAYOUT_PATH_SEGMENTS);

	if (!existsSync(layoutPath)) {
		throw new Error(`Bundled FF15 layout not found: ${layoutPath}`);
	}

	return layoutPath;
};
