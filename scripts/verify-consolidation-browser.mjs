import { readEnvelope, writeEnvelope } from "./browser-state.mjs";
import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
mkdirSync("output/playwright", { recursive: true });
const origin = process.env.AXIS_SMOKE_URL || "http://localhost:3000";
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [], matrix = [];
page.on("pageerror", error => errors.push(error.message));
const readState = () => readEnvelope(page);
const writeState = saved => writeEnvelope(page,saved);
const clearEngineCache = () => page.evaluate(async () => {
  const db = await new Promise((resolve,reject) => { const q=indexedDB.open("axis-engine",1);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error); });
  try { await new Promise((resolve,reject) => { const tx=db.transaction("evaluations","readwrite");tx.objectStore("evaluations").clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error); }); } finally { db.close(); }
});
const settled = () => page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))); });
const fit = async (route,theme,w,h) => {
  const bounds=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,w:innerWidth,h:innerHeight}));
  matrix.push({route,theme,...bounds});assert.ok(bounds.sw<=w+1,JSON.stringify(matrix.at(-1)));
  if(w>780&&h>620&&route!=="/")assert.ok(bounds.sh<=h+1,JSON.stringify(matrix.at(-1)));
};
const complete = () => page.getByText("Cached review · verification complete",{exact:true}).waitFor({timeout:180000});
try {
  await page.goto(origin+"/games");
  const input=page.getByRole("textbox",{name:"Paste PGN here"});
  assert.ok(await page.getByRole("button",{name:"Import games",exact:true}).isDisabled());
  await input.fill("invalid chess PGN");await page.getByRole("button",{name:"Import games",exact:true}).click();await page.locator(".axis-feedback[role=alert]").waitFor();
  await input.fill(readFileSync(new URL("../tests/fixtures/boden-continuation.pgn",import.meta.url),"utf8"));
  await page.getByRole("button",{name:"Import games",exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.axis-import')?.open);await page.getByRole("link",{name:"Boden study",exact:true}).click();
  await complete();const review=page.url();
  await page.getByText("30 / 30 moves rated",{exact:true}).waitFor();
  assert.equal(await page.locator(".axis-moves button .axis-move-badge").count(),30);
  await page.screenshot({path:"output/playwright/audit-after-review.png"});
  let saved=await readState();const id=saved.state.games[0].id;
  // Simulate a V4.0.0 cache with shallow evidence, not an invented positive rating.
  const old=saved.state.analyses[id];delete old.ratingCoverageVersion;
  old.positionEvals[7].depth=8;old.positionEvals[7].lines[0].depth=8;
  old.moveAssessments[6]={...old.moveAssessments[6],classification:null,confidence:"limited"};
  await writeState(saved);await page.reload();await complete();await page.getByText("30 / 30 moves rated",{exact:true}).waitFor();
  assert.equal((await readState()).state.analyses[id].ratingCoverageVersion,1);
  // A completed-looking cache with missing position evidence must repair itself.
  saved=await readState();saved.state.analyses[id].positionEvals=[];
  await writeState(saved);await page.reload();await page.getByText("Stockfish · reviewing",{exact:true}).waitFor();await complete();
  assert.equal((await readState()).state.analyses[id].positionEvals.length,31);
  // A genuinely bounded/limited result stays visible and offers an explicit retry.
  saved=await readState();saved.state.analyses[id].moveAssessments[6]={...saved.state.analyses[id].moveAssessments[6],classification:null,confidence:"limited"};
  await writeState(saved);await page.reload();await complete();
  await page.locator('[data-rating-state="unrated"]').waitFor();
  await page.getByRole("button",{name:"Retry unrated moves",exact:true}).click();await complete();
  await page.getByText("30 / 30 moves rated",{exact:true}).waitFor();
  console.log("PASS: real 30-ply source continuation, complete rating coverage, older sparse cache upgrade, damaged cache recovery and visible limited-state retry");
  // Same fixture on an engine startup failure: retry must retain the game and recover.
  saved=await readState();saved.state.analyses[id].positionEvals=[];
  await writeState(saved);
  await clearEngineCache();
  await page.route("**/stockfish/manifest.json",route=>route.abort());await page.reload();
  await page.getByText("Analysis failed",{exact:true}).waitFor();await page.getByRole("button",{name:"Retry analysis",exact:true}).waitFor();
  await page.unroute("**/stockfish/manifest.json");await page.getByRole("button",{name:"Retry analysis",exact:true}).click();await complete();
  assert.equal((await readState()).state.games.length,1);
  await clearEngineCache();
  await page.reload();await complete();
  await page.getByRole("button",{name:"Review again",exact:true}).click();
  await page.getByRole("button",{name:"Stop",exact:true}).waitFor();
  await page.getByRole("link",{name:"Home",exact:true}).click();await page.waitForURL(/\/dashboard$/);
  await page.getByRole("heading",{name:"Your next move.",exact:true}).waitFor();
  for(let attempt=0;attempt<50&&page.workers().length;attempt++)await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal(page.workers().length,0,"leaving a live review releases its engine worker");
  await page.goto(review);await complete();
  for(const theme of ["dark","light"]){
    await page.evaluate(theme=>localStorage.setItem("theme",theme),theme);
    const contrast=await page.evaluate(()=>{
      const luminance=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb.reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);};
      return ["brilliant","great","best","excellent","good","book","inaccuracy","mistake","miss","blunder"].map(grade=>{const probe=document.createElement("span");probe.className=`axis-move-badge axis-grade-${grade}`;document.body.append(probe);const style=getComputedStyle(probe),a=luminance(style.color),b=luminance(style.backgroundColor);const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);probe.remove();return{grade,ratio};});
    });
    assert.ok(contrast.every(row=>row.ratio>=4.5),JSON.stringify(contrast));
    for(const [w,h] of [[1920,1080],[1440,900],[1366,768],[390,844],[375,667],[860,500]]){
      await page.setViewportSize({width:w,height:h});
      for(const route of ["/","/dashboard","/games",new URL(review).pathname,"/training","/lessons","/patterns","/masters","/settings"]){
        await page.goto(origin+route);await page.locator("main").waitFor();await settled();await fit(route,theme,w,h);
        if(route === "/masters")assert.ok(await page.locator(".axis-search").evaluate(el => { const input=el.querySelector("input"),icon=el.querySelector("svg");return input.getBoundingClientRect().left+parseFloat(getComputedStyle(input).paddingLeft)>=icon.getBoundingClientRect().right+4; }),"search text clears its icon");
        if(w===1366||w===375)await page.screenshot({path:`output/playwright/audit-after-${theme}-${w}-${route.includes("review")?"review":route.slice(1)||"cover"}.png`});
      }
    }
  }
  await page.setViewportSize({width:1366,height:768});await page.goto(origin+"/settings");
  await page.locator(".axis-settings-actions button[type=submit]").scrollIntoViewIfNeeded();
  await page.locator(".axis-settings-actions button[type=submit]").click();
  const provider=page.getByRole("combobox").last();await provider.click();
  const option=page.getByRole("option").first();await option.waitFor();
  assert.match(await option.evaluate(el=>getComputedStyle(el).fontFamily),/Georgia/);await page.keyboard.press("Escape");
  // Effective layout at 200% zoom: half-sized CSS viewport plus enlarged raster scale.
  const zoom=await browser.newContext({viewport:{width:683,height:384},deviceScaleFactor:2});const zp=await zoom.newPage();await zp.goto(origin+"/settings");await zp.locator("main").waitFor();
  assert.ok(await zp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await zoom.close();
  // Unsupported Worker capability reports a recoverable error rather than a blank board.
  const unsupported=await browser.newContext();await unsupported.addInitScript(()=>Object.defineProperty(window,"Worker",{value:undefined}));const up=await unsupported.newPage();
  await up.goto(origin+"/games");await up.getByRole("textbox",{name:"Paste PGN here"}).fill(readFileSync(new URL("../tests/fixtures/boden-continuation.pgn",import.meta.url),"utf8"));await up.getByRole("button",{name:"Import games",exact:true}).click();await up.waitForFunction(()=>!document.querySelector('.axis-import')?.open);await up.getByRole("link",{name:"Boden study",exact:true}).click();
  await up.getByText("Analysis failed",{exact:true}).waitFor();await up.getByText(/This browser cannot run Stockfish/).first().waitFor();await unsupported.close();
  // Stress fixture: explicitly simulated library rows, with analysis left pending.
  saved=await readState();const original=saved.state.games[0];saved.state.games.push(...Array.from({length:999},(_,index)=>({...original,id:`simulated-library-${index}`,external_id:`simulated-${index}`,opponent_name:`Simulated opponent ${index}`,analysis_status:"pending",accuracy_user:null})));
  await writeState(saved);let start=Date.now();await page.goto(origin+"/games");await page.locator("main").waitFor();await page.getByText(/Simulated opponent/).first().waitFor();const libraryMs=Date.now()-start;
  start=Date.now();await page.goto(origin+"/dashboard");await page.getByRole("heading",{name:"Your next move."}).waitFor();const dashboardMs=Date.now()-start;
  console.log(`PASS: 1000-row simulated library (${libraryMs}ms) and dashboard (${dashboardMs}ms), network recovery, unsupported worker, settings save/menu, 108 theme/viewport route checks and effective 200% zoom layout`);
  assert.deepEqual(errors,[]);writeFileSync("output/playwright/audit-matrix.json",JSON.stringify({matrix,libraryMs,dashboardMs,errors},null,2));
} catch(error){await page.screenshot({path:"output/playwright/audit-failure.png"}).catch(()=>{});throw error;}finally{await browser.close();}
