import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { readEnvelope } from './browser-state.mjs';

// Simulated customer tasks, each in an independent browser profile. These are
// regression evidence, not a claim of research with twenty real participants.
const origin = process.env.AXIS_SMOKE_URL || 'http://localhost:3000';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox'] });
const results = [];
mkdirSync('output/playwright', { recursive: true });
const pgn = (opponent = 'Customer opponent') => `[Event "Customer review"]\n[White "Customer"]\n[Black "${opponent}"]\n[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1`;
async function go(page, route) { await page.goto(origin + route); await page.locator('main').waitFor(); }
async function imported(page, text = pgn()) {
  await go(page, '/games');
  const details = page.locator('.axis-import');
  if (await details.getAttribute('open') === null) await details.locator('summary').click();
  await page.getByRole('textbox', { name: 'Paste PGN here' }).fill(text);
  await page.getByRole('button', { name: 'Import games', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.axis-import')?.open);
}
async function noOverflow(page) { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'horizontal overflow'); }
async function customer(name, task, check, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...options });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await check(page);
    assert.deepEqual(errors, []);
    results.push({ customer: results.length + 1, name, task, result: 'passed' });
    console.log(`PASS customer ${results.length}: ${name} — ${task}`);
  } catch (error) {
    await page.screenshot({ path: 'output/playwright/customer-journey-failure.png' }).catch(() => {});
    throw new Error(`${name}: ${error.message}`, { cause: error });
  } finally { await context.close(); }
}
try {
  await customer('First-time desktop visitor', 'Find the journal and independent Academy at 1280 × 720', async page => {
    await go(page, '/');
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))); });
    for (const name of ['Open my journal', 'Chess Academy']) {
      const box = await page.getByRole('link', { name, exact: true }).boundingBox();
      assert.ok(box && box.y >= 0 && box.y + box.height <= 720);
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1));
    await page.screenshot({ path: 'output/playwright/customer-desktop-cover.png' });
  });
  await customer('Mobile commuter', 'Navigate to settings and close the compact menu with Escape', async page => {
    await go(page, '/dashboard'); const menu = page.getByRole('button', { name: 'Menu', exact: true });
    await menu.click(); await page.getByRole('link', { name: 'Settings', exact: true }).waitFor();
    await page.keyboard.press('Escape'); assert.equal(await menu.getAttribute('aria-expanded'), 'false');
    assert.ok(await menu.evaluate(e => e === document.activeElement));
    await menu.click(); await page.getByRole('link', { name: 'Settings', exact: true }).click(); await noOverflow(page);
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await customer('Keyboard-only visitor', 'Skip repeated navigation and return focus after a method dialog', async page => {
    await go(page, '/'); await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').textContent(), 'Skip to content');
    await page.keyboard.press('Enter'); assert.equal(await page.locator(':focus').getAttribute('id'), 'main-content');
    const trigger = page.getByRole('button', { name: 'How AXIS works' }); await trigger.focus(); await page.keyboard.press('Enter');
    await page.getByRole('dialog').waitFor(); await page.keyboard.press('Escape');
    assert.ok(await trigger.evaluate(e => e === document.activeElement));
  });
  await customer('Reader at 200% zoom', 'Reach settings, lessons and pattern choices without horizontal scrolling', async page => {
    for (const route of ['/settings', '/academy', '/patterns', '/games']) { await go(page, route); await noOverflow(page); }
  }, { viewport: { width: 640, height: 360 } });
  await customer('French-speaking learner', 'Use translated panel controls and see the English lesson disclosure', async page => {
    await go(page, '/academy'); await page.locator('.edit-site-language select').selectOption('fr');
    await page.getByText(/Les nouvelles leçons sont en anglais/).waitFor();
    await go(page, '/training'); await page.getByRole('button', { name: 'Entraînement personnalisé', exact: true }).click();
    await page.getByRole('button', { name: 'Fermer le panneau', exact: true }).click(); await page.getByRole('dialog').first().waitFor({ state: 'hidden' });
  });
  await customer('Motion-sensitive visitor', 'Read a stable landing page under reduced-motion preference', async page => {
    await go(page, '/'); assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
    const durations = await page.locator('.edit-cover h1, .edit-intro, .edit-cover-plate').evaluateAll(elements => elements.map(e => getComputedStyle(e).animationDuration));
    assert.equal(durations.length, 3);
    assert.ok(durations.every(value => value.split(',').every(part => parseFloat(part) <= .01)));
  }, { reducedMotion: 'reduce' });
  await customer('Privacy-conscious player', 'Cancel destructive clearing and retain imported games', async page => {
    await imported(page); await go(page, '/settings'); await page.getByRole('button', { name: 'Clear all local data', exact: true }).click();
    await page.getByRole('alertdialog').waitFor(); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.reload(); assert.equal((await readEnvelope(page)).state.games.length, 1);
  });
  await customer('Player changing profile settings', 'Save near the account fields and retain names after reload', async page => {
    await go(page, '/settings'); await page.getByLabel('Chess.com username', { exact: true }).fill('NextPlayer');
    const save = page.locator('.axis-settings-actions').getByRole('button', { name: 'Save', exact: true });
    const box = await save.boundingBox(); assert.ok(box && box.y + box.height <= 720);
    await save.click(); await page.locator('.axis-settings-actions [role="status"]').waitFor(); await page.reload();
    await page.getByLabel('Chess.com username', { exact: true }).waitFor(); assert.equal(await page.getByLabel('Chess.com username', { exact: true }).inputValue(), 'NextPlayer');
    await page.screenshot({ path: 'output/playwright/customer-settings-save.png' });
  });
  await customer('Player without an online account', 'Receive a persistent actionable sync error', async page => {
    await go(page, '/games'); await page.getByRole('button', { name: 'Sync games', exact: true }).click();
    await page.locator('.axis-sync-control [role="status"]').waitFor();
    assert.match(await page.locator('.axis-sync-control [role="status"]').textContent(), /username|Settings|settings/i);
    assert.ok(await page.getByRole('button', { name: 'Sync games', exact: true }).isEnabled());
  });
  await customer('PGN file owner', 'Upload a completed PGN file and retain it after an immediate reload', async page => {
    await go(page, '/games'); await page.locator('input[type="file"]').setInputFiles({ name: 'customer.pgn', mimeType: 'application/x-chess-pgn', buffer: Buffer.from(pgn()) });
    await page.getByRole('button', { name: 'Import games', exact: true }).click(); await page.waitForFunction(() => !document.querySelector('.axis-import')?.open);
    await page.reload(); await page.getByRole('link', { name: 'Customer opponent', exact: true }).waitFor();
  });
  await customer('Player choosing the wrong file', 'Reject an invalid replacement file without importing the prior draft', async page => {
    await go(page, '/games'); await page.getByRole('textbox', { name: 'Paste PGN here' }).fill(pgn());
    await page.locator('input[type="file"]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('notes') });
    await page.locator('.axis-import [role="alert"]').waitFor();
    assert.equal(await page.getByRole('textbox', { name: 'Paste PGN here' }).inputValue(), '');
    assert.ok(await page.getByRole('button', { name: 'Import games', exact: true }).isDisabled());
  });
  await customer('Black-side player', 'Keep the selected side, opponent and result when pasting PGN', async page => {
    await go(page, '/games'); await page.getByRole('textbox', { name: 'Paste PGN here' }).fill(pgn()); await page.locator('.axis-import select').selectOption('b');
    await page.getByRole('button', { name: 'Import games', exact: true }).click(); await page.waitForFunction(() => !document.querySelector('.axis-import')?.open);
    const game = (await readEnvelope(page)).state.games[0]; assert.equal(game.user_color, 'b'); assert.equal(game.result, 'win'); assert.equal(game.opponent_name, 'Customer');
  });
  await customer('Returning PGN importer', 'Import the same game twice without duplicate records', async page => {
    await imported(page); await imported(page); assert.equal((await readEnvelope(page)).state.games.length, 1);
  });
  await customer('Club archivist', 'Browse more than twenty games and reset a zero-result filter', async page => {
    await imported(page, Array.from({ length: 25 }, (_, i) => pgn(`Club opponent ${i}`)).join('\n\n'));
    assert.equal(await page.locator('.axis-table tbody tr').count(), 20);
    await page.locator('.axis-pagination').getByRole('button', { name: 'Next', exact: true }).click(); assert.equal(await page.locator('.axis-table tbody tr').count(), 5);
    await page.locator('.axis-search input').fill('no-such-customer'); assert.equal(await page.locator('.axis-table tbody tr').count(), 0);
    await page.getByRole('button', { name: 'Reset filters', exact: true }).click(); assert.equal(await page.locator('.axis-table tbody tr').count(), 20);
  });
  await customer('Learner who answers incorrectly', 'Read text feedback, identify the correct answer and retry a quiz', async page => {
    for (const theme of ['dark', 'light']) {
      await go(page, '/academy/recognizing-mating-nets');
      await page.evaluate(theme => localStorage.setItem('theme', theme), theme); await page.reload();
      const choice = page.getByRole('button', { name: 'The attacker has fewer pawns', exact: true });
      assert.ok((await choice.boundingBox()).height >= 44);
      await choice.click(); await page.getByRole('status').filter({ hasText: 'Not quite.' }).waitFor();
      assert.ok(await page.getByRole('button', { name: /Correct answer/ }).isDisabled());
      const contrasts = await page.locator('.axis-quiz-answer.is-correct, .axis-quiz-answer.is-wrong').evaluateAll(elements => {
        const luminance = value => {
          const channels = value.match(/[\d.]+/g).slice(0, 3).map(Number).map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
          return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
        };
        return elements.map(element => {
          const style = getComputedStyle(element); const a = luminance(style.color); const b = luminance(style.backgroundColor);
          return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        });
      });
      assert.equal(contrasts.length, 2); assert.ok(contrasts.every(value => value >= 4.5), `${theme}: ${contrasts}`);
      const retry = page.getByRole('button', { name: 'Retry question', exact: true }); assert.ok((await retry.boundingBox()).height >= 44);
      await retry.click(); assert.ok(await page.getByRole('button', { name: 'The attacker has fewer pawns', exact: true }).isEnabled());
    }
  });
  await customer('Returning Academy student', 'Record study and restore it after reloading the lesson', async page => {
    await go(page, '/academy/recognizing-mating-nets'); await page.getByRole('button', { name: 'Mark as completed', exact: true }).click();
    await page.waitForFunction(async () => { const db = await new Promise(resolve => { const q=indexedDB.open('axis');q.onsuccess=()=>resolve(q.result); }); try { return await new Promise(resolve => { const q=db.transaction('state').objectStore('state').get('cc:store');q.onsuccess=()=>resolve(JSON.parse(q.result).state.academyCompleted.includes('recognizing-mating-nets')); }); } finally { db.close(); } });
    await page.reload(); await page.getByRole('button', { name: /Completed/ }).waitFor();
  });
  await customer('Sequential course reader', 'Find previous and next lessons and a practice destination after the final lesson', async page => {
    await go(page, '/academy'); const links = await page.locator('.axis-academy-index h2').evaluateAll(elements => elements.map(e => e.closest('a').getAttribute('href')));
    await go(page, links[1]); await page.getByRole('link', { name: /Previous lesson:/ }).waitFor(); await page.getByRole('link', { name: /Next lesson:/ }).waitFor();
    await go(page, links.at(-1)); await page.getByRole('link', { name: 'Continue to practice', exact: true }).waitFor();
    await go(page, '/academy/does-not-exist'); await page.getByRole('heading', { name: 'Lesson not found' }).waitFor(); await page.getByRole('link', { name: '← Chess Academy', exact: true }).click();
  });
  await customer('Pattern specialist', 'Find ten pattern paths, ten exercises and an explanatory guide', async page => {
    await go(page, '/patterns'); assert.equal(await page.locator('.edit-pattern-row').count(), 10); assert.equal(await page.locator('.edit-pattern-number').last().textContent(), '10');
    await page.locator('.edit-pattern-row').first().click(); await page.locator('.edit-pattern-stages button').last().waitFor(); assert.equal(await page.locator('.edit-pattern-stages button').count(), 10);
    await page.locator('.axis-pattern-guide summary').click(); await page.getByRole('heading', { name: 'Piece coordination and escape squares' }).waitFor();
    await page.locator('.edit-pattern-stages button').last().click(); assert.equal(await page.locator('.edit-pattern-stages button').last().getAttribute('aria-pressed'), 'true');
  });
  await customer('Independent practice student', 'Start curated practice and avoid unsupported personal recommendations', async page => {
    await go(page, '/training'); await page.getByRole('button', { name: 'Start verified practice', exact: true }).click(); await page.locator('.axis-training-stage').waitFor();
    await page.getByRole('button', { name: 'Personalized training', exact: true }).click(); await page.getByText(/No weakness has been established/).waitFor(); await page.keyboard.press('Escape');
    const state = (await readEnvelope(page)).state; assert.ok(state.trainingSession.remainingIds.every(id => id.startsWith('lichess:')));
    await page.reload(); await page.locator('.axis-training-stage').waitFor();
  });
  await customer('Master-game student', 'Search a curated game and identify the public import platform accessibly', async page => {
    await go(page, '/masters'); await page.getByRole('combobox', { name: 'Chess platform', exact: true }).waitFor();
    await page.locator('.axis-search input').fill('Immortal Game'); assert.ok(await page.locator('.axis-catalog li').count());
    await page.locator('.axis-catalog a').first().click(); await page.locator('.axis-board-root').waitFor(); await noOverflow(page);
    assert.equal((await readEnvelope(page))?.state.games?.length ?? 0, 0);
  });
  assert.equal(results.length, 20);
  writeFileSync('output/playwright/customer-journeys.json', JSON.stringify({ method: 'Twenty simulated task walkthroughs in isolated browser profiles; no human research participants.', origin, results }, null, 2));
  console.log('PASS: all 20 simulated customer journeys');
} finally { await browser.close(); }
