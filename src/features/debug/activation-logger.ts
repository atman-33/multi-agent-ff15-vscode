import { appendFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { ExtensionMode, type ExtensionContext } from "vscode";

export interface ActivationDebugLogger {
	/** Absolute path to the log file, or null when logging is disabled. */
	readonly filePath: string | null;
	/** Log an informational checkpoint. */
	log: (message: string) => void;
	/** Log an error with its stack trace. */
	logError: (label: string, err: unknown) => void;
}

const NOOP_LOGGER: ActivationDebugLogger = {
	filePath: null,
	log: () => {
		// logging disabled outside development mode
	},
	logError: () => {
		// logging disabled outside development mode
	},
};

/**
 * Creates a logger that appends activation diagnostics to a file. Logging is
 * only enabled while running under the Extension Development Host (F5 / local
 * debug). In installed builds this returns a no-op logger so nothing is written.
 *
 * The log file is written to `<extension folder>/ff15-debug.log`, i.e. the root
 * of the extension project during local debugging, so it is easy to find.
 */
export const createActivationDebugLogger = (
	context: ExtensionContext
): ActivationDebugLogger => {
	if (context.extensionMode !== ExtensionMode.Development) {
		return NOOP_LOGGER;
	}

	const filePath = join(context.extensionUri.fsPath, "ff15-debug.log");

	const write = (line: string) => {
		try {
			appendFileSync(filePath, `${new Date().toISOString()} ${line}\n`);
		} catch {
			// Never let logging failures break activation.
		}
	};

	try {
		mkdirSync(dirname(filePath), { recursive: true });
	} catch {
		// Directory already exists or cannot be created; writes will no-op.
	}

	write("");
	write(`=== Activation started (pid=${process.pid}) ===`);

	return {
		filePath,
		log: (message: string) => write(`[INFO]  ${message}`),
		logError: (label: string, err: unknown) => {
			const error = err instanceof Error ? err : new Error(String(err));
			write(`[ERROR] ${label}: ${error.message}`);
			if (error.stack) {
				write(error.stack);
			}
		},
	};
};
