// Drives the app inside the emulator through its WebView (Chrome DevTools protocol), the way a
// person would: make an event two minutes ahead with a reminder, then wait for the phone to ring.
import { chromium } from '@playwright/test';
import { execSync } from 'node:child_process';

const out = process.argv[2] ?? 'emulator-out';
const log = (...a) => console.log('[e2e]', ...a);

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0]?.pages()[0];
if (!page) throw new Error('no WebView page found');
page.on('pageerror', (e) => log('page error:', e.message));
page.on('console', (m) => log('console', m.type(), m.text()));
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(3000);
log('native?', await page.evaluate(() => ({
  cap: window.Capacitor?.isNativePlatform?.(),
  bridge: window.androidBridge !== undefined,
  lang: navigator.language,
})));

// Dismiss the welcome card if it is there.
const start = page.locator('.banner button', { hasText: /Get started|ابدأ/ });
if (await start.count()) await start.first().click();

await page.locator('.fab').click();
const dialog = page.locator('.modal').first();
await dialog.locator('.ed-title').fill('Emulator test');
const soon = await page.evaluate(() => {
  const d = new Date(Date.now() + 2 * 60_000);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
});
log('event time (device clock):', soon);
await dialog.locator('input[type=time]').first().fill(soon);
const select = dialog.locator('select').filter({ has: page.locator('option[value="1440"]') });
log('reminder select present:', await select.count());
await select.selectOption('0');
await page.screenshot({ path: `${out}/editor.png` }).catch(() => {});
await dialog.locator('button[type=submit]').click();
await page.waitForTimeout(3000);
await page.screenshot({ path: `${out}/after-save.png` }).catch(() => {});

const banner = await page.locator('.banner').allTextContents();
log('banners after save:', JSON.stringify(banner));

// Ask the app's own diagnostics.
await page.locator('button', { hasText: /^(Settings|الإعدادات)$/ }).first().click();
await page.locator('button', { hasText: /Check now|افحص الآن/ }).click();
await page.waitForTimeout(2000);
log('diagnostics:', JSON.stringify(await page.locator('.reminder-diag-list li').allTextContents()));
await page.keyboard.press('Escape');

log('waiting for the reminder to ring…');
await page.waitForTimeout(150_000);
execSync('adb shell cmd statusbar expand-notifications');
await page.waitForTimeout(2000);
execSync(`adb exec-out screencap -p > ${out}/shade.png`);
await browser.close();
