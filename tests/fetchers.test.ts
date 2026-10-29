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

test("Lichess historical imports cross 200 games in bounded overlapping pages", async () => {
  const { fetchLichessGames } = await import('../src/lib/fetchers/lichess');
  const original = globalThis.fetch;
  const dataset = Array.from({length:251},(_,i)=>({ id:String(i),variant:'standard',createdAt:Date.now()-i*1000,speed:'rapid',status:'mate',rated:true,winner:'white',players:{white:{user:{name:'player'}},black:{user:{name:'opponent'}}},pgn:'[White "player"]\n[Black "opponent"]\n1. e4 e5 1-0' }));
  const urls: URL[]=[];
  globalThis.fetch = (async input => {
    const url=new URL(String(input));urls.push(url);
    const until=Number(url.searchParams.get('until'));
    return new Response(dataset.filter(game=>game.createdAt<=until).slice(0,100).map(game=>JSON.stringify(game)).join('\n'));
  }) as typeof fetch;
  try {
    const games=await fetchLichessGames('player');
    assert.equal(games.length,251);assert.equal(new Set(games.map(game=>game.id)).size,251);
    assert.equal(urls.length,3);assert.ok(urls.every(url=>url.searchParams.get('max')==='100'));
  } finally {globalThis.fetch=original;}
});

test("cancelled imports stop before another page and long rate limits preserve retry boundaries", async () => {
  const { importRequest } = await import('../src/lib/fetchers/request');
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=(async()=>{calls++;return new Response('',{status:429,headers:{'Retry-After':'120'}});}) as typeof fetch;
  try {
    await assert.rejects(importRequest('https://lichess.org'),{code:'syncRateLimit'});
    assert.equal(calls,1);
    const controller=new AbortController();controller.abort();
    await assert.rejects(importRequest('https://lichess.org',{signal:controller.signal}));assert.equal(calls,1);
  }finally{globalThis.fetch=original;}
});
