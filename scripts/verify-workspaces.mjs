import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { checkBoardFocus } from "./check-board-focus.mjs";
mkdirSync("output/playwright", { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ["--no-sandbox"] });
const page = await browser.newPage();
const origin = process.env.AXIS_SMOKE_URL || "http://localhost:3000";
const errors = [], matrix = [];
page.on("pageerror", error => errors.push(error.message));
try {
  // A deliberate service-unavailable fixture verifies recovery without hammering Lichess.
  await page.route("https://lichess.org/api/puzzle/many?*", route => route.fulfill({ status: 429, body: "Rate limited" }));
  for (const theme of ["dark", "light"]) {
    await page.goto(origin + "/dashboard");
    await page.evaluate(theme => localStorage.setItem("theme", theme), theme);
    for (const [width, height] of [[1920,1080],[1440,900],[1366,768],[1280,720],[390,844],[375,667],[683,384]]) {
      await page.setViewportSize({ width, height });
      console.log(`Checking ${theme} ${width}×${height}`);
      for (const route of ["/dashboard","/games","/training","/lessons","/patterns","/patterns/back-rank","/patterns/review","/masters","/settings"]) {
        await page.goto(origin + route);
        await page.locator("main").waitFor();
        await page.locator(".edit-site-header").getByRole("combobox", { name: "Appearance", exact: true, includeHidden: true }).waitFor({ state: "attached" });
        await page.waitForFunction(() => {
          const appearance = document.querySelector('.edit-site-header select[aria-label="Appearance"]');
          return appearance && !appearance.disabled && !document.querySelector(".axis-loading");
        });
        await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))); });
        const box = await page.evaluate(() => {
          const shell = document.querySelector(".axis-content");
          return { w: innerWidth, h: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, content: shell.clientHeight, contentScroll: shell.scrollHeight };
        });
        matrix.push({ route, theme, ...box });
        assert.ok(box.sw <= width + 1, JSON.stringify(matrix.at(-1)));
        if (width > 780 && height > 620) {
          assert.ok(box.sh <= height + 1, JSON.stringify(matrix.at(-1)));
          assert.ok(box.contentScroll <= box.content + 1, JSON.stringify(matrix.at(-1)));
        }
        if (width === 1366 && theme === "dark") await page.screenshot({ path: `output/playwright/overhaul-${route.replaceAll("/", "-")}.png` });
      }
    }
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(origin + "/masters");
  await page.locator(".axis-master-link").first().click();
  await page.locator(".axis-board-root").waitFor();
  await checkBoardFocus(page, "master");
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await page.screenshot({ path: "output/playwright/overhaul-master.png" });
  await page.goto(origin + "/lessons");
  await page.locator(".axis-learning-guide > summary").click();
  await page.getByRole("link", { name: "Recognition & calculation", exact: true }).click();
  await page.waitForURL(/\/patterns$/);
  assert.deepEqual(errors, []);
  console.log(`PASS: ${matrix.length} theme/viewport/route checks including application-content overflow; native/fallback master fullscreen and learning navigation`);
  writeFileSync("output/playwright/overhaul-matrix.json", JSON.stringify(matrix, null, 2));
} catch (error) {
  await page.screenshot({ path: "output/playwright/overhaul-failure.png" }).catch(()=>{});
  throw error;
} finally { await browser.close(); }
