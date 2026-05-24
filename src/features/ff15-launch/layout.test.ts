import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveBundledFf15LayoutPath } from "./layout";

describe("resolveBundledFf15LayoutPath", () => {
	it("resolves the bundled roster layout beneath the extension root", () => {
		expect(resolveBundledFf15LayoutPath(process.cwd())).toBe(
			join(
				process.cwd(),
				"src",
				"features",
				"ff15-launch",
				"assets",
				"ff15-roster.kdl"
			)
		);
	});

	it("bundles the fixed four-agent layout template", () => {
		const layoutPath = resolveBundledFf15LayoutPath(process.cwd());
		const contents = readFileSync(layoutPath, "utf8");

		expect(contents).toContain('split_direction="vertical"');
		expect(contents).toContain('split_direction="horizontal"');
		expect(contents).toContain('args "--agent" "noctis"');
		expect(contents).toContain('args "--agent" "ignis"');
		expect(contents).toContain('args "--agent" "gladiolus"');
		expect(contents).toContain('args "--agent" "prompto"');
	});
});
