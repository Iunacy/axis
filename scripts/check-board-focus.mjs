import assert from "node:assert/strict";

export async function checkBoardFocus(page, label) {
  const focus = page.locator(".axis-board-focus").first();
  const board = focus.getByRole("group", { name: "Chessboard", exact: true });
  const opener = focus.getByRole("button", { name: "Fullscreen board", exact: true });
  for (const fallback of [false, true]) {
    // Exercise denied/unsupported browser fullscreen without remounting the task.
    await focus.evaluate((el, fallback) => {
      el.requestFullscreen = fallback ? () => Promise.reject(new Error("Test: fullscreen unavailable")) : Element.prototype.requestFullscreen;
      el.querySelector(".axis-board-root").dataset.mountProbe = "preserved";
    }, fallback);
    const position = await board.innerHTML();
    const normal = await board.boundingBox();
    await opener.click();
    await page.getByRole("dialog", { name: "Fullscreen chessboard", exact: true }).waitFor();
    assert.equal(await focus.locator(".axis-board-root").getAttribute("data-mount-probe"), "preserved");
    assert.equal(await board.innerHTML(), position);
    assert.ok(await page.locator(".edit-site-header").evaluate(el => el.inert));
    assert.ok(await page.evaluate(() => Boolean(document.activeElement?.closest(".is-immersive"))));
    const expanded = await board.boundingBox();
    assert.ok(expanded.width > normal.width, `${label}: board grows (${normal.width} → ${expanded.width})`);
    await page.keyboard.press("Tab");
    assert.ok(await page.evaluate(() => Boolean(document.activeElement?.closest(".is-immersive"))));
    if (label === "training") {
      assert.ok(await focus.getByRole("button", { name: "Show solution", exact: true }).isVisible());
      assert.ok(await focus.getByRole("button", { name: "Hint 1/2", exact: true }).isVisible());
    }
    await page.screenshot({ path: `output/playwright/overhaul-${label}-${fallback ? "fallback" : "fullscreen"}.png` });
    await page.keyboard.press("Escape");
    await page.locator(".is-immersive").waitFor({ state: "hidden" });
    assert.equal(await board.innerHTML(), position);
    assert.ok(await opener.evaluate(el => el === document.activeElement));
    assert.equal(await page.locator(".edit-site-header").evaluate(el => el.inert), false);
  }
}
