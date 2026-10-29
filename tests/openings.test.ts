import { test } from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import reference from "../src/lib/data/openings.json";
import { completeOpeningReference, parseOpeningTsv, openingPositionKey } from "../src/lib/opening-import";
import { identifyOpening, isBookMove, lookupOpeningPosition } from "../src/lib/opening-book";

test("the full opening reference retains all verified variations across 500 ECO codes", () => {
  assert.equal(reference.source.license, "CC0-1.0");
  assert.equal(reference.rows.length, 3865);
  assert.equal(new Set(reference.rows.map(row => row[0])).size, 500);
  for (const [, , moves] of reference.rows as [string, string, string[]][]) {
    const chess = new Chess();
    for (const move of moves) assert.ok(chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] }));
  }
});

test("opening import validates schema and retains reproducible complete coverage without inventing book moves", () => {
  const rows = parseOpeningTsv("eco\tname\tpgn\nB00\tKing Pawn\t1. e4\nB00\tLonger line\t1. e4 e5");
  assert.equal(completeOpeningReference(rows).length, 2);
  assert.deepEqual(completeOpeningReference([...rows].reverse()), completeOpeningReference(rows));
  assert.throws(() => parseOpeningTsv("eco\tname\tpgn\nZ99\tInvalid\t1. e4"));
  assert.throws(() => parseOpeningTsv("eco\tname\tpgn\nB00\tIllegal\t1. e5"));
  assert.equal(identifyOpening(new Chess().fen(), ["e2e4", "c7c5"])?.eco, "B20");
  assert.equal(isBookMove("7k/P7/8/8/8/8/8/7K w - - 0 1", ["e2e4"]), false);
  assert.equal(isBookMove(new Chess().fen(), ["e2e4", "e7e5", "d1h5", "b8c6", "h5e5"]), false);
});

function after(sans: string[]) { const chess = new Chess(); for (const san of sans) chess.move(san); return chess; }

test("transposed positions expose the same source-supported continuations and identities", () => {
  const first = after(["d4", "Nf6", "c4", "e6", "Nf3", "d5", "g3"]);
  const second = after(["Nf3", "d5", "d4", "Nf6", "c4", "e6", "g3"]);
  assert.equal(openingPositionKey(first.fen()), openingPositionKey(second.fen()));
  assert.deepEqual(lookupOpeningPosition(first.fen()), lookupOpeningPosition(second.fen()));
  assert.ok(lookupOpeningPosition(first.fen()).continuations.includes("f8e7"));
  for (const chess of [first, second]) assert.ok(isBookMove(new Chess().fen(), [...chess.history({verbose:true}).map(m=>m.lan), "f8e7"]));
});

test("deep named variations stay in the book; off-book legal moves are not invented", () => {
  const row = [...reference.rows as [string,string,string[]][]].sort((a,b)=>b[2].length-a[2].length)[0];
  assert.ok(row[2].length > 30);
  assert.ok(isBookMove(new Chess().fen(), row[2]));
  assert.ok(identifyOpening(new Chess().fen(), row[2]));
  const opening = lookupOpeningPosition(new Chess().fen());
  assert.ok(opening.continuations.length > 10);
  const chess = after(["e4", "e5", "Qh5", "Nc6", "Qxe5+"]);
  assert.equal(isBookMove(new Chess().fen(), chess.history({verbose:true}).map(m=>m.lan)), false);
});

test("position keys ignore clocks and irrelevant en passant, but retain turn and castling rights", () => {
  const chess = after(["e4"]);
  const fen = chess.fen();
  assert.equal(openingPositionKey(fen), openingPositionKey(fen.replace(/0 1$/, "23 45")));
  assert.equal(openingPositionKey(fen), openingPositionKey(fen.replace(" - ", " e3 ")));
  assert.notEqual(openingPositionKey(fen), openingPositionKey(fen.replace("KQkq", "-")));
  assert.notEqual(openingPositionKey(fen), openingPositionKey(fen.replace(" b ", " w ")));
  assert.deepEqual(lookupOpeningPosition("invalid").continuations, []);
});

test("eight named reference PGNs retain every documented continuation and final identity", async () => {
  const fixtures = (await import('./fixtures/common-openings.json')).default;
  assert.equal(fixtures.length,8);
  for (const fixture of fixtures) {
    const chess=new Chess();chess.loadPgn(fixture.pgn);
    const moves=chess.history({verbose:true}).map(move=>move.lan);
    for(let index=1;index<=moves.length;index++) assert.equal(isBookMove(new Chess().fen(),moves.slice(0,index)),true,`${fixture.family} ply ${index}`);
    assert.ok(lookupOpeningPosition(chess.fen()).openings.some(opening=>opening.eco===fixture.eco&&opening.name===fixture.name),fixture.family);
  }
});

test("real game PGNs from all eight families replay legally and recognize their documented opening moves", async()=>{
  const fixtures=(await import('./fixtures/opening-games.json')).default;
  assert.equal(fixtures.length,8);
  for(const fixture of fixtures){
    const chess=new Chess();chess.loadPgn(fixture.pgn,{strict:true});
    assert.ok(chess.history().length>fixture.referencePrefix.length,fixture.family);
    assert.ok(chess.getHeaders().White&&chess.getHeaders().Black);
    assert.match(fixture.source,/^https:\/\//);
    const moves=chess.history({verbose:true}).map(move=>move.lan);
    for(let ply=1;ply<=fixture.referencePrefix.length;ply++)assert.equal(isBookMove(new Chess().fen(),moves.slice(0,ply)),true,`${fixture.family}: documented move ${ply}`);
  }
});

test("the published London supplement fills the accelerated move-order gap with explicit provenance",()=>{
  const chess=after(['d4','d5','Bf4']);
  const position=lookupOpeningPosition(chess.fen());
  assert.ok(position.continuations.includes('g8f6'));
  assert.ok(position.references.some(source=>source.url==='https://www.chess.com/openings/London-System'));
  chess.move('Nf6');assert.ok(lookupOpeningPosition(chess.fen()).continuations.includes('e2e3'));
  assert.equal(isBookMove(new Chess().fen(),['d2d4','d7d5','c1f4','g8f6','e2e3']),true);
});
