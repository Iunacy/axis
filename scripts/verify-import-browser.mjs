import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readEnvelope} from './browser-state.mjs';
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900}});const origin=process.env.AXIS_SMOKE_URL||'http://localhost:3000';const errors=[];
page.on('pageerror',error=>errors.push(error.message));
const base=Date.parse('2026-10-28T12:00:00Z');
const pgn=(name,index)=>`[White "${name}"]\n[Black "Opponent ${index}"]\n[Result "1/2-1/2"]\n\n1. e4 e5 2. Nf3 Nc6 1/2-1/2`;
await page.route('https://api.chess.com/pub/player/**',async route=>{
 const url=new URL(route.request().url());const name=url.pathname.split('/')[3];
 if(name==='missing')return route.fulfill({status:404,body:''});
 const count=name==='newchess'?127:251;
 if(url.pathname.endsWith('/archives'))return route.fulfill({json:{archives:[`https://api.chess.com/pub/player/${name}/games/2026/09`,`https://api.chess.com/pub/player/${name}/games/2026/10`]}});
 const october=url.pathname.endsWith('/10');
 const games=Array.from({length:count},(_,i)=>({uuid:`${name}-${i}`,url:`https://www.chess.com/game/live/${name}-${i}`,pgn:pgn(name,i),end_time:(base-i*1000)/1000,rated:true,rules:'chess',time_class:'rapid',time_control:'600',white:{username:name,rating:1400,result:'agreed'},black:{username:`Opponent ${i}`,rating:1400,result:'agreed'}})).filter((_,i)=>october?i<120:i>=120);
 return route.fulfill({json:{games}});
});
await page.route('https://lichess.org/api/games/user/**',async route=>{
 const url=new URL(route.request().url());const name=url.pathname.split('/').at(-1);const until=Number(url.searchParams.get('until'));const since=Number(url.searchParams.get('since'));
 const count=name==='newlichess'?123:251;
 const games=Array.from({length:count},(_,i)=>({id:`${name}-${i}`,rated:true,variant:'standard',speed:'rapid',createdAt:base-i*1000,status:'draw',players:{white:{user:{name},rating:1500},black:{user:{name:`Opponent ${i}`},rating:1500}},pgn:pgn(name,i)})).filter(g=>g.createdAt<=until&&g.createdAt>=since).slice(0,Number(url.searchParams.get('max')));
 await route.fulfill({body:games.map(game=>JSON.stringify(game)).join('\n'),contentType:'application/x-ndjson'});
});
async function settings(chess,lichess){await page.goto(origin+'/settings');await page.getByRole('textbox',{name:'Chess.com username',exact:true}).fill(chess);await page.getByRole('textbox',{name:'Lichess username',exact:true}).fill(lichess);await page.locator('.axis-settings-actions button[type=submit]').click();await page.getByText('Saved',{exact:true}).waitFor();}
async function sync(){await page.goto(origin+'/games');await page.getByRole('button',{name:'Sync games',exact:true}).click();await page.getByRole('button',{name:'Cancel import',exact:true}).waitFor({state:'hidden',timeout:60000});}
try{
 await page.goto(origin+'/games');await page.getByRole('textbox',{name:'Paste PGN here'}).fill('[Black "Manual study"]\n\n1. e4 e5 1/2-1/2');await page.getByRole('button',{name:'Import games',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.axis-import')?.open);
 await settings('oldchess','oldlichess');await sync();let state=(await readEnvelope(page)).state;
 assert.equal(state.games.length,503);assert.ok(state.games.every(game=>game.analysis_status==='pending'));assert.deepEqual(state.analyses,{});
 assert.equal(await page.locator('.axis-table tbody tr').count(),20);
 await sync();assert.equal((await readEnvelope(page)).state.games.length,503,'incremental sync cannot duplicate games');
 await settings('missing','oldlichess');await sync();assert.equal((await readEnvelope(page)).state.games.length,503,'failed account must preserve old games');
 await settings('newchess','oldlichess');await sync();state=(await readEnvelope(page)).state;
 assert.equal(state.games.filter(g=>g.platform==='chesscom').length,127);assert.ok(state.games.filter(g=>g.platform==='chesscom').every(g=>g.pgn.includes('[White "newchess"]')));
 assert.equal(state.games.filter(g=>g.platform==='lichess').length,251);assert.equal(state.games.filter(g=>g.platform==='pgn').length,1);
 await settings('newchess','newlichess');await sync();await page.reload();state=(await readEnvelope(page)).state;
 assert.equal(state.games.length,251);assert.equal(state.games.filter(g=>g.platform==='lichess').length,123);assert.ok(state.games.filter(g=>g.platform==='lichess').every(g=>g.pgn.includes('[White "newlichess"]')));
 assert.ok(!state.syncAccounts['chesscom:oldchess']);assert.ok(!state.syncAccounts['lichess:oldlichess']);
 await page.screenshot({path:'output/playwright/release-account-import.png'});assert.deepEqual(errors,[]);
 console.log('PASS: 502 online games imported in bounded pages, analysis remains separate, incremental deduplication, 20-row pagination, failed replacement safety, both platform account switches and reload');
}catch(error){await page.screenshot({path:'output/playwright/release-import-failure.png'}).catch(()=>{});throw error;}finally{await browser.close();}
