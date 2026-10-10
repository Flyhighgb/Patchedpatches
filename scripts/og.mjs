// Makes the 1200x630 share images in public/og/ from the illustrations in public/img/.
// Only needed when a topic is added. Needs Playwright: `npx playwright@1.56.1 install chromium` then `npm run og`.
import { readFileSync, readdirSync } from 'node:fs';
import { chromium } from 'playwright';

const config = JSON.parse(readFileSync('site.config.json', 'utf8'));
const src = readFileSync('build.mjs', 'utf8');
const names = Object.fromEntries([...src.matchAll(/name: '([^']+)', slug: '([^']+)'/g)].map(m => [m[2], m[1]]));
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const file of readdirSync('public/img').filter(f => f.endsWith('.svg') && f !== 'hero.svg')) {
  const slug = file.replace('.svg', '');
  const heading = names[slug] ? `${names[slug]} guides` : config.name;
  const sub = names[slug] ? config.name : config.tagline;
  await page.setContent(`<body style="margin:0;width:1200px;height:630px;display:flex;align-items:center;gap:48px;padding:0 64px;box-sizing:border-box;background:#fffdf5;font-family:system-ui,sans-serif;color:#1f3a5f">
<div style="width:560px;flex:none">${readFileSync(`public/img/${file}`, 'utf8').replace('width="320" height="180"', 'width="560" height="315"')}</div>
<div><div style="font-size:60px;font-weight:800;line-height:1.1">${esc(heading)}</div>
<div style="font-size:30px;color:#d9431f;margin-top:20px;font-weight:600">${esc(sub)}</div>
<div style="font-size:24px;color:#557089;margin-top:28px">patchedpatches.co.uk</div></div></body>`);
  await page.screenshot({ path: `public/og/${slug}.png` });
}
await browser.close();
console.log('Share images written to public/og/');
