import type { Locale } from "./index";


interface LangRule {
  locale: Locale;
  subtags: string[];
  timezones: string[];
}

const DEFAULT_LOCALE: Locale = "en";

const RULES: LangRule[] = [
  {
    locale: "fr",
    subtags: ["fr"],
    timezones: [
      "Europe/Paris",
      "Europe/Monaco",
      "Africa/Dakar",
      "Africa/Abidjan",
      "Africa/Bamako",
      "Africa/Ouagadougou",
      "Africa/Niamey",
      "Africa/Lome",
      "Africa/Porto-Novo",
      "Africa/Conakry",
      "Africa/Nouakchott",
      "Africa/Douala",
      "Africa/Libreville",
      "Africa/Bangui",
      "Africa/Brazzaville",
      "Africa/Kinshasa",
      "Africa/Lubumbashi",
      "Africa/Ndjamena",
      "Africa/Kigali",
      "Africa/Bujumbura",
      "Africa/Djibouti",
      "Indian/Antananarivo",
      "Indian/Comoro",
    ],
  },
];

export function detectLocale(): Locale {
  if (typeof navigator !== "undefined") {
    const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const tag of tags) {
      if (!tag) continue;
      const subtag = tag.toLowerCase().split("-")[0];
      const rule = RULES.find((r) => r.subtags.includes(subtag));
      if (rule) return rule.locale;
    }
  }

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      const rule = RULES.find((r) => r.timezones.includes(tz));
      if (rule) return rule.locale;
    }
  } catch {
  }

  return DEFAULT_LOCALE;
}
