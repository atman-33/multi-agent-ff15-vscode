export interface ProjectProfile {
	id: string;
	warnings: string[];
}

export type ProjectsSnapshot =
	| {
			status: "ready";
			sourceKind: "ff15";
			sourcePath: string;
			activeProjects: string[];
			profiles: ProjectProfile[];
			languageName: "en" | "ja";
			openspec: {
				path: string | null;
				sourceProjectId: string | null;
			};
			error: null;
	  }
	| {
			status: "error";
			sourceKind: "ff15" | null;
			sourcePath: string | null;
			activeProjects: string[];
			profiles: [];
			languageName: null;
			openspec: {
				path: null;
				sourceProjectId: null;
			};
			error: string;
	  };

export interface ProjectsDraft {
	activeProjects: string[];
	languageName: "en" | "ja";
	openspec: {
		projectId: string | null;
	};
}

export type SaveState = "conflict" | "error" | "idle" | "saved" | "saving";

export const EMPTY_SNAPSHOT: ProjectsSnapshot = {
	activeProjects: [],
	error: "Waiting for Projects context...",
	openspec: {
		path: null,
		sourceProjectId: null,
	},
	profiles: [],
	languageName: null,
	sourceKind: null,
	sourcePath: null,
	status: "error",
};

export const EMPTY_DRAFT: ProjectsDraft = {
	activeProjects: [],
	languageName: "en",
	openspec: {
		projectId: null,
	},
};

export const formatSourceKind = (
	sourceKind: ProjectsSnapshot["sourceKind"]
) => {
	if (sourceKind === "ff15") {
		return ".ff15";
	}

	return "-";
};

export const buildDraftFromSnapshot = (
	snapshot: ProjectsSnapshot,
	previousDraft: ProjectsDraft
): ProjectsDraft => {
	if (snapshot.status !== "ready") {
		return previousDraft;
	}

	return {
		activeProjects: snapshot.activeProjects,
		languageName: snapshot.languageName,
		openspec: {
			projectId: snapshot.openspec.sourceProjectId,
		},
	};
};

// FF15 palette tones so the status line stays readable on the dark mission
// backdrop regardless of the active VSCode theme.
export const getSaveStateColor = (state: SaveState) => {
	switch (state) {
		case "error":
			return "text-[color:#fca5a5]";
		case "conflict":
			return "text-[color:#fcd34d]";
		case "saved":
			return "text-[color:#6ee7b7]";
		case "saving":
			return "text-[color:var(--ff15-cyan)]";
		default:
			return "text-[color:var(--ff15-text-muted)]";
	}
};
