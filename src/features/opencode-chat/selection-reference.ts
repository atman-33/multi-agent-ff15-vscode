import type { Selection } from "vscode";

export const formatSelectionReference = (
	relativePath: string,
	selection: Selection
): string => {
	if (selection.isEmpty) {
		return `${relativePath}:${selection.start.line + 1}`;
	}

	if (selection.start.line === selection.end.line) {
		return `${relativePath}:${selection.start.line + 1}:${selection.start.character + 1}-${selection.end.character + 1}`;
	}

	return `${relativePath}:${selection.start.line + 1}:${selection.start.character + 1}-${selection.end.line + 1}:${selection.end.character + 1}`;
};
