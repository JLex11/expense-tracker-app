import { usePrefs } from "@/hooks/usePrefs";
import { getLocaleTag, translate } from "@/utils/i18n";

export function useI18n() {
	const prefs = usePrefs();
	const language = prefs.language;

	return {
		language,
		locale: getLocaleTag(language),
		t: (key: string, params?: Record<string, string | number>) =>
			translate(language, key, params),
	};
}
