import { useCallback, useMemo } from "react";
import { usePrefsSelector } from "@/hooks/usePrefs";
import { getLocaleTag, translate } from "@/utils/i18n";

export function useI18n() {
	const language = usePrefsSelector((prefs) => prefs.language);
	const locale = useMemo(() => getLocaleTag(language), [language]);
	const t = useCallback(
		(key: string, params?: Record<string, string | number>) =>
			translate(language, key, params),
		[language],
	);

	return useMemo(
		() => ({
			language,
			locale,
			t,
		}),
		[language, locale, t],
	);
}
