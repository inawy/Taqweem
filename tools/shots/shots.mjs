// Takes screenshots of the BUILT app (served by `vite preview` on :4174) with realistic data, so a
// design review can look at the real screens. Not a test: it only writes PNGs to ./shots.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:4174/';
const OUT = 'shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

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
    const events = [
      ev('e1', 'cal-work', 'اجتماع الفريق', 0, '09:00', '10:00'),
      ev('e2', 'cal-personal', 'غداء مع أحمد', 0, '13:00', '14:30', { location: 'مطعم النخيل' }),
      ev('e3', 'cal-family', 'أخذ الأولاد من المدرسة', 0, '15:30', '16:00'),
      ev('e4', 'cal-personal', 'نادي رياضي', 0, '18:30', '19:30'),
      ev('e5', 'cal-work', 'مراجعة المشروع', 1, '10:00', '11:30'),
      ev('e6', 'cal-work', 'مكالمة العميل', 1, '10:30', '11:00'),
      ev('e7', 'cal-personal', 'موعد الطبيب', 2, '16:00', '17:00', { notes: 'إحضار التحاليل' }),
      ev('e8', 'cal-family', 'عشاء العائلة', 3, '20:00', '22:00'),
      ev('e9', 'cal-work', 'عرض تقديمي', 4, '11:00', '12:00'),
      ev('e10', 'cal-personal', 'قراءة', -1, '21:00', '22:00'),
      ev('e11', 'cal-work', 'ورشة عمل', -2, '09:30', '12:00'),
      ev('e12', 'cal-family', 'زيارة الجدة', 6, '17:00', '19:00'),
      ev('e13', 'cal-work', 'تسليم التقرير', 8, '14:00', '15:00'),
      ev('e14', 'cal-personal', 'سفر', 10, '07:00', '09:00'),
      allDay('e15', 'cal-family', 'إجازة المدرسة', 2, 3),
      allDay('e16', 'cal-personal', 'عيد ميلاد سارة', 5),
      allDay('e17', 'cal-work', 'مؤتمر', 12, 2),
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

async function session(name, contextOptions, steps) {
  const context = await browser.newContext({ timezoneId: 'Asia/Riyadh', reducedMotion: 'reduce', ...contextOptions });
  const page = await context.newPage();
  await seed(page);
  const shot = async (label) => {
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/${name}-${label}.png` });
  };
  try {
    await steps(page, shot);
  } catch (error) {
    console.error(`session ${name} stopped early:`, String(error).slice(0, 400));
  }
  await context.close();
}

// On a phone the views are in a menu (D-079).
const chooseView = async (page, name) => {
  await page.getByRole('button', { name: 'تغيير العرض' }).click();
  await page.getByRole('button', { name, exact: true }).click();
};

const key = (page, code) => page.keyboard.press(code);

await session('desktop-ar', { viewport: { width: 1280, height: 800 }, locale: 'ar-SA' }, async (page, shot) => {
  await shot('month');
  await key(page, 'KeyY');
  await page.locator('.year-month').nth(9).scrollIntoViewIfNeeded(); await shot('year');
  await key(page, 'KeyW'); await shot('week');
  await key(page, 'KeyW');
  await page.locator('.tg-col').nth(2).click({ position: { x: 40, y: 700 } }); await shot('quick');
  await key(page, 'Escape');
  await key(page, 'KeyD'); await shot('day');
  await key(page, 'KeyA'); await shot('agenda');
  await key(page, 'KeyC'); await shot('editor');
  await key(page, 'Escape');
  await page.getByRole('button', { name: 'البيانات والنسخ الاحتياطي' }).click();
  await shot('data');
});

await session('desktop-en-dark', { viewport: { width: 1280, height: 800 }, locale: 'en-US', colorScheme: 'dark' }, async (page, shot) => {
  await shot('month');
  await key(page, 'KeyW'); await shot('week');
});

await session('phone-ar', { viewport: { width: 390, height: 844 }, locale: 'ar-SA', hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, async (page, shot) => {
  await shot('agenda');
  await page.getByRole('button', { name: /اجتماع الفريق/ }).first().click(); await shot('card');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'القائمة' }).click(); await shot('drawer');
  await page.getByRole('button', { name: 'إغلاق القائمة' }).click();
  await chooseView(page, 'شهر'); await shot('month');
  await page.getByRole('button', { name: 'إضافة حدث' }).click(); await shot('editor');
  await page.getByRole('button', { name: 'إلغاء', exact: true }).click();
  await chooseView(page, '3 أيام'); await shot('days3');
  await chooseView(page, 'أسبوع'); await shot('week');
  await chooseView(page, 'يوم'); await shot('day');
  await chooseView(page, 'سنة');
  await page.locator('.year-month').nth(9).scrollIntoViewIfNeeded(); await shot('year');
});

// A tall phone: shows the whole menu and the dialogs without scrolling (D-056).
await session('phone-tall-ar', { viewport: { width: 390, height: 1500 }, locale: 'ar-SA', hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, async (page, shot) => {
  await page.getByRole('button', { name: 'القائمة' }).click(); await shot('menu');
  await page.getByRole('button', { name: 'البيانات والنسخ الاحتياطي' }).click(); await shot('data');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'القائمة' }).click();
  await page.getByRole('button', { name: 'عن التطبيق والخصوصية' }).click(); await shot('about');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'القائمة' }).click();
  await page.getByRole('button', { name: 'إضافة تقويم' }).click(); await shot('calendar');
});

// Text at 200% (the design system's delivery check): the root font size doubled, as a browser's
// text-size setting does. Prints what overflows sideways and what is cut off, then screenshots.
await session('phone-zoom-ar', { viewport: { width: 390, height: 844 }, locale: 'ar-SA', hasTouch: true, isMobile: true, deviceScaleFactor: 1 }, async (page, shot) => {
  // The page's policy forbids a <style> tag; a script setting the element's own style is allowed.
  await page.evaluate(() => document.documentElement.style.setProperty('font-size', '200%', 'important'));
  const audit = async (label) => {
    const r = await page.evaluate(() => ({
      sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      // Anything past the screen edge, ignoring the closed drawer (parked off-screen on purpose).
      offscreen: [...document.querySelectorAll('body *')]
        .filter((el) => el.offsetParent !== null && !el.closest('.sidebar, .toast'))
        .filter((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && (b.right > innerWidth + 1 || b.left < -1); })
        .slice(0, 8)
        .map((el) => `${el.tagName}.${el.className} l=${Math.round(el.getBoundingClientRect().left)} r=${Math.round(el.getBoundingClientRect().right)}`),
      wide: [...document.querySelectorAll('body *')]
        .filter((el) => el.offsetParent !== null && el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX === 'visible' && el.clientWidth > 0)
        .slice(0, 6)
        .map((el) => `${el.tagName}.${el.className} sw=${el.scrollWidth} cw=${el.clientWidth}`),
      viewport: [innerWidth, document.documentElement.clientWidth, document.documentElement.scrollWidth],
      cut: [...document.querySelectorAll('button, h1, h2, label')]
        .filter((el) => el.offsetParent !== null && el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible' && getComputedStyle(el).textOverflow === 'ellipsis')
        .slice(0, 6)
        .map((el) => `${el.tagName}.${el.className} "${(el.textContent ?? '').trim().slice(0, 24)}"`),
    }));
    console.log(`zoom200 ${label}: ${JSON.stringify(r)}`);
  };
  await audit('agenda'); await shot('agenda');
  await chooseView(page, 'شهر'); await audit('month'); await shot('month');
  await chooseView(page, 'أسبوع'); await audit('week'); await shot('week');
  await page.getByRole('button', { name: 'القائمة' }).click(); await audit('drawer'); await shot('drawer');
  await page.getByRole('button', { name: 'إغلاق القائمة' }).click();
  await page.getByRole('button', { name: 'إضافة حدث' }).click(); await audit('editor'); await shot('editor');
});

// Smoothness audit (printed, not a test): a phone with a 4x slower CPU. For each action: time to the
// next painted frame, long tasks (> 50ms), the worst frame gap during the next 600ms, and layout shift.
for (const many of [0, 5000]) await session(many ? 'perf-phone-5000' : 'perf-phone', { viewport: { width: 390, height: 844 }, locale: 'ar-SA', hasTouch: true, isMobile: true }, async (page) => {
  if (many) {
    // Same shape as the release test in e2e/release.spec.ts: events spread over the days around today.
    await page.evaluate(async (n) => {
      const db = await new Promise((res, rej) => { const r = indexedDB.open('nawy-today'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const calendarId = await new Promise((res) => { const q = db.transaction('calendars').objectStore('calendars').getAll(); q.onsuccess = () => res(q.result[0].id); });
      const now = new Date();
      const tx = db.transaction('events', 'readwrite');
      const store = tx.objectStore('events');
      for (let i = 0; i < n; i += 1) {
        const d = new Date(now.getFullYear(), now.getMonth(), 1 + (i % 28));
        d.setDate(d.getDate() + (i % 5) - 2);
        const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const hour = String(8 + (i % 10)).padStart(2, '0');
        store.put({ id: `perf-${i}`, calendarId, title: `Event ${i}`, allDay: false, start: `${day}T${hour}:00`, end: `${day}T${hour}:45`, tzid: 'Asia/Riyadh', createdAt: 1, updatedAt: 1 });
      }
      await new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
      db.close();
    }, many);
    const t = Date.now();
    await page.reload();
    await page.locator('.agenda-list li, .bar').first().waitFor({ timeout: 60000 }).catch(() => undefined);
    console.log(`PERF5000 reload to first event: ${Date.now() - t}ms`);
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => {
    window.__perf = { long: [], shift: 0 };
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__perf.long.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: false });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__perf.shift += e.value; })).observe({ type: 'layout-shift', buffered: false });
  });
  const measure = async (label, act) => {
    await page.evaluate(() => { window.__perf.long = []; window.__perf.shift = 0; });
    const t0 = Date.now();
    await act();
    const result = await page.evaluate(() => new Promise((resolve) => {
      const start = performance.now();
      let last = start; let worst = 0; let frames = 0; let firstPaint = 0;
      const tick = (now) => {
        frames += 1; if (!firstPaint) firstPaint = Math.round(now - start);
        worst = Math.max(worst, now - last); last = now;
        if (now - start < 600) requestAnimationFrame(tick);
        else resolve({ firstPaint, worstGap: Math.round(worst), frames, long: window.__perf.long.slice(), shift: Math.round(window.__perf.shift * 1000) / 1000 });
      };
      requestAnimationFrame(tick);
    }));
    console.log(`PERF${many || ''} ${label}: act=${Date.now() - t0}ms ${JSON.stringify(result)}`);
  };
  // CPU profile of one action (only with the big data set): top self-time by function and file.
  const profiled = async (label, act) => {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
    await cdp.send('Profiler.start');
    await measure(label, act);
    const { profile } = await cdp.send('Profiler.stop');
    const dt = profile.timeDeltas; const self = new Map();
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    profile.samples.forEach((id, i) => { self.set(id, (self.get(id) ?? 0) + (dt[i] ?? 0)); });
    const rows = new Map();
    for (const [id, t] of self) {
      const n = byId.get(id); const f = n.callFrame;
      const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber}`;
      rows.set(key, (rows.get(key) ?? 0) + t);
    }
    const top = [...rows].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, t]) => `${Math.round(t / 1000)}ms ${k}`);
    console.log(`PROFILE ${label}:\n  ` + top.join('\n  '));
  };
  const chooseV = async (name) => { await page.getByRole('button', { name: 'تغيير العرض' }).click(); await page.getByRole('button', { name, exact: true }).click(); };
  await (many ? profiled : measure)('view -> month', () => chooseV('شهر'));
  await measure('month next x1', () => page.getByRole('button', { name: /الشهر التالي/ }).click());
  await (many ? profiled : measure)('view -> week', () => chooseV('أسبوع'));
  await measure('week next', () => page.getByRole('button', { name: /الأسبوع التالي/ }).click());
  await measure('view -> year', () => chooseV('سنة'));
  await measure('year next', () => page.getByRole('button', { name: /السنة التالية/ }).click());
  await measure('view -> day', () => chooseV('يوم'));
  await measure('open drawer', () => page.getByRole('button', { name: 'القائمة' }).click());
  await measure('close drawer', () => page.getByRole('button', { name: 'إغلاق القائمة' }).click());
  console.log('FAB before editor: ' + JSON.stringify(await page.evaluate(() => { const f = document.querySelector('.fab'); const r = f?.getBoundingClientRect(); const cs = f && getComputedStyle(f); return { hidden: f?.getAttribute('data-hidden'), vis: cs?.visibility, tf: cs?.transform, top: r && Math.round(r.top), left: r && Math.round(r.left), toast: !!document.querySelector('.toast'), banner: !!document.querySelector('.banner') }; })));
  await measure('open editor', () => page.getByRole('button', { name: 'إضافة حدث' }).click({ timeout: 20000 }));
  await measure('close editor', () => page.getByRole('button', { name: 'إلغاء', exact: true }).click());
  await measure('scroll day grid', async () => { await page.evaluate(() => document.querySelector('.tg-scroll')?.scrollBy({ top: 400 })); });
  await measure('today', () => page.getByRole('button', { name: 'اليوم', exact: true }).first().click());
});

await browser.close();
