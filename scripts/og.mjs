// Makes the 1200x630 share images in public/og/: one per topic plus default.png, in the site's calico-and-denim style.
// Only needed when a topic is added or the look changes. Needs Playwright: `npm run og`.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const config = JSON.parse(readFileSync('site.config.json', 'utf8'));
const src = readFileSync('build.mjs', 'utf8');
const topics = [...src.matchAll(/name: '([^']+)', slug: '([^']+)', tint: '([^']+)'/g)].map(([, name, slug, tint]) => ({ name, slug, tint }));
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const font = (file, family, extra = '') => `@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${readFileSync(`public/fonts/${file}`).toString('base64')}) format('woff2');${extra}}`;
const fonts = font('fraunces.woff2', 'Fraunces', 'font-weight:300 700') + font('fraunces-italic.woff2', 'Fraunces', 'font-weight:300 700;font-style:italic') + font('jetbrains-mono.woff2', 'JetBrains Mono');

const card = ({ heading, label, tint, icon }) => `<!doctype html><style>${fonts}
body{margin:0;width:1200px;height:630px;box-sizing:border-box;padding:72px 80px;display:flex;align-items:center;gap:64px;background:#f3eee4;color:#1b2236;font-family:Fraunces,Georgia,serif}
.copy{flex:1}.label{font:500 20px/1 'JetBrains Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:#a3361f;margin-bottom:28px}
h1{font-weight:360;font-size:84px;line-height:.98;letter-spacing:-.035em;margin:0 0 30px}h1 em{font-style:italic;color:#c2412a}
.url{font:500 20px/1 'JetBrains Mono',monospace;letter-spacing:.08em;color:#555c6f}
.swatch{width:380px;height:380px;flex:none;display:grid;place-items:center;background:color-mix(in oklab,${tint} 28%,#fbf7ef);position:relative;rotate:2deg;box-shadow:0 30px 50px -24px rgba(27,34,54,.45)}
.swatch::after{content:"";position:absolute;inset:22px;border:2px dashed color-mix(in srgb,${tint} 60%,#f3eee4)}
.patch{width:230px;height:230px;border-radius:50%;background:${tint};display:grid;place-items:center;box-shadow:0 4px 0 color-mix(in srgb,${tint} 60%,#000),0 22px 26px -8px rgba(0,0,0,.35);outline:3px dashed #f6efe2;outline-offset:-22px;rotate:-6deg}
.patch div{width:120px;height:120px;border-radius:50%;background:#faf6ee;display:grid;place-items:center}
.patch img{width:84px;height:84px}
.tape{position:absolute;left:0;right:0;bottom:0;height:22px;background:repeating-linear-gradient(90deg,#2b2418 0 1.5px,transparent 1.5px 40px) 0 0/100% 12px no-repeat,repeating-linear-gradient(90deg,rgba(43,36,24,.6) 0 1px,transparent 1px 8px) 0 0/100% 6px no-repeat,#ecc66b}
</style><body><div class="copy"><div class="label">${esc(label)}</div><h1>${heading}</h1><div class="url">patchedpatches.co.uk</div></div>
<div class="swatch"><div class="patch"><div><img src="data:image/svg+xml;base64,${readFileSync(`public/img/icons/${icon}.svg`).toString('base64')}"></div></div></div><div class="tape"></div></body>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
const jobs = [
  { slug: 'default', heading: 'Patch it, mend it, <em>keep wearing it.</em>', label: 'A UK field guide to patching and mending', tint: '#c2522b', icon: 'default' },
  ...topics.map(t => ({ slug: t.slug, heading: esc(t.name).replace(/ (\S+)$/, ' <em>$1</em>'), label: `${config.name} · Guides`, tint: t.tint, icon: t.slug })),
];
for (const job of jobs) {
  await page.setContent(card(job), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `public/og/${job.slug}.png` });
}
await browser.close();
console.log(`${jobs.length} share images written to public/og/`);
