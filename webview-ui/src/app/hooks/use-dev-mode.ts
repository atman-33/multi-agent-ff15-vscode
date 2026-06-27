import { useEffect, useState } from "react";

export const useDevMode = (command: string) => {
	const [devMode, setDevMode] = useState(false);

	useEffect(() => {
		const listener = (event: MessageEvent) => {
			const payload = event.data;
			if (payload?.command === command) {
				setDevMode(payload.devMode ?? false);
			}
		};

		window.addEventListener("message", listener);

		return () => {
			window.removeEventListener("message", listener);
		};
	}, [command]);

	return devMode;
};
