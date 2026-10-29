import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {ACADEMY,academyForSkill} from '../src/lib/academy';
import {PATTERNS} from '../src/lib/pattern-catalog';
import {fetchCuratedPatterns} from '../src/lib/lichess-puzzles';
import {preparePuzzle} from '../src/lib/puzzle-solution';
import {explainCuratedPuzzle} from '../src/lib/puzzle-explanation';
import {patternTeaching} from '../src/lib/pattern-teaching';

test('the independent academy covers ten subject areas with substantive teaching, legal interactive examples and knowledge checks',()=>{
 assert.equal(ACADEMY.length,10);assert.equal(new Set(ACADEMY.map(l=>l.area)).size,10);
 for(const lesson of ACADEMY){
  const text=lesson.content.sections.filter(s=>s.type==='text');assert.equal(text.length,3);assert.ok(text.reduce((n,s)=>n+s.body.length,0)>800,lesson.id);
  const boards=lesson.content.sections.filter(s=>s.type==='board');assert.ok(boards.length);
  for(const board of boards){const c=new Chess(board.fen);assert.equal(c.turn(),board.orientation);for(const san of board.answerLine??[])assert.ok(c.move(san));assert.equal(board.answerSan?.[0],board.answerLine?.[0]);}
  const quizzes=lesson.content.sections.filter(s=>s.type==='quiz');assert.ok(quizzes.length);for(const quiz of quizzes)for(const question of quiz.questions){assert.ok(question.choices[question.answerIdx]);assert.ok(question.explain.length>30);}
 }
 assert.ok(academyForSkill('king-safety').length);
});

test('ten pattern paths each have ten distinct real source positions and legal mating lines offline',async()=>{
 const rows=await fetchCuratedPatterns();assert.equal(PATTERNS.length,10);assert.equal(rows.length,100);
 assert.equal(new Set(rows.map(p=>p.fen.split(' ').slice(0,4).join(' '))).size,100);
 for(const pattern of PATTERNS){assert.equal(pattern.ids.length,10);assert.ok(patternTeaching(pattern.id).failed.length>70);}
 for(const row of rows){assert.equal(row.source,'lichess');assert.equal(row.license,'CC0-1.0');const line=preparePuzzle(row)!;const c=new Chess(row.fen);for(const uci of line.lines[0].uci)c.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});assert.ok(c.isCheckmate(),row.id);assert.match(explainCuratedPuzzle(row),/checked by/);}
});

test('a legal source-tagged mate with ambiguous geometry is rejected from a pattern path',async()=>{
 const {matchesMateGeometry}=await import('../src/lib/pattern-geometry');
 const position=new Chess('3R4/2r2pr1/6kR/p1p2pP1/1p2nP2/1P6/1PP3K1/8 b - - 0 1');
 assert.equal(position.isCheckmate(),true);
 assert.equal(matchesMateGeometry(position,'epaulette'),false,'Lichess oKocR lacks the required opposing own-piece shoulder blockers');
});
