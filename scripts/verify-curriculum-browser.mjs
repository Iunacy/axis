import { mkdirSync,readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readEnvelope } from './browser-state.mjs';
import { checkBoardFocus } from './check-board-focus.mjs';
mkdirSync('output/playwright',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const origin=process.env.AXIS_SMOKE_URL||'http://localhost:3000';const errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(origin+'/academy');await page.getByRole('heading',{name:'Chess Academy',exact:true}).waitFor();assert.equal(await page.locator('.axis-academy-index li').count(),10);
 await page.getByRole('link',{name:'Read a mating net by its escape squares',exact:true}).click();
 await page.getByRole('heading',{name:'Guided board example',exact:true}).waitFor();
 await checkBoardFocus(page,'lesson');
 await page.locator('.axis-lesson-board-task').getByRole('button',{name:'e1',exact:true}).click();
 await page.locator('.axis-lesson-board-task').getByRole('button',{name:'e8',exact:true}).click();
 await page.getByText(/Re8 checks the king/).waitFor();
 await page.getByRole('button',{name:'A safe legal escape square remains',exact:true}).click();
 await page.getByText(/Any legal king escape means/).waitFor();
 await page.getByRole('button',{name:'Mark as completed',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:/Completed/}).waitFor();
 assert.ok((await readEnvelope(page)).state.academyCompleted.includes('recognizing-mating-nets'));
 await page.goto(origin+'/training');await page.getByRole('button',{name:'Start verified practice',exact:true}).click();await page.locator('.axis-training-stage').waitFor();
 await checkBoardFocus(page,'training');
 const saved=await readEnvelope(page);const session=saved.state.trainingSession;
 assert.ok(session.remainingIds.length>0);assert.ok(session.remainingIds.every(id=>id.startsWith('lichess:')));
 const puzzle=saved.state.puzzles.find(p=>p.id===session.active.puzzleId);assert.equal(puzzle.source,'lichess');
 const uci=puzzle.solution_lines_uci[0][0];
 const from=page.locator('.axis-training-stage .axis-board-root').getByRole('button',{name:uci.slice(0,2)});await from.click();
 await page.locator('.axis-training-stage .axis-board-root').getByRole('button',{name:uci.slice(2,4)}).click();
 await page.reload();await page.locator('.axis-training-stage').waitFor();assert.equal((await readEnvelope(page)).state.trainingSession.active.puzzleId,puzzle.id);
 await page.getByRole('button',{name:'Personalized training',exact:true}).click();await page.getByText(/No weakness has been established/).waitFor();await page.keyboard.press('Escape');
 await page.screenshot({path:'output/playwright/release-curated-training.png'});
 // Real reviewed game produces recommendations, never an automatic personal puzzle.
 await page.goto(origin+'/games');await page.getByRole('textbox',{name:'Paste PGN here'}).fill(readFileSync(new URL('../tests/fixtures/boden-continuation.pgn',import.meta.url),'utf8'));
 await page.getByRole('button',{name:'Import games',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.axis-import')?.open);await page.getByRole('link',{name:'Boden study',exact:true}).click();await page.getByText('Cached review · verification complete',{exact:true}).waitFor({timeout:180000});
 const after=await readEnvelope(page);assert.ok(after.state.puzzles.every(p=>p.source==='lichess'),'analysis must not insert personal-game puzzles');
 await page.goto(origin+'/training');await page.getByRole('button',{name:'Personalized training',exact:true}).click();
 await page.getByRole('dialog').getByText('See the evidence',{exact:true}).first().waitFor();assert.ok(await page.getByRole('dialog').locator('a[href^="/academy/"]').count());
 await page.keyboard.press('Escape');
 for(const [width,height] of [[1280,720],[390,844]]){await page.setViewportSize({width,height});await page.goto(origin+'/academy');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 assert.deepEqual(errors,[]);console.log('PASS: standalone academy, legal interactive example, quiz, persisted study, curated-only session, fullscreen, reload, real engine evidence and lesson recommendations');
}catch(error){await page.screenshot({path:'output/playwright/release-learning-failure.png'}).catch(()=>{});throw error;}finally{await browser.close();}
