import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args: ["--no-sandbox"],
});
const origin = process.env.AXIS_SMOKE_URL || "http://localhost:3000";
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const settle = () => page.evaluate(async () => {
  await Promise.all(document.getAnimations()
    .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
    .map(animation => animation.finished.catch(() => {})));
});
async function checkRule(selector) {
  await settle();
  await page.waitForFunction(selector => {
    const nav = document.querySelector(selector);
    const target = nav?.querySelector('[aria-current="page"]')?.getBoundingClientRect();
    const rule = nav?.querySelector(".axis-nav-indicator")?.getBoundingClientRect();
    return target && rule && Math.abs(target.left - rule.left) < 1 && Math.abs(target.width - rule.width) < 1;
  }, selector);
  const alignment = await page.locator(selector).evaluate(nav => {
    const target = nav.querySelector('[aria-current="page"]').getBoundingClientRect();
    const rule = nav.querySelector(".axis-nav-indicator").getBoundingClientRect();
    return { x: Math.abs(target.left - rule.left), width: Math.abs(target.width - rule.width) };
  });
  assert.ok(alignment.x < 1 && alignment.width < 1, JSON.stringify(alignment));
}

try {
  // Avoid external puzzle requests in an interaction-only check.
  await page.route("https://lichess.org/api/puzzle/many?*", route => route.fulfill({ status: 429, body: "Rate limited" }));
  await page.goto(origin + "/dashboard");
  await page.locator('.edit-site-navigation nav[data-motion-ready="true"]').waitFor();
  const primary = page.locator(".edit-site-navigation nav");
  for (const label of ["My Games", "Learn", "Train", "Home"]) {
    const link = primary.getByRole("link", { name: label, exact: true });
    const href = await link.getAttribute("href");
    await link.click();
    await page.waitForURL(origin + href);
    await checkRule(".edit-site-navigation nav");
  }
  await primary.getByRole("link", { name: "Learn", exact: true }).click();
  await page.waitForURL(origin + "/academy");
  await page.locator(".axis-learn-navigation").getByRole("link", { name: "Patterns", exact: true }).click();
  await page.waitForURL(origin + "/patterns");
  await checkRule(".axis-learn-navigation");
  // Locale changes and viewport changes must not leave the rule at stale coordinates.
  await page.locator('.edit-site-header select[aria-label="Language"]').selectOption("fr");
  await checkRule(".edit-site-navigation nav");
  await page.locator('.edit-site-header select[aria-label="Langue"]').selectOption("en");
  await page.setViewportSize({ width: 375, height: 667 });
  await checkRule(".edit-site-navigation nav");
  await checkRule(".axis-learn-navigation");

  for (const reducedMotion of ["no-preference", "reduce"]) {
    await page.emulateMedia({ reducedMotion });
    for (const [route, openerName, drawer] of [
      ["/", "How AXIS works", false],
      ["/training", "Personalized training", true],
    ]) {
      await page.goto(origin + route);
      const opener = page.getByRole("button", { name: openerName, exact: true });
      const dialog = page.getByRole("dialog", { name: openerName, exact: true });
      for (let repeat = 0; repeat < 3; repeat++) {
        await opener.click();
        await dialog.waitFor();
        assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true);
        await settle();
        await page.keyboard.press("Tab");
        assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true);
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
        assert.equal(await opener.evaluate(element => element === document.activeElement), true);
      }
      // Interrupt entrance, then reopen: no stale exit may close the new dialog.
      await opener.click();
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      await opener.click();
      await settle();
      assert.equal(await dialog.evaluate(element => element.open), true);
      if (reducedMotion === "reduce") {
        assert.equal(await dialog.evaluate(element => element.getAnimations().some(animation => animation.playState === "running")), false);
        assert.equal(await dialog.evaluate(element => getComputedStyle(element, "::backdrop").animationName), "none");
      }
      if (drawer && reducedMotion === "no-preference") {
        mkdirSync("output/playwright", { recursive: true });
        await page.screenshot({ path: "output/playwright/motion-drawer-mobile.png" });
      }
      await dialog.getByRole("button", { name: "Close panel" }).click();
      await dialog.waitFor({ state: "hidden" });
    }
  }
  assert.deepEqual(errors, []);
  console.log("PASS: navigation alignment, locale/resize, modal and drawer repetition, interrupted entrance, focus containment/restoration, Escape and reduced motion");
} finally {
  await browser.close();
}
