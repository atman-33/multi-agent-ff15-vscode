import { spawnSync } from "node:child_process";

export const ensureCommandAvailable = (command: string): Promise<void> => {
	const result = spawnSync(command, ["--version"], {
		shell: process.platform === "win32",
		stdio: "ignore",
	});

	if (result.error || result.status !== 0) {
		return Promise.reject(new Error(`Command unavailable: ${command}`));
	}

	return Promise.resolve();
};
