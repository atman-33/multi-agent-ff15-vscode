#!/usr/bin/env node
// FF15 runtime bridge.
//
// Single cross-platform entry point invoked as:
//   node bridge.mjs <command> [args...]
//
// It reads the sibling `ff15-bridge-manifest.json` (written per-session by the
// VS Code extension) to obtain the loopback `baseUrl` and auth `token`, issues
// the matching HTTP request, and prints the response body to stdout.
//
// Commands:
//   get-mission   <mission_id>
//   get-workflow  <mission_id>
//   submit-task   <mission_id> <task> [step]
//   submit-report <mission_id> <task_id> <next> <message>

import { readFileSync } from "node:fs";
import { request } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MANIFEST_FILE_NAME = "ff15-bridge-manifest.json";

const scriptDir = dirname(fileURLToPath(import.meta.url));

const loadManifest = () => {
	const manifestPath = join(scriptDir, MANIFEST_FILE_NAME);
	return JSON.parse(readFileSync(manifestPath, "utf8"));
};

const sendRequest = ({ baseUrl, token, method, path, body }) =>
	new Promise((resolve, reject) => {
		const target = new URL(`${baseUrl}${path}`);
		const serialized = body ? JSON.stringify(body) : null;
		const headers = { Authorization: `Bearer ${token}` };
		if (serialized) {
			headers["Content-Type"] = "application/json";
		}

		const req = request(
			{
				headers,
				hostname: target.hostname,
				method,
				path: `${target.pathname}${target.search}`,
				port: target.port,
			},
			(response) => {
				const chunks = [];
				response.on("data", (chunk) => chunks.push(chunk));
				response.on("end", () => {
					resolve(Buffer.concat(chunks).toString("utf8"));
				});
			}
		);
		req.on("error", reject);
		if (serialized) {
			req.write(serialized);
		}
		req.end();
	});

const commands = {
	"get-mission": (args) => ({
		method: "GET",
		path: `/missions/${args[0]}`,
	}),
	"get-workflow": (args) => ({
		method: "GET",
		path: `/workflows/${args[0]}`,
	}),
	"submit-task": (args) => ({
		body: { step: args[2] ?? "", task: args[1] },
		method: "POST",
		path: `/tasks/${args[0]}`,
	}),
	"submit-report": (args) => ({
		body: { message: args[3], next: args[2], taskId: args[1] },
		method: "POST",
		path: `/reports/${args[0]}`,
	}),
};

const main = async () => {
	const [command, ...args] = process.argv.slice(2);
	const resolve = commands[command];
	if (!resolve) {
		process.stderr.write(
			`Unknown bridge command: ${command ?? "(none)"}\n` +
				`Expected one of: ${Object.keys(commands).join(", ")}\n`
		);
		process.exit(1);
	}

	const manifest = loadManifest();
	const { method, path, body } = resolve(args);
	const responseBody = await sendRequest({
		baseUrl: manifest.baseUrl,
		body,
		method,
		path,
		token: manifest.token,
	});
	process.stdout.write(responseBody);
};

main().catch((error) => {
	process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
	process.exit(1);
});
