export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
).replace(/\/$/, "");

export const site = {
  name: "AXIS",
  title: "AXIS — Analyze. Understand. Improve.",
  tagline: "Analyze. Understand. Improve.",
  description:
    "Import your Chess.com and Lichess games, analyze them with Stockfish right in your browser, and get personalized chess lessons and puzzles built from your own mistakes. Free, private, no account.",
  url: siteUrl,
  locale: "en_US",

  github: "https://github.com/Iunacy/axis",
  keywords: [
    "AXIS chess",
    "chess training",
    "chess lessons",
    "chess puzzles",
    "Stockfish analysis",
    "Chess.com analyzer",
    "Lichess analyzer",
    "blunder detection",
    "chess improvement",
    "game analysis",
    "personalized chess training",
    "free chess analysis",
  ],
} as const;
