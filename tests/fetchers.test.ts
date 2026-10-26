import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchChesscomGames } from "../src/lib/fetchers/chesscom";

test("Chess.com sync imports completed games and skips old archives on repeat sync", async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  const root = "https://api.chess.com/pub/player/lris_m/games";
  const sample = { url: "https://www.chess.com/game/live/1", pgn: '[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1', time_control: "600", end_time: Date.parse("2026-10-26T10:00:00Z") / 1000, rated: true, uuid: "one", time_class: "rapid", rules: "chess", white: { username: "lris_m", rating: 900, result: "checkmated" }, black: { username: "opponent", rating: 910, result: "win" } };
  globalThis.fetch = (async input => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/archives")) return Response.json({ archives: [`${root}/2026/09`, `${root}/2026/10`] });
    return Response.json({ games: [sample, { ...sample, uuid: "live", pgn: '[Result "*"]\n\n1. e4 *' }, { ...sample, uuid: "old", end_time: sample.end_time - 86400 }] });
  }) as typeof fetch;
  try {
    const games = await fetchChesscomGames("lris_m", 200, sample.end_time * 1000);
    assert.equal(games.length, 1);
    assert.equal(games[0].id, "chesscom:one");
    assert.equal(games[0].result, "loss");
    assert.equal(games[0].user_color, "w");
    assert.deepEqual(calls, [`${root}/archives`, `${root}/2026/10`]);
  } finally { globalThis.fetch = original; }
});

test("Chess.com failures report missing usernames and rate limits", async () => {
  const original = globalThis.fetch;
  try {
    for (const [status, code] of [[404, "syncUserNotFound"], [429, "syncRateLimit"], [503, "network"]] as const) {
      globalThis.fetch = (async () => new Response(null, { status })) as typeof fetch;
      await assert.rejects(fetchChesscomGames("missing"), error => error instanceof Error && error.message === code);
    }
    globalThis.fetch = (async () => { throw new TypeError("Failed to fetch"); }) as typeof fetch;
    await assert.rejects(fetchChesscomGames("offline"), TypeError);
  } finally { globalThis.fetch = original; }
});
