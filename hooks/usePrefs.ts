import { useCallback, useEffect, useState } from "react";
import * as FileSystem from "expo-file-system";

export type WeekStart = "Sunday" | "Monday";

export interface Prefs {
	name: string;
	email: string;
	currency: string;
	weekStart: WeekStart;
	appLockEnabled: boolean;
}

export const DEFAULT_PREFS: Prefs = {
	name: "Alex",
	email: "alex@example.com",
	currency: "USD",
	weekStart: "Sunday",
	appLockEnabled: false,
};

const listeners = new Set<() => void>();

function getPrefsFile() {
	return new FileSystem.File(FileSystem.Paths.document, "prefs.json");
}

export function loadPrefs(): Prefs {
	try {
		const file = getPrefsFile();
		if (file.exists) {
			return { ...DEFAULT_PREFS, ...JSON.parse(file.textSync()) };
		}
	} catch {}
	return DEFAULT_PREFS;
}

export function savePrefs(prefs: Prefs) {
	try {
		getPrefsFile().write(JSON.stringify(prefs));
		listeners.forEach((listener) => listener());
	} catch (e) {
		console.error("Failed to save prefs", e);
	}
}

export function usePrefs() {
	const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());

	const refresh = useCallback(() => {
		setPrefs(loadPrefs());
	}, []);

	useEffect(() => {
		listeners.add(refresh);
		return () => {
			listeners.delete(refresh);
		};
	}, [refresh]);

	return prefs;
}
