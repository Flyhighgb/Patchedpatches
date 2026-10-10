// Draws the flat illustrations in public/img/: one per topic, topic icons, the homepage hero and the favicon.
// To add a topic, add its prop drawing to `props` (keyed by topic slug), run `npm run art`, then `npm run og`.
import { writeFileSync, mkdirSync } from 'node:fs';
const A = '#ff6b4a', BG = '#fff4d6', P = '#1f3a5f', Y = '#ffd23f', W = '#fff', R = '#e8467c';

// The mascot: a round embroidered patch with a stitched edge and a star.
const badge = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
<circle cx="60" cy="60" r="56" fill="${A}"/>
<circle cx="60" cy="60" r="46" fill="none" stroke="${W}" stroke-width="4" stroke-dasharray="8 6"/>
<path d="M60 28l9 20 22 2-17 14 5 22-19-12-19 12 5-22-17-14 22-2z" fill="${Y}"/>
</g>`;

const props = {
  'applying-patches': `<path d="M196 128 q8 -50 60 -56 h34 v56z" fill="${P}"/><rect x="190" y="128" width="104" height="12" rx="6" fill="${P}"/>
<path d="M236 72 q4 -22 30 -22 h20" stroke="${P}" stroke-width="10" fill="none" stroke-linecap="round"/>
<path d="M214 156 q6 -8 0 -14 M240 158 q6 -8 0 -14 M266 156 q6 -8 0 -14" stroke="${Y}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  'patch-care': `<rect x="196" y="44" width="92" height="112" rx="12" fill="${P}"/><rect x="204" y="52" width="76" height="14" rx="5" fill="${W}" opacity=".25"/>
<circle cx="242" cy="110" r="32" fill="${W}"/><circle cx="242" cy="110" r="24" fill="#8fb3dc"/><path d="M222 112 q10 -10 20 0 t20 0" stroke="${W}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  'choosing-patches': `<rect x="190" y="58" width="50" height="50" rx="10" fill="${P}"/><rect x="196" y="64" width="38" height="38" rx="6" fill="none" stroke="${W}" stroke-width="3" stroke-dasharray="5 4"/>
<path d="M270 52 l24 14 v28 l-24 14 -24 -14 v-28z" fill="${R}"/><path d="M270 62 l15 9 v18 l-15 9 -15 -9 v-18z" fill="none" stroke="${W}" stroke-width="3" stroke-dasharray="5 4"/>
<ellipse cx="244" cy="138" rx="40" ry="20" fill="${Y}"/><ellipse cx="244" cy="138" rx="32" ry="13" fill="none" stroke="${W}" stroke-width="3" stroke-dasharray="5 4"/>`,
  'projects-and-ideas': `<path d="M204 72 q0 -30 38 -30 q38 0 38 30" stroke="${P}" stroke-width="8" fill="none"/><rect x="194" y="70" width="96" height="92" rx="16" fill="${P}"/>
<circle cx="224" cy="104" r="14" fill="${Y}"/><rect x="246" y="118" width="30" height="24" rx="5" fill="${R}"/><path d="M226 140 l8 -14 8 14z" fill="${W}"/>`,
  'tools-and-kit': `<rect x="196" y="60" width="46" height="84" rx="6" fill="${P}"/><rect x="202" y="72" width="34" height="60" fill="${R}"/>
<path d="M202 80 h34 M202 92 h34 M202 104 h34 M202 116 h34 M202 128 h34" stroke="#e57a96" stroke-width="3"/>
<path d="M300 50 L262 150" stroke="${P}" stroke-width="5" stroke-linecap="round"/><ellipse cx="296" cy="60" rx="3" ry="7" transform="rotate(21 296 60)" fill="${BG}"/>
<path d="M296 60 q-30 30 -60 20" stroke="${R}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  default: `<g transform="translate(196 50)"><rect width="88" height="88" rx="18" fill="${P}"/><rect x="9" y="9" width="70" height="70" rx="12" fill="none" stroke="${W}" stroke-width="3" stroke-dasharray="6 5"/>
<path d="M44 22 a18 18 0 1 0 0.1 0z" fill="${Y}"/></g>`,
};

for (const [k, v] of Object.entries(props))
  writeFileSync(`public/img/${k}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="320" height="180"><rect width="320" height="180" rx="16" fill="${BG}"/>${badge(40, 30, 1)}${v}</svg>\n`);

// Icons: just the prop, on a transparent background, for tiles and cards.
mkdirSync('public/img/icons', { recursive: true });
for (const [k, v] of Object.entries(props))
  writeFileSync(`public/img/icons/${k}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="176 28 128 128" width="144" height="144">${v}</svg>\n`);

// Homepage hero: a denim jacket with patches on it, on a square background (the page crops it to a blob).
writeFileSync('public/img/hero.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" width="480" height="480">
<rect width="480" height="480" fill="${BG}"/>
<path d="M150 90 l50 -20 q40 26 80 0 l50 20 l70 70 l-40 60 l-30 -24 v214 h-200 v-214 l-30 24 l-40 -60z" fill="#5b7fb0"/>
<path d="M240 76 v320" stroke="#3f6396" stroke-width="4"/><path d="M200 70 l40 60 40 -60" fill="none" stroke="#3f6396" stroke-width="6" stroke-linejoin="round"/>
<path d="M180 300 h120 M180 304 h120" stroke="#3f6396" stroke-width="2" stroke-dasharray="6 4"/>
${badge(158, 150, .6)}
<g transform="translate(262 158)"><rect width="56" height="56" rx="10" fill="${R}"/><rect x="6" y="6" width="44" height="44" rx="6" fill="none" stroke="${W}" stroke-width="3" stroke-dasharray="5 4"/><path d="M28 16 a12 12 0 1 0 0.1 0z" fill="${Y}"/></g>
<g transform="translate(250 240)"><path d="M30 0 l26 15 v30 l-26 15 -26 -15 v-30z" fill="${Y}"/><path d="M30 10 l17 10 v20 l-17 10 -17 -10 v-20z" fill="none" stroke="${P}" stroke-width="3" stroke-dasharray="5 4"/></g>
<g transform="translate(176 320)"><ellipse cx="34" cy="20" rx="34" ry="20" fill="${P}"/><ellipse cx="34" cy="20" rx="26" ry="13" fill="none" stroke="${W}" stroke-width="3" stroke-dasharray="5 4"/></g>
</svg>\n`);

// Favicon: the mascot patch on its own.
writeFileSync('public/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">${badge(0, 0, 1)}</svg>\n`);
