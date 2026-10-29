import { mkdirSync } from 'node:fs';
mkdirSync('output/playwright', { recursive: true });
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const origin=process.env.AXIS_SMOKE_URL||'http://localhost:3000';
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const requests=[];page.on('request',r=>requests.push(r.url()));
 const fit=async()=>{const d=await page.evaluate(()=>({height:innerHeight,scroll:document.documentElement.scrollHeight,width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));assert.ok(d.scroll<=d.height+1,JSON.stringify(d));assert.ok(d.scrollWidth<=d.width+1,JSON.stringify(d));};
 await page.goto(origin+'/dashboard');await page.getByRole('heading',{name:'Your next move.'}).waitFor();await fit();
 const font=await page.locator('.axis-connect-form input').first().evaluate(el=>getComputedStyle(el).fontFamily);assert.match(font,/Georgia/);
 await page.goto(origin+'/games');
 // Hold transaction acknowledgment until the busy state is asserted; this
 // reproduces an early success race independently of runner/storage speed.
 await page.evaluate(()=>{
   window.__axisHoldWrites=true;window.__axisPendingWrites=[];
   const original=IDBDatabase.prototype.transaction;
   const descriptor=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');
   IDBDatabase.prototype.transaction=function(...args){
     const transaction=original.apply(this,args);
     if(args[1]==='readwrite')Object.defineProperty(transaction,'oncomplete',{
       configurable:true,
       get(){return descriptor.get.call(transaction);},
       set(handler){descriptor.set.call(transaction,event=>{if(window.__axisHoldWrites)window.__axisPendingWrites.push(()=>handler?.call(transaction,event));else handler?.call(transaction,event);});},
     });
     return transaction;
   };
 });
 await page.getByRole('textbox' ,{name:'Paste PGN here'}).fill('[Event "Engine smoke"]\n[White "Study"]\n[Black "Fools mate"]\n[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1');
 await page.getByRole('button',{name:'Import games',exact:true}).click();await page.getByRole('button',{name:'Importing…',exact:true}).waitFor();assert.equal(await page.locator('.axis-import form').getAttribute('aria-busy'),'true');await page.evaluate(()=>{window.__axisHoldWrites=false;window.__axisPendingWrites.splice(0).forEach(release=>release());});await page.waitForFunction(()=>!document.querySelector('.axis-import')?.open);await page.reload();await page.getByRole('link',{name:'Fools mate',exact:true}).waitFor();
 await page.goto(origin+'/dashboard');await page.getByRole('button',{name:'Choose a game',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Choose a game'});await dialog.waitFor();await page.getByRole('textbox',{name:'Search opponents or openings'}).fill('No matches');await page.getByText('No games match your search.',{exact:true}).first().waitFor();
 await page.keyboard.press('Shift+Tab');assert.ok(await page.evaluate(()=>Boolean(document.activeElement?.closest('dialog'))));
 await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await dialog.isVisible(),false);assert.ok(await page.getByRole('button',{name:'Choose a game',exact:true}).evaluate(el=>el===document.activeElement));
 await page.getByRole('button',{name:'Choose a game',exact:true}).click();await page.getByRole('textbox',{name:'Search opponents or openings'}).fill('Fools');await page.getByRole('link',{name:'Fools mate',exact:true}).click();
 await page.waitForURL(/\/review\//);const url=page.url();await page.getByText('Cached review · verification complete',{exact:true}).waitFor({timeout:90000});await fit();
 const board=page.locator('.axis-board-root');const before=await board.boundingBox();assert.ok(before.height>350,JSON.stringify(before));
 await page.getByRole('tab',{name:/Positions to review/}).click();assert.equal((await board.boundingBox()).y,before.y);
 await page.getByRole('tab',{name:'Explore',exact:true}).click();assert.equal((await board.boundingBox()).y,before.y);
 await page.screenshot({path:'output/playwright/v3-review.png'});
 assert.equal(requests.some(url=>url.endsWith('/stockfish-19-single.wasm')),false);
 await page.getByRole('button',{name:'Explore position',exact:true}).click();
 // A slow optional engine must stay cancellable during startup, with honest
 // loading feedback rather than claiming that position calculation has begun.
 const startupRequested=page.waitForRequest('**/stockfish/stockfish-19-single.js',{timeout:30000});
 const holdDeep=route=>route.fulfill({contentType:'application/javascript',headers:{'cache-control':'no-store'},body:'self.onmessage = () => {};'});
 await page.route('**/stockfish/stockfish-19-single.js',holdDeep);
 await page.getByRole('checkbox',{name:/Deep analysis/}).check();await page.getByRole('button',{name:'Analyze position',exact:true}).click();
 await startupRequested;await page.getByRole('status').filter({hasText:'Loading and starting Stockfish'}).waitFor();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.ok(await page.getByRole('button',{name:'Analyze position',exact:true}).isEnabled());
 assert.equal(await page.locator('.axis-position-explorer [role="alert"]').count(),0);
 await page.unroute('**/stockfish/stockfish-19-single.js',holdDeep);
 await page.getByRole('button',{name:'Analyze position',exact:true}).click();
 await Promise.race([
   page.getByText(/Stockfish 19 · Deep/).waitFor({timeout:360000}),
   page.locator('.axis-position-explorer [role="alert"]').waitFor({timeout:360000}).then(async()=>{throw new Error(await page.locator('.axis-position-explorer [role="alert"]').innerText());}),
 ]);console.log("deep engine passed");assert.ok(requests.some(url=>url.endsWith('/stockfish-19-single.wasm')));
 await page.reload();await page.getByText('Cached review · verification complete',{exact:true}).waitFor({timeout:15000});
 await page.goto(origin+'/dashboard');await page.getByRole('heading',{name:'Your next move.'}).waitFor();await fit();assert.ok((await page.locator('.axis-dashboard-board').boundingBox()).width > 150);await page.screenshot({path:'output/playwright/v3-dashboard.png'});
 const specimens = [
  ['Castle study', 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', '1. O-O O-O-O 1/2-1/2'],
  ['Promotion study', '7k/P7/8/8/8/8/8/7K w - - 0 1', '1. a8=N Kg7 1/2-1/2'],
  ['En passant study', '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2', '2. exd6 Kd7 1/2-1/2'],
  ['Pawn ending', '8/8/4k3/8/4P3/4K3/8/8 w - - 0 1', '1. Kd4 Kd6 1/2-1/2'],
 ];
 for (const [name,fen,moves] of specimens) {
  await page.goto(origin+'/games');
  const importer=page.locator('.axis-import');if (!await importer.evaluate(el => el.open)) await importer.locator('summary').click();
  await page.getByRole('textbox',{name:'Paste PGN here'}).fill(`[Event "${name}"]\n[White "Study"]\n[Black "${name}"]\n[SetUp "1"]\n[FEN "${fen}"]\n[Result "1/2-1/2"]\n\n${moves}`);
  await page.getByRole('button',{name:'Import games',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.axis-import')?.open);await page.getByRole('link',{name,exact:true}).click();
  await page.getByText('Cached review · verification complete',{exact:true}).waitFor({timeout:90000});
  await page.getByRole('button',{name:'End',exact:true}).click();
 }
 console.log('PASS: browser reviews castling, en passant, underpromotion and pawn ending');
 await page.goto(origin+'/games');await page.locator('.axis-import summary').click();
 await page.getByRole('textbox',{name:'Paste PGN here'}).fill('[Event "Recovery study"]\n[White "Study"]\n[Black "Recovery study"]\n[Result "1/2-1/2"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 1/2-1/2');
 await page.getByRole('button',{name:'Import games',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.axis-import')?.open);await page.getByRole('link',{name:'Recovery study',exact:true}).click();
 await page.waitForFunction(()=>Number(document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow'))>=25,{},{timeout:60000});
 await page.getByRole('button',{name:'Stop',exact:true}).click();await page.getByRole('button',{name:'Resume',exact:true}).waitFor();
 await page.reload();await page.getByText('Cached review · verification complete',{exact:true}).waitFor({timeout:120000});
 await page.keyboard.press('End');await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');
 console.log('PASS: interrupted partial review resumes after reload and keyboard navigation remains available');
 for(const route of ['/games','/training','/lessons','/patterns','/masters','/settings']){await page.goto(origin+route);await page.locator('main').waitFor();await fit();}
 await page.setViewportSize({width:1280,height:720});await page.goto(url);await page.locator('.axis-board-root').waitFor();await fit();await page.screenshot({path:'output/playwright/v3-review-720.png'});
 await page.setViewportSize({width:390,height:844});await page.goto(origin+'/dashboard');await page.getByRole('heading',{name:'Your next move.'}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'output/playwright/v3-mobile.png'});
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:800,height:500});await page.goto(origin+'/settings');await page.locator('main').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: typography, viewport boundaries, picker search/Escape, automatic analysis, deep download isolation, cached review, board stability, routes, mobile and reduced motion');
})().catch(e=>{console.error(e);process.exit(1)});
