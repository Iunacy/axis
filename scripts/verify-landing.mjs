import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
mkdirSync('output/playwright',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
const page=await browser.newPage();
const origin=process.env.AXIS_SMOKE_URL||'http://localhost:3000';
const matrix=[];const errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 for(const theme of ['dark','light']) for(const locale of ['en','fr']){
  await page.goto(origin+'/');await page.evaluate(({theme,locale})=>{localStorage.setItem('theme',theme);localStorage.setItem('cc:locale',locale);},{theme,locale});
  for(const [width,height] of [[1280,720],[1366,768],[1440,900],[1920,1080]]){
   await page.setViewportSize({width,height});await page.goto(origin+'/');
   const language=page.locator('.edit-site-language select');await language.selectOption(locale);
   await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
   const box=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));
   matrix.push({theme,locale,...box});assert.ok(box.scrollWidth<=width+1,JSON.stringify(matrix.at(-1)));assert.ok(box.scrollHeight<=height+1,JSON.stringify(matrix.at(-1)));
   await page.getByRole('link',{name:locale==='fr'?'Ouvrir mon espace':'Open my journal'}).waitFor();
   const chapter=page.locator('.edit-chapter-strip button').first();await chapter.click();assert.equal(await chapter.getAttribute('aria-pressed'),'true');
   const trigger=page.getByRole('button',{name:locale==='fr'?'Comment fonctionne AXIS':'How AXIS works'});await trigger.click();const dialog=page.getByRole('dialog');await dialog.waitFor();assert.ok(await page.getByRole('heading',{name:locale==='fr'?'Importez vos parties':'Bring your games'}).isVisible());
   await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.ok(await trigger.evaluate(el=>el===document.activeElement));
   if(width===1280)await page.screenshot({path:`output/playwright/release-landing-${theme}-${locale}.png`});
  }
 }
 for(const [width,height] of [[390,844],[640,360],[800,600],[1024,600]]){
  await page.setViewportSize({width,height});await page.goto(origin+'/');await page.locator('.edit-cover-actions').waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.getByRole('link',{name:'Chess Academy',exact:true}).scrollIntoViewIfNeeded();
 }
 assert.deepEqual(errors,[]);writeFileSync('output/playwright/release-landing-matrix.json',JSON.stringify(matrix,null,2));console.log(`PASS: ${matrix.length} desktop theme/locale layouts, chapter controls, method focus restoration, mobile and zoom-equivalent viewports`);
}finally{await browser.close();}
