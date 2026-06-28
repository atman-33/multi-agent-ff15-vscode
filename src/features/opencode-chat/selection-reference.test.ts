import { describe, expect, it } from "vitest";
import { formatSelectionReference } from "./selection-reference";

describe("formatSelectionReference", () => {
	it("formats a cursor-only selection as path:line", () => {
		const result = formatSelectionReference("src/index.ts", {
			start: { line: 11, character: 4 },
			end: { line: 11, character: 4 },
			isEmpty: true,
		} as never);

		expect(result).toBe("src/index.ts:12");
	});

	it("formats a single-line selection as path:line:startCol-endCol", () => {
		const result = formatSelectionReference("src/index.ts", {
			start: { line: 11, character: 4 },
			end: { line: 11, character: 20 },
			isEmpty: false,
		} as never);

		expect(result).toBe("src/index.ts:12:5-21");
	});

	it("formats a multi-line selection as path:startLine:startCol-endLine:endCol", () => {
		const result = formatSelectionReference("src/index.ts", {
			start: { line: 11, character: 4 },
			end: { line: 15, character: 20 },
			isEmpty: false,
		} as never);

		expect(result).toBe("src/index.ts:12:5-16:21");
	});
});
