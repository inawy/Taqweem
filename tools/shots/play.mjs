// Google Play phone screenshots (D-176): the real screens of the BUILT app (served by `vite preview`
// on :4174), at a phone size, with realistic data and a fixed clock, so every run gives the same
// pictures. Writes PNGs to ./shots/play and checks Play's rules (each side 320-3840 px, long side at
// most twice the short side, under 8 MB). Not a test: it only prints `[play] ...` lines.
//
// Limit: this is Chromium, not the installed app. Things that only exist in the Android app (the
// reminder field, system bars) are not in these pictures.
import { chromium } from '@playwright/test';
import { mkdirSync, statSync } from 'node:fs';

const BASE = 'http://localhost:4174/';
const OUT = 'shots/play';
mkdirSync(OUT, { recursive: true });

// A Sunday morning in Riyadh: the work week has just started and "now" sits before the first event.
const NOW = new Date('2026-11-22T08:00:00+03:00');
const WELCOME_KEY = 'nawy-today:welcome:v1';

const browser = await chromium.launch();
let failed = false;

async function seed(page) {
  await page.goto(BASE);
  await page.getByRole('button', { name: /Add event|إضافة حدث/ }).waitFor();
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open('nawy-today');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const now = Date.now();
    const cals = [
      ['cal-personal', 'شخصي', 'blue'],
      ['cal-work', 'عمل', 'green'],
      ['cal-family', 'العائلة', 'red'],
    ];
    const pad = (n) => String(n).padStart(2, '0');
    const day = (offset) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    const ev = (id, cal, title, offset, from, to, extra = {}) => ({
      id, calendarId: cal, title, allDay: false, start: `${day(offset)}T${from}`,
      end: `${day(offset)}T${to}`, tzid: 'Asia/Riyadh', createdAt: now, updatedAt: now, ...extra,
    });
    const allDay = (id, cal, title, offset, span = 1) => ({
      id, calendarId: cal, title, allDay: true, start: day(offset), end: day(offset + span),
      createdAt: now, updatedAt: now,
    });
    // No two events overlap in time, so the week grid reads cleanly.
    const events = [
      ev('e1', 'cal-work', 'اجتماع الفريق', 0, '09:00', '10:00'),
      ev('e2', 'cal-personal', 'غداء مع أحمد', 0, '12:30', '13:30', { location: 'مطعم النخيل' }),
      ev('e3', 'cal-family', 'أخذ الأولاد من المدرسة', 0, '15:30', '16:00'),
      ev('e4', 'cal-personal', 'نادي رياضي', 0, '18:30', '19:30'),
      ev('e5', 'cal-work', 'مراجعة المشروع', 1, '10:00', '11:30'),
      ev('e6', 'cal-family', 'اتصال بالأهل', 1, '14:00', '14:30'),
      ev('e7', 'cal-personal', 'موعد الطبيب', 2, '16:00', '17:00', { location: 'العيادة', notes: 'إحضار التحاليل' }),
      ev('e8', 'cal-work', 'عرض تقديمي', 3, '11:00', '12:00'),
      ev('e9', 'cal-family', 'عشاء العائلة', 3, '20:00', '22:00'),
      ev('e10', 'cal-personal', 'قراءة', 4, '17:00', '18:00'),
      ev('e11', 'cal-work', 'ورشة عمل', -1, '09:30', '12:00'),
      ev('e12', 'cal-family', 'زيارة الجدة', 6, '17:00', '19:00'),
      ev('e13', 'cal-work', 'تسليم التقرير', 8, '14:00', '15:00'),
      ev('e14', 'cal-personal', 'سفر', 10, '07:00', '09:00'),
      ev('e15', 'cal-work', 'مراجعة الميزانية', 13, '10:00', '11:00'),
      ev('e16', 'cal-personal', 'نادي رياضي', 15, '18:30', '19:30'),
      ev('e17', 'cal-family', 'غداء العائلة', 19, '13:00', '15:00'),
      allDay('a1', 'cal-family', 'إجازة المدرسة', 2, 3),
      allDay('a2', 'cal-personal', 'عيد ميلاد سارة', 5),
      allDay('a3', 'cal-work', 'مؤتمر', 12, 2),
    ];
    const tx = db.transaction(['calendars', 'events'], 'readwrite');
    for (const [id, name, color] of cals) {
      tx.objectStore('calendars').put({ id, name, color, visible: true, createdAt: now, updatedAt: now });
    }
    for (const e of events) tx.objectStore('events').put(e);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await page.locator('.bar, .agenda-item, .tg-block').first().waitFor();
}

// The web build shows a "storage is not guaranteed" banner and an "ready offline" toast. Neither is
// part of the app a phone user sees in a store picture, so they are dismissed like a user would.
async function calm(page) {
  for (const name of ['فهمت', 'إخفاء']) {
    await page.getByRole('button', { name, exact: true }).click({ timeout: 400 }).catch(() => undefined);
  }
}

const chooseView = async (page, name) => {
  await page.getByRole('button', { name: 'تغيير العرض' }).click();
  await page.getByRole('button', { name, exact: true }).click();
};

function checkPlayRules(file, buffer) {
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  const bytes = statSync(file).size;
  const problems = [];
  if (short < 320 || long > 3840) problems.push('side outside 320-3840');
  if (long > short * 2) problems.push('long side more than twice the short side');
  if (bytes > 8 * 1024 * 1024) problems.push('over 8 MB');
  if (problems.length) failed = true;
  console.log(`[play] ${file} ${width}x${height} ${Math.round(bytes / 1024)}KB ${problems.length ? 'PROBLEM: ' + problems.join('; ') : 'ok'}`);
}

async function session(name, contextOptions, steps) {
  const context = await browser.newContext({
    viewport: { width: 360, height: 700 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
    reducedMotion: 'reduce',
    // Someone who has already seen the first-run card (D-158).
    storageState: { cookies: [], origins: [{ origin: new URL(BASE).origin, localStorage: [{ name: WELCOME_KEY, value: '1' }] }] },
    ...contextOptions,
  });
  await context.clock.install({ time: NOW });
  const page = await context.newPage();
  const shot = async (label) => {
    await page.waitForTimeout(300);
    await calm(page);
    await page.waitForTimeout(200);
    const file = `${OUT}/${label}.png`;
    const buffer = await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' });
    checkPlayRules(file, buffer);
  };
  try {
    await seed(page);
    await page.waitForTimeout(2500); // let the banner and the toast arrive, then dismiss them
    await calm(page);
    await steps(page, shot);
  } catch (error) {
    failed = true;
    console.error(`[play] session ${name} stopped early:`, String(error).slice(0, 500));
  }
  await context.close();
}

await session('light', {}, async (page, shot) => {
  await shot('agenda');
  await page.getByRole('button', { name: /اجتماع الفريق/ }).first().click();
  await shot('card');
  await page.keyboard.press('Escape');
  await chooseView(page, 'شهر');
  await shot('month');
  await chooseView(page, 'أسبوع');
  await shot('week');
  await chooseView(page, '3 أيام');
  await shot('days3');
  await chooseView(page, 'سنة');
  await shot('year');
  await chooseView(page, 'يوم');
  await page.getByRole('button', { name: 'إضافة حدث' }).click();
  await page.locator('input[type="text"], input:not([type])').first().fill('موعد الطبيب');
  await shot('editor');
});

await session('dark', { colorScheme: 'dark' }, async (page, shot) => {
  await shot('agenda-dark');
  await chooseView(page, 'شهر');
  await shot('month-dark');
});

await browser.close();
process.exit(failed ? 1 : 0);
