// Static site builder: Markdown in content/ -> HTML in dist/.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { marked } from 'marked';

const config = JSON.parse(readFileSync('site.config.json', 'utf8'));
const OUT = 'dist';
// Browsers keep style.css for a day (see public/_headers), so its URL changes whenever it does.
const cssVersion = createHash('sha1').update(readFileSync('public/style.css')).digest('hex').slice(0, 8);
const fxVersion = createHash('sha1').update(readFileSync('public/fx.js')).digest('hex').slice(0, 8);
const toolVersion = createHash('sha1').update(readFileSync('public/tool.js')).digest('hex').slice(0, 8);

// Topics shown on the homepage. Each has an illustration in public/img/<slug>.svg
// and a share image in public/og/<slug>.png (made by `npm run og`).
const TOPICS = [
  { name: 'Applying patches', slug: 'applying-patches', tint: '#2f4d8a', blurb: 'Ironing on, sewing on and gluing patches so they stay put.' },
  { name: 'Mending and repairs', slug: 'mending-and-repairs', tint: '#6b4a8c', blurb: 'Holes, buttons, darning and visible mending to keep your clothes going.' },
  { name: 'Patch care', slug: 'patch-care', tint: '#4f7a5a', blurb: 'Washing, fixing peeling edges and removing patches cleanly.' },
  { name: 'Choosing patches', slug: 'choosing-patches', tint: '#b8475f', blurb: 'Embroidered, woven, PVC and chenille, and which backing to pick.' },
  { name: 'Projects and ideas', slug: 'projects-and-ideas', tint: '#c2522b', blurb: 'Jackets, bags, denim and making your own patches.' },
  { name: 'Tools and kit', slug: 'tools-and-kit', tint: '#d4972a', blurb: 'The best irons, heat presses, fabric glues and needles for patches.' },
];
const TOOL_PATH = '/patch-layout-tool/';
const topicFor = name => TOPICS.find(t => t.name === name);

function parse(file) {
  const raw = readFileSync(file, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`Missing front matter: ${file}`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"(.*)"$/, '$1');
  }
  const body = unsplashImages(gumroadLinks(awinLinks(amazonLinks(m[2]))));
  const minutes = Math.max(1, Math.round(m[2].split(/\s+/).length / 220));
  const html = callouts(stackTables(headingIds(marked.parse(body))));
  return { ...meta, slug: basename(file, '.md'), faq: faqs(body), minutes, affiliate: body.includes('rel="sponsored'), html,
    toc: [...html.matchAll(/<h2 id="([^"]+)">(.*?)<\/h2>/g)].map(([, id, text]) => ({ id, text })).filter(h => h.id !== 'sources') };
}

// ![Patches on a denim jacket](unsplash:photo-123) on its own line -> a responsive Unsplash photo.
function unsplashImages(md) {
  return md.replace(/^!\[([^\]]*)\]\(unsplash:(photo-[\w-]+)\)$/gm, (_, alt, id) =>
    `<figure class="section-photo">${photo(id, alt, { w: 760, h: 380, sizes: '(max-width: 800px) 100vw, 720px' })}</figure>`);
}

// [Shop sisal scratching posts](amazon:sisal scratching post) -> an Amazon search link with our Associates tag.
function amazonLinks(md) {
  return md.replace(/\[([^\]]+)\]\(amazon:([^)]+)\)/g, (_, text, query) => {
    if (!config.amazonTag) return text;
    const url = `https://www.amazon.co.uk/s?k=${encodeURIComponent(query.trim()).replace(/%20/g, '+')}&amp;tag=${encodeURIComponent(config.amazonTag)}`;
    return `<a href="${url}" rel="sponsored nofollow noopener" target="_blank">${text}</a>`;
  });
}

// [Shop at Hobbycraft](awin:hobbycraft|https://www.hobbycraft.co.uk/...) -> an Awin tracking link, once the merchant is set in site.config.json.
// Until Awin approves us for that merchant, the link text shows without a link, like Amazon links before the tag is set.
function awinLinks(md) {
  return md.replace(/\[([^\]]+)\]\(awin:([a-z0-9-]+)\|([^)]+)\)/g, (_, text, merchant, dest) => {
    const mid = config.awinMerchants?.[merchant];
    if (!config.awinPublisherId || !mid) return text;
    const url = `https://www.awin1.com/cread.php?awinmid=${encodeURIComponent(mid)}&amp;awinaffid=${encodeURIComponent(config.awinPublisherId)}&amp;ued=${encodeURIComponent(dest.trim())}`;
    return `<a href="${url}" rel="sponsored nofollow noopener" target="_blank">${text}</a>`;
  });
}

// [Get the planner](gumroad:planner) -> a buy button for the Gumroad product in site.config.json, or a "coming soon" note until it's listed.
function gumroadLinks(md) {
  return md.replace(/\[([^\]]+)\]\(gumroad:([a-z0-9-]+)\)/g, (_, text, key) => {
    const url = config.gumroad?.[key];
    return url ? `<a class="button buy" href="${url}" target="_blank" rel="noopener">${text}</a>` : `<span class="button buy soon">Coming soon</span>`;
  });
}

// Give h2/h3 headings ids so sections can be linked to, e.g. /about/#how-we-write-our-guides.
const headingIds = html => html.replace(/<h([23])>(.*?)<\/h\1>/g, (_, n, text) =>
  `<h${n} id="${text.replace(/<[^>]+>|&[a-z#0-9]+;/gi, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}">${text}</h${n}>`);

// Label each table cell with its column heading, so tables can stack into cards on phones.
const stackTables = html => html.replace(/<table>([\s\S]*?)<\/table>/g, (_, inner) => {
  const heads = [...(inner.match(/<thead>[\s\S]*?<\/thead>/)?.[0] || '').matchAll(/<th[^>]*>(.*?)<\/th>/g)].map(h => h[1].replace(/<[^>]+>/g, ''));
  const body = inner.replace(/<tbody>([\s\S]*?)<\/tbody>/, (__, rows) => `<tbody>${rows.replace(/<tr>([\s\S]*?)<\/tr>/g, (___, cells) => {
    let i = 0;
    return `<tr>${cells.replace(/<td([^>]*)>/g, (____, attrs) => `<td${attrs} data-label="${esc(heads[i++] || '')}">`)}</tr>`;
  })}</tbody>`);
  return `<div class="table"><table>${body}</table></div>`;
});

// Box "The short version" and "Sources" so they stand out from the body text.
const callouts = html => html
  .replace(/(<h2 id="the-short-version">[\s\S]*?)(?=<h2|$)/, '<section class="summary">$1</section>\n')
  .replace(/(<h2 id="sources">[\s\S]*?)(?=<h2|$)/, '<section class="sources">$1</section>\n');

// Questions under a "## Common questions" heading: each "### Question" plus the text after it.
function faqs(md) {
  const section = md.match(/^## Common questions\n([\s\S]*?)(?=^## |(?![\s\S]))/m);
  if (!section) return [];
  return section[1].split(/^### /m).slice(1).map(block => {
    const [q, ...rest] = block.split('\n');
    const answer = marked.parse(rest.join('\n').trim()).replace(/<[^>]+>/g, '').trim();
    return { q: q.trim(), a: answer };
  }).filter(f => f.q && f.a);
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const longDate = d => d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '';
const iconFor = category => `/img/icons/${topicFor(category)?.slug || 'default'}.svg`;
const tintFor = category => topicFor(category)?.tint || '#c2522b';
const ogFor = category => existsSync(`public/og/${topicFor(category)?.slug}.png`) ? `/og/${topicFor(category).slug}.png` : '/og/default.png';

// The site mark: a round patch with a darning cross stitched through it.
const MARK = `<svg class="mark" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="var(--thread)"/><circle cx="20" cy="20" r="14.5" fill="none" stroke="var(--on-thread)" stroke-width="1.6" stroke-dasharray="3 2.4" stroke-linecap="round"/><path d="M13.5 13.5l13 13M26.5 13.5l-13 13" stroke="var(--on-thread)" stroke-width="2.6" stroke-linecap="round"/></svg>`;
const FONTS = ['fraunces', 'instrument-sans'].map(f => `<link rel="preload" href="/fonts/${f}.woff2" as="font" type="font/woff2" crossorigin>`).join('\n');

function layout({ title, description, path, body, schema, image = '/og/default.png', kind = 'page' }) {
  // Google shows about 60 characters of a title, so long titles drop the site name.
  const full = path === '/' ? `${config.name}: ${config.tagline.replace(/\.$/, '')}` : title.length > 48 ? title : `${title} | ${config.name}`;
  const analytics = config.analytics
    ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${esc(config.analytics)}"}'></script>` : '';
  const ads = config.adsenseClient
    ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(config.adsenseClient)}" crossorigin="anonymous"></script>` : '';
  const schemas = [].concat(schema || []);
  const here = href => path.startsWith(href) ? ' aria-current="page"' : '';
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${config.url}${path}">
<meta property="og:site_name" content="${esc(config.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${config.url}${path}">
<meta property="og:type" content="${path.startsWith('/guides/') && path !== '/guides/' ? 'article' : 'website'}">
<meta property="og:image" content="${esc(image.startsWith('https://') ? image : config.url + image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#f3eee4" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#131a2b" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
${FONTS}
<link rel="stylesheet" href="/style.css?v=${cssVersion}">
<script defer src="/fx.js?v=${fxVersion}"></script>
${schemas.map(s => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join('\n')}
${ads}
</head>
<body class="is-${kind}">
<a class="skip" href="#main">Skip to content</a>
<header class="site-header"><div class="wrap">
  <a class="logo" href="/">${MARK}<span>Patched <em>Patches</em></span></a>
  <nav aria-label="Main"><a href="/guides/"${here('/guides/')}>Guides</a><a class="hide-sm" href="/topics/mending-and-repairs/"${here('/topics/mending-and-repairs/')}>Mending</a><a class="hide-xs" href="/best-patch-supplies/"${here('/best-patch-supplies/')}>Supplies</a><a class="hide-sm" href="/about/"${here('/about/')}>About</a><a class="nav-cta" href="${TOOL_PATH}"${here(TOOL_PATH)}><span class="hide-sm">Patch layout tool</span><span class="show-sm">Layout tool</span></a></nav>
</div>${kind === 'guide' ? '<span class="progress" aria-hidden="true"></span>' : ''}</header>
<main id="main">
${body}
</main>
<footer class="site-footer"><div class="wrap">
  <div class="footer-top">
    <p class="footer-lede">Mend the thing you love. <em>Wear it for years.</em></p>
    <a class="button light" href="/guides/">Browse every guide</a>
  </div>
  <div class="footer-grid">
    <div><a class="logo" href="/">${MARK}<span>Patched <em>Patches</em></span></a>
      <p>${esc(config.tagline)}</p></div>
    <div><h2>Topics</h2><ul>${TOPICS.filter(t => usedNames.has(t.name)).map(t => `<li><a href="/topics/${t.slug}/">${esc(t.name)}</a></li>`).join('')}</ul></div>
    <div><h2>Tools</h2><ul><li><a href="${TOOL_PATH}">Patch layout tool</a></li><li><a href="/patch-planner/">Patch Placement Planner</a></li><li><a href="/best-patch-supplies/">Best patch supplies</a></li></ul></div>
    <div><h2>About us</h2><ul><li><a href="/about/">About</a></li><li><a href="/about/#how-we-write-our-guides">How we write our guides</a></li><li><a href="/affiliate-disclosure/">Affiliate disclosure</a></li><li><a href="/privacy/">Privacy</a></li></ul></div>
  </div>
  <p class="footer-note">Always check the care label on your garment and the instructions that came with your patch, iron or glue. Information here is general guidance.</p>
  <p class="footer-note">© ${new Date().getFullYear()} ${esc(config.name)}. Made in the UK.${guides.some(g => g.image) ? ' Photos from <a href="https://unsplash.com/?utm_source=patchedpatches&amp;utm_medium=referral">Unsplash</a>.' : ''}</p>
  <div class="wordmark" aria-hidden="true"></div>
</div></footer>
${analytics}
</body>
</html>`;
}

// Guide photos are free Unsplash photos (unsplash.com/license), served from Unsplash's image CDN.
// `image:` in a guide's front matter is the photo id, e.g. photo-1511275539165-cc46b1ee89bf.
const photoUrl = (id, w, h) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}${h ? `&h=${h}` : ''}&q=70`;
function photo(id, alt, { w, h, sizes, eager = false, cls = '' }) {
  const ratio = h / w;
  const srcset = [w / 2, w, w * 1.5].map(x => `${photoUrl(id, Math.round(x), Math.round(x * ratio))} ${Math.round(x)}w`).join(', ');
  return `<img class="${cls}" src="${esc(photoUrl(id, w, h))}" srcset="${esc(srcset)}" sizes="${sizes}" alt="${esc(alt || '')}" width="${w}" height="${h}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`;
}
const patch3d = (cls, face, z, pos) => `<div class="p3 ${cls}" style="--z:${z}px;${pos}">${[5, 4, 3, 2, 1].map(i => `<span class="edge" style="--i:${i}"></span>`).join('')}<span class="back"></span><span class="face">${face}</span></div>`;
// A piece of fabric cut with pinking shears, for a patch to sit on: a zigzag clip-path all the way round.
const PINKED = (() => {
  const n = 26, d = 1.6, pts = [];
  const side = (fn) => { for (let i = 0; i < n; i++) { pts.push(fn(i / n, 0)); pts.push(fn((i + .5) / n, d)); } };
  side((t, o) => [t * 100, o]);
  side((t, o) => [100 - o, t * 100]);
  side((t, o) => [100 - t * 100, 100 - o]);
  side((t, o) => [o, 100 - t * 100]);
  return `polygon(${pts.map(([x, y]) => `${+x.toFixed(2)}% ${+y.toFixed(2)}%`).join(', ')})`;
})();
const CLOTH = `<span class="cloth swatch-bg" style="clip-path:${PINKED}"></span>`;

// Every guide gets its own embroidered patch, drawn from `patch:` (two words split by |) and `shape:` in its front matter.
const SHAPES = {
  circle: { svg: '<circle cx="60" cy="60" r="57"/>', clip: 'circle(48% at 50% 50%)' },
  square: { svg: '<rect x="4" y="4" width="112" height="112" rx="22"/>', clip: 'inset(3% round 18%)' },
  hex: { svg: '<path d="M60 3l51 28.5v57L60 117 9 88.5v-57z"/>', clip: 'polygon(50% 2%, 93% 26%, 93% 74%, 50% 98%, 7% 74%, 7% 26%)' },
  oval: { svg: '<ellipse cx="60" cy="60" rx="57" ry="40"/>', clip: 'ellipse(48% 34% at 50% 50%)' },
  shield: { svg: '<path d="M60 4l52 14v40c0 30-24 50-52 58C32 108 8 88 8 58V18z"/>', clip: 'polygon(50% 3%, 93% 15%, 93% 50%, 82% 78%, 50% 97%, 18% 78%, 7% 50%, 7% 15%)' },
};
const LIGHT_TINTS = ['#d4972a', '#e9c46a'];
function patchSvg(g, cls = '') {
  const shape = SHAPES[g.shape] || SHAPES.circle;
  const tint = tintFor(g.category);
  const ink = LIGHT_TINTS.includes(tint) ? '#1b2236' : '#f6efe2';
  const lines = (g.patch || g.title.split(' ').slice(0, 2).join('|')).toUpperCase().split('|');
  const size = Math.max(...lines.map(l => l.length)) > 6 ? 19 : 25;
  const ys = lines.length === 1 ? [68] : [56, 56 + size + 2];
  const text = (dx, fill) => lines.map((l, i) => `<text x="${60 + dx}" y="${ys[i] + dx}" text-anchor="middle" font-family="'Lilita One', Impact, sans-serif" font-size="${size}" letter-spacing="1" fill="${fill}">${esc(l)}</text>`).join('');
  return `<svg class="${cls}" viewBox="0 0 120 120" aria-hidden="true"><g fill="${tint}">${shape.svg}</g>
<g fill="none" stroke="${ink}" stroke-width="4.5" stroke-dasharray="7 5" stroke-linecap="round" transform="translate(60 60) scale(.82) translate(-60 -60)" opacity=".9">${shape.svg}</g>
${text(1.5, 'rgba(0,0,0,.22)')}${text(0, ink)}</svg>`;
}
const patchBlock = (g, cls, z = 24) => `<div class="p3 p-guide ${cls}" style="--z:${z}px;--edge:color-mix(in srgb, ${tintFor(g.category)} 62%, #000);--clip:${(SHAPES[g.shape] || SHAPES.circle).clip};--shape:0">${[5, 4, 3, 2, 1].map(i => `<span class="edge" style="--i:${i}"></span>`).join('')}<span class="back"></span><span class="face">${patchSvg(g)}</span></div>`;
const thumbFor = g => g.image
  ? `<span class="thumb photo">${photo(g.image, '', { w: 640, h: 400, sizes: '(max-width: 640px) 100vw, 360px' })}</span>`
  : `<span class="thumb patch-thumb swatch-bg">${patchSvg(g)}</span>`;

const disclosure = `<p class="disclosure">This page contains affiliate links. If you buy through them we may earn a small commission, at no extra cost to you. As an Amazon Associate we earn from qualifying purchases. <a href="/affiliate-disclosure/">Learn more</a>.</p>`;


function card(g) {
  return `<li class="card" style="--tint:${tintFor(g.category)}"><a href="/guides/${g.slug}/">
${thumbFor(g)}
<span class="card-meta">${g.category ? `<span>${esc(g.category)}</span>` : ''}<span>${g.minutes} min read</span></span>
<h3><span>${esc(g.title)}</span></h3><p>${esc(g.description)}</p></a></li>`;
}

function featured(g) {
  return `<a class="featured" style="--tint:${tintFor(g.category)}" href="/guides/${g.slug}/">
${g.image ? `<span class="featured-photo">${photo(g.image, '', { w: 900, h: 600, sizes: '(max-width: 760px) 100vw, 560px' })}</span>` : `<span class="featured-photo patch-stage" aria-hidden="true">${CLOTH}${patchBlock(g, 'p-featured', 30)}</span>`}
<span class="featured-body"><span class="card-meta"><span>Latest guide</span>${g.category ? `<span>${esc(g.category)}</span>` : ''}<span>${g.minutes} min read</span></span><h3><span>${esc(g.title)}</span></h3><p>${esc(g.description)}</p><span class="more">Read the guide <span aria-hidden="true">→</span></span></span></a>`;
}

const crumbSchema = items => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${config.url}${path}` })) });

function write(path, html) {
  const dir = join(OUT, path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
cpSync('public', OUT, { recursive: true });

let usedNames = new Set();
const guides = readdirSync('content/guides').filter(f => f.endsWith('.md'))
  .map(f => parse(join('content/guides', f)))
  .filter(g => g.draft !== 'true')
  .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
const pages = existsSync('content/pages')
  ? readdirSync('content/pages').filter(f => f.endsWith('.md')).map(f => parse(join('content/pages', f))) : [];
usedNames = new Set(guides.map(g => g.category));
const org = { '@type': 'Organization', name: config.name, url: config.url };
const lastmod = {};

for (const g of guides) {
  const path = `/guides/${g.slug}/`;
  const topic = topicFor(g.category);
  const related = guides.filter(o => o.slug !== g.slug && o.category === g.category).slice(0, 3);
  const more = related.length ? related : guides.filter(o => o.slug !== g.slug).slice(0, 3);
  // Shared links show the guide's photo, cropped to the 1200x630 share size.
  const share = g.image ? photoUrl(g.image, 1200, 630) : ogFor(g.category);
  const updated = g.updated || g.date;
  const reviewed = g.reviewed || updated;
  lastmod[path] = [updated, reviewed].sort().pop();
  const schema = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.description,
      image: share.startsWith('https://') ? share : `${config.url}${share}`, mainEntityOfPage: `${config.url}${path}`,
      datePublished: g.date, dateModified: lastmod[path],
      author: { ...org, name: `${config.name} editorial team` }, publisher: org },
    crumbSchema([['Guides', '/guides/'], ...(topic ? [[topic.name, `/topics/${topic.slug}/`]] : []), [g.title, path]]),
  ];
  if (g.faq.length) schema.push({ '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: g.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  write(path, layout({
    title: g.title, description: g.description, path, schema, image: share,
    kind: 'guide',
    body: `<header class="article-head" style="--tint:${tintFor(g.category)}"><div class="wrap head-grid">
<div class="head-copy">
<p class="crumbs"><a href="/guides/">Guides</a>${topic ? `<span aria-hidden="true">/</span><a href="/topics/${topic.slug}/">${esc(topic.name)}</a>` : g.category ? `<span aria-hidden="true">/</span>${esc(g.category)}` : ''}</p>
<h1>${esc(g.title)}</h1>
<p class="lead">${esc(g.description)}</p>
<dl class="meta"><div><dt>Written by</dt><dd>The ${esc(config.name)} editorial team</dd></div><div><dt>Last reviewed</dt><dd>${esc(longDate(reviewed))}</dd></div><div><dt>Reading time</dt><dd>${g.minutes} minutes</dd></div></dl>
</div>
${g.image ? `<figure class="head-photo">${photo(g.image, g.imageAlt, { w: 720, h: 540, sizes: '(max-width: 760px) 100vw, 360px', eager: true })}</figure>`
  : `<span class="head-art patch-stage" aria-hidden="true">${CLOTH}${patchBlock(g, 'p-head', 28)}</span>`}
</div></header>
<div class="wrap article-grid">
<article class="post">
${g.affiliate ? disclosure : ''}
${g.toc.length > 2 ? `<details class="toc toc-inline"><summary>In this guide</summary><ol>${g.toc.map(h => `<li><a href="#${h.id}">${h.text}</a></li>`).join('')}</ol></details>` : ''}
${g.html}
<div class="picks"><div><strong>Need the right kit?</strong><span>See our picks of irons, heat presses, fabric glues and sewing kit.</span></div><a class="button" href="/best-patch-supplies/">See our supply picks</a></div>
<p class="trust-line">Based on manufacturer instructions and established sewing practice. <a href="/about/#how-we-write-our-guides">How we write our guides</a>.</p>
</article>
${g.toc.length > 2 ? `<aside class="sidebar"><nav class="toc" aria-label="In this guide"><p class="toc-title">In this guide</p><ol>${g.toc.map(h => `<li><a href="#${h.id}">${h.text}</a></li>`).join('')}</ol></nav></aside>` : ''}
</div>
${more.length ? `<section class="band related"><div class="wrap"><div class="section-head"><h2>Keep <em>reading</em></h2><a href="/guides/">All guides →</a></div><ul class="cards">${more.map(card).join('')}</ul></div></section>` : ''}`
  }));
}

for (const p of pages) {
  write(`/${p.slug}/`, layout({ title: p.title, description: p.description, path: `/${p.slug}/`,
    body: `<header class="page-head"><div class="wrap narrow"><h1>${esc(p.title)}</h1>${['best-patch-supplies', 'patch-planner'].includes(p.slug) ? `<p class="lead">${esc(p.description)}</p>` : ''}</div></header><div class="wrap narrow"><article class="post">${p.affiliate ? disclosure : ''}${p.html}</article></div>` }));
}

const used = TOPICS.filter(t => guides.some(g => g.category === t.name));
const unknown = [...new Set(guides.map(g => g.category).filter(c => c && !topicFor(c)))];
if (unknown.length) console.warn(`Unknown categories (add them to TOPICS in build.mjs): ${unknown.join(', ')}`);

for (const t of used) {
  const list = guides.filter(g => g.category === t.name);
  write(`/topics/${t.slug}/`, layout({ title: `${t.name} guides`, description: `${t.blurb} Practical guides from ${config.name}.`,
    path: `/topics/${t.slug}/`, image: ogFor(t.name),
    schema: crumbSchema([['Guides', '/guides/'], [t.name, `/topics/${t.slug}/`]]),
    body: `<header class="page-head" style="--tint:${t.tint}"><div class="wrap page-head-grid"><div><p class="crumbs"><a href="/guides/">Guides</a> <span aria-hidden="true">/</span> ${esc(t.name)}</p><h1>${esc(t.name)}</h1><p class="lead">${esc(t.blurb)}</p></div>
<span class="head-icon"><img src="/img/icons/${t.slug}.svg" alt="" width="140" height="140"></span></div></header>
<div class="wrap section"><h2 class="visually-hidden">Guides</h2><ul class="cards">${list.map(card).join('')}</ul></div>` }));
}

write('/guides/', layout({ title: 'All guides', description: `Every ${config.name} guide to patching, mending and caring for your clothes, grouped by topic.`, path: '/guides/',
  body: `<header class="page-head"><div class="wrap"><h1>All guides</h1><p class="lead">${guides.length} practical guides, grouped by topic.</p></div></header><div class="wrap">` + [...used.map(t => t.name), ...unknown].map(c => {
    const t = topicFor(c);
    return `<section class="section"><h2>${t ? `<a href="/topics/${t.slug}/">${esc(c)}</a>` : esc(c)}</h2><ul class="cards">${guides.filter(g => g.category === c).map(card).join('')}</ul></section>`;
  }).join('') + '</div>' }));

// Homepage hero: the back of a denim jacket with 3D patches stitched on, pinned with tailor's notes.
// Each patch is a front face, a few edge layers behind it for thickness, and a silver heat-seal back you see when it flips.
const STITCH_CREAM = 'fill="none" stroke="#f6efe2" stroke-width="3.5" stroke-dasharray="6 4.5" stroke-linecap="round"';
const FACES = {
  star: `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="58" fill="#c2522b"/><circle cx="60" cy="60" r="48" ${STITCH_CREAM}/><path d="M60 27l9.2 20.4 22.3 2.3-16.8 14.9 4.9 21.9L60 75.3 40.4 86.5l4.9-21.9-16.8-14.9 22.3-2.3z" fill="#e9c46a"/></svg>`,
  oval: `<svg viewBox="0 0 160 100"><ellipse cx="80" cy="50" rx="78" ry="48" fill="#f3e9d6"/><ellipse cx="80" cy="50" rx="67" ry="38" fill="none" stroke="#c2522b" stroke-width="3.5" stroke-dasharray="6 4.5" stroke-linecap="round"/><text x="80" y="60" text-anchor="middle" font-family="'Lilita One', Impact, sans-serif" font-size="26" letter-spacing="2" fill="#1b2236">MEND IT</text></svg>`,
  hex: `<svg viewBox="0 0 120 120"><path d="M60 2l52 29v58l-52 29-52-29V31z" fill="#e9c46a"/><path d="M60 14l41 23v46l-41 23-41-23V37z" fill="none" stroke="#1b2236" stroke-width="3.5" stroke-dasharray="6 4.5" stroke-linecap="round"/><path d="M80 34L42 90" stroke="#1b2236" stroke-width="6" stroke-linecap="round"/><ellipse cx="77" cy="39" rx="3" ry="7" transform="rotate(34 77 39)" fill="#e9c46a"/><path d="M77 39q-34 8-28 36" stroke="#c2522b" stroke-width="3.5" fill="none" stroke-linecap="round"/></svg>`,
  heart: `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="58" fill="#b8475f"/><circle cx="60" cy="60" r="47" ${STITCH_CREAM}/><path d="M60 90S30 70 30 51a15 15 0 0 1 30-5.5A15 15 0 0 1 90 51c0 19-30 39-30 39z" fill="#f3e9d6"/></svg>`,
  leaf: `<svg viewBox="0 0 120 120"><rect x="2" y="2" width="116" height="116" rx="24" fill="#4f7a5a"/><rect x="12" y="12" width="96" height="96" rx="17" ${STITCH_CREAM}/><path d="M36 84C36 50 58 34 86 34c0 32-18 50-50 50z" fill="#e9c46a"/><path d="M38 82L74 46" stroke="#4f7a5a" stroke-width="3.5" stroke-linecap="round"/></svg>`,
};
const HERO_PATCHES = [
  ['star', 34, 'left:18%;top:30%;width:25%', 'p-flip'],
  ['hex', 26, 'left:57%;top:27%;width:22%', ''],
  ['oval', 22, 'left:31%;top:55%;width:38%;aspect-ratio:1.6', ''],
  ['heart', 30, 'left:21%;top:76%;width:16%', ''],
  ['leaf', 24, 'left:62%;top:73%;width:17%', ''],
];
const heroScene = `<div class="hero-art">
<div class="jacket" aria-hidden="true"><div class="jacket-tilt">
<svg class="jacket-svg" viewBox="0 0 440 480"><defs>
<pattern id="twill" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-62)"><rect width="7" height="7" fill="var(--denim)"/><rect width="2.6" height="7" fill="var(--denim-hi)"/></pattern>
<radialGradient id="fold" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></radialGradient></defs>
<path id="jk" d="M140 44Q220 64 300 44L362 74 404 312 362 326 340 168V452H100V168L78 326 36 312 78 74Z" fill="url(#twill)"/>
<use href="#jk" fill="url(#fold)"/>
<path d="M140 44Q220 74 300 44Q282 24 220 28Q158 24 140 44Z" fill="var(--denim-dk)"/>
<path d="M100 140Q220 166 340 140M160 156V418M280 156V418M100 418H340" fill="none" stroke="var(--denim-dk)" stroke-width="3"/>
<path d="M100 148Q220 174 340 148M100 426H340M168 160V412M288 160V412M92 316L64 312" fill="none" stroke="var(--topstitch)" stroke-width="2" stroke-dasharray="5 3.5" stroke-linecap="round"/>
<path d="M74 300L40 288M366 300L400 288" fill="none" stroke="var(--denim-dk)" stroke-width="3"/>
<path d="M100 134Q220 160 340 134" fill="none" stroke="var(--topstitch)" stroke-width="2" stroke-dasharray="5 3.5" stroke-linecap="round"/>
<g fill="var(--denim-dk)"><rect x="108" y="430" width="8" height="16" rx="2"/><rect x="324" y="430" width="8" height="16" rx="2"/></g>
<path d="M140 44Q220 64 300 44L362 74 404 312 362 326 340 168V452H100V168L78 326 36 312 78 74Z" fill="none" stroke="var(--denim-dk)" stroke-width="3" stroke-linejoin="round"/>
</svg>
${HERO_PATCHES.map(([f, z, pos, extra]) => patch3d(`p-${f} ${extra}`, FACES[f], z, pos)).join('')}
</div></div>
<p class="note n1" aria-hidden="true"><span>Iron-on</span> No steam, 30–45 seconds, then press from inside</p>
<p class="note n2" aria-hidden="true"><span>Sew-on</span> Whip stitch, 3 mm in from the edge</p>
<p class="note n3" aria-hidden="true">Tap a patch to flip it</p>
</div>`;
// A tailor's tape measure along the foot of the hero, in centimetres.
const tape = `<div class="tape" aria-hidden="true"><div class="tape-inner">${Array.from({ length: 80 }, (_, i) => `<span>${i + 1}</span>`).join('')}</div></div>`;
// Washing symbols for the care label.
const CARE = {
  wash: '<svg viewBox="0 0 40 40"><path d="M5 12l4 20h22l4-20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M5 12q5 4 10 0t10 0 10 0" fill="none" stroke="currentColor" stroke-width="2.2"/><text x="20" y="28" text-anchor="middle" font-size="10" font-family="var(--mono)" fill="currentColor">30</text></svg>',
  iron: '<svg viewBox="0 0 40 40"><path d="M6 30h29v-4c0-8-5-13-13-13h-9l-1.5 3H22c5 0 8 3 9 7H9z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="16" cy="25" r="1.6" fill="currentColor"/><circle cx="21" cy="25" r="1.6" fill="currentColor"/><circle cx="26" cy="25" r="1.6" fill="currentColor"/></svg>',
  nosteam: '<svg viewBox="0 0 40 40"><path d="M6 30h29v-4c0-8-5-13-13-13h-9l-1.5 3H22c5 0 8 3 9 7H9z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M14 36l3-5M20 36l3-5M26 36l3-5" stroke="currentColor" stroke-width="2"/><path d="M6 8l28 28" stroke="currentColor" stroke-width="2.2"/></svg>',
  notumble: '<svg viewBox="0 0 40 40"><rect x="6" y="6" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="20" cy="20" r="9.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M6 6l28 28M34 6L6 34" stroke="currentColor" stroke-width="2.2"/></svg>',
  dry: '<svg viewBox="0 0 40 40"><rect x="6" y="6" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M20 6v28" stroke="currentColor" stroke-width="2.2"/></svg>',
};
const SHORT = { 'how-to-iron-on-a-patch': 'Ironing on', 'how-to-patch-a-hole-in-jeans': 'Holes in jeans', 'how-to-sew-on-a-button': 'Buttons',
  'how-to-darn-a-hole-in-a-jumper': 'Darning', 'how-to-sew-on-a-patch-by-hand': 'Sewing on', 'how-to-wash-clothes-with-patches': 'Washing' };
const popular = Object.entries(SHORT).map(([slug, short]) => ({ ...guides.find(g => g.slug === slug), short })).filter(g => g.slug).slice(0, 6);

// The free patch layout tool. The drawing and controls are filled in by public/tool.js.
write(TOOL_PATH, layout({ title: 'Free patch layout tool: plan your patches online', path: TOOL_PATH, image: ogFor('Projects and ideas'),
  description: 'Plan where your patches go before you iron or sew. Pick a jacket, backpack, cap or jeans, drag patches into place at real sizes, and save a picture. Free, no sign-up.',
  schema: { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Patch layout tool', url: `${config.url}${TOOL_PATH}`, applicationCategory: 'DesignApplication',
    operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' }, publisher: org },
  body: `<header class="page-head" style="--tint:#c2522b"><div class="wrap"><p class="crumbs"><a href="/">Home</a> <span aria-hidden="true">/</span> Patch layout tool</p>
<h1>Free patch layout tool</h1>
<p class="lead">Try out your patches on a jacket, backpack, cap or jeans before the iron comes out. Drag them about, resize them to real sizes and save a picture of your layout.</p></div></header>
<section class="wrap layout-tool">
<div class="stage"><svg viewBox="0 0 400 440" role="img" aria-label="Your garment with its patches. Drag a patch to move it."></svg>
<p class="stage-note"><span class="count"></span> · Sizes are for an adult medium, so treat them as a guide.</p></div>
<div class="controls">
<fieldset><legend>1. Pick a garment</legend><div class="pills garment-picks"></div><div class="swatches garment-colours"></div></fieldset>
<fieldset><legend>2. Add a patch</legend><div class="shape-picks"></div></fieldset>
<fieldset><legend>3. Style your patch</legend>
<p class="edit-empty">Tap a patch to change its colour, words, size or angle. Drag it to move it.</p>
<div class="edit" hidden>
<div class="swatches patch-colours"></div>
<label for="pt-text">Words <small>(up to 14 letters)</small></label><input id="pt-text" type="text" maxlength="14" autocomplete="off" placeholder="e.g. MEND IT">
<label for="pt-size">Size <output id="pt-size-out" for="pt-size"></output></label><input id="pt-size" type="range" min="2" max="40" step="0.5">
<label for="pt-rot">Angle <output id="pt-rot-out" for="pt-rot"></output></label><input id="pt-rot" type="range" min="-180" max="180" step="1">
<div class="pills"><button type="button" data-act="front">Bring to front</button><button type="button" data-act="copy">Duplicate</button><button type="button" data-act="delete" class="danger">Remove</button></div>
</div></fieldset>
<div class="tool-actions"><button type="button" class="button" data-act="png">Save picture</button><button type="button" class="button ghost" data-act="link">Copy share link</button><button type="button" class="link-button" data-act="reset">Start again</button></div>
</div>
<noscript><p>The layout tool needs JavaScript. Our printable <a href="/patch-planner/">Patch Placement Planner</a> works on paper instead.</p></noscript>
</section>
<section class="wrap narrow tool-help post">
<h2>How to use your layout</h2>
<ol><li><strong>Measure your real patches</strong> and set each one to its width in centimetres, so the layout matches what you've got.</li>
<li><strong>Leave a gap</strong> of about 1 cm (⅜ in) between patches and keep them off thick seams, which stop an iron pressing evenly.</li>
<li><strong>Save a picture</strong> and keep it open on your phone while you pin the patches in place.</li>
<li><strong>Then fix them on</strong>: see <a href="/guides/how-to-iron-on-a-patch/">how to iron on a patch</a> or <a href="/guides/how-to-sew-on-a-patch-by-hand/">how to sew one on</a>.</li></ol>
<p>Looking for ideas? Read <a href="/guides/where-to-put-patches-on-a-denim-jacket/">where to put patches on a denim jacket</a> and <a href="/guides/how-to-put-patches-on-a-backpack/">how to put patches on a backpack</a>.</p>
</section>
<section class="planner-band"><div class="wrap planner-grid">
<div class="planner-copy"><p class="eyebrow">Prefer paper?</p><h2>The printable Patch Placement Planner</h2>
<p>Templates for jackets, bags, caps and jeans, an actual-size patch guide and a care cheat sheet, ready to print and sketch on.</p>
<a class="button" href="/patch-planner/">See the planner</a></div>
<a class="planner-fan" href="/patch-planner/" aria-label="See the Patch Placement Planner"><img src="/img/planner/page-4.jpg" alt="" width="600" height="849" loading="lazy"><img src="/img/planner/page-8.jpg" alt="" width="600" height="849" loading="lazy"><img src="/img/planner/page-1.jpg" alt="" width="600" height="849" loading="lazy"></a>
</div></section>
<script defer src="/tool.js?v=${toolVersion}"></script>` }));

writeFileSync(join(OUT, 'index.html'), layout({ title: config.name, description: 'Step-by-step UK guides to patching and mending clothes: ironing on and sewing on patches, fixing holes, darning and buttons, plus a free patch layout tool.', path: '/',
  schema: { '@context': 'https://schema.org', '@type': 'WebSite', name: config.name, url: config.url },
  kind: 'home',
  body: `<section class="hero">
<div class="wrap hero-grid">
<div class="hero-copy">
<p class="label rise" style="--d:0ms"><span class="dot"></span>A UK field guide to patching and mending</p>
<h1 class="display"><span class="ln"><span style="--d:60ms">Patch it,</span></span> <span class="ln"><span style="--d:140ms">mend it,</span></span> <span class="ln"><span style="--d:220ms"><em>keep wearing it.</em></span></span></h1>
<p class="lead rise" style="--d:320ms">Clear, step-by-step guides to ironing and sewing on patches, fixing holes, darning and visible mending. Written for real clothes and real irons, with the kit that makes it easy.</p>
<div class="cta rise" style="--d:400ms"><a class="button" href="/guides/">Browse the guides <span aria-hidden="true">→</span></a><a class="button ghost" href="${TOOL_PATH}">Plan your patches</a></div>
<nav class="quick rise" style="--d:480ms" aria-label="Most read guides"><span class="label">Most read</span><ul>${popular.map(g => `<li><a href="/guides/${g.slug}/">${esc(g.short)}</a></li>`).join('')}</ul></nav>
</div>
${heroScene}
</div>
${tape}
</section>

<section class="promise" aria-label="How we write our guides"><div class="wrap"><ul>
<li><span class="label">01</span><strong>Step by step</strong><span>Numbered steps you can follow at the ironing board, with times and settings.</span></li>
<li><span class="label">02</span><strong>Fabric-safe</strong><span>Which fabrics can take the heat, and what to do when they can't.</span></li>
<li><span class="label">03</span><strong>Kept up to date</strong><span>Every guide shows when it was last reviewed against current instructions.</span></li>
</ul></div></section>

<section class="contents"><div class="wrap contents-grid">
<header class="contents-head">
<p class="label">Contents</p>
<h2>What are you <em>fixing</em> today?</h2>
<p>${guides.length} practical guides in ${used.length} topics, from a peeling patch to a moth hole in your favourite jumper.</p>
<a class="arrow-link" href="/guides/">See every guide <span aria-hidden="true">→</span></a>
</header>
<ol class="index">${used.map((t, i) => { const n = guides.filter(g => g.category === t.name).length; return `<li style="--tint:${t.tint}"><a href="/topics/${t.slug}/"><span class="num">${String(i + 1).padStart(2, '0')}</span><span class="badge"><img src="/img/icons/${t.slug}.svg" alt="" width="44" height="44" loading="lazy"></span><span class="t"><strong>${esc(t.name)}</strong><small>${esc(t.blurb)}</small></span><span class="n">${n} guide${n === 1 ? '' : 's'}</span><span class="go" aria-hidden="true">→</span></a></li>`; }).join('')}</ol>
</div></section>

<section class="latest"><div class="wrap">
<div class="section-head"><h2>Fresh from the <em>workbench</em></h2><a class="arrow-link" href="/guides/">All guides <span aria-hidden="true">→</span></a></div>
${featured(guides[0])}
<ul class="cards">${guides.slice(1, 7).map(card).join('')}</ul>
</div></section>

<section class="workshop"><div class="wrap workshop-grid">
<div class="workshop-intro"><p class="label">Plan it before you press it</p><h2>Try your patches on <em>before</em> the iron comes out</h2></div>
<a class="ws-card ws-tool" href="${TOOL_PATH}">
<span class="ws-art"><svg viewBox="0 0 400 300" aria-hidden="true">
<defs><pattern id="mat" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#fff" stroke-opacity=".12"/></pattern></defs>
<rect width="400" height="300" fill="url(#mat)"/>
<path d="M130 30Q200 46 270 30L318 52 350 230 316 240 300 120V290H100V120L84 240 50 230 82 52Z" fill="#3c568c" stroke="#24345e" stroke-width="3" stroke-linejoin="round"/>
<path d="M130 30Q200 54 270 30Q256 16 200 20Q144 16 130 30Z" fill="#24345e"/><path d="M100 104Q200 124 300 104" fill="none" stroke="#e9c46a" stroke-width="2" stroke-dasharray="5 4"/>
<g transform="translate(200 78)"><path d="M-80-14Q0-56 80-14V16Q0-26-80 16Z" fill="#1b2236"/><text y="-4" text-anchor="middle" font-family="'Lilita One', Impact, sans-serif" font-size="21" fill="#f3e9d6" letter-spacing="2">MY JACKET</text></g>
<g transform="translate(160 172)"><circle r="36" fill="#c2522b"/><circle r="28" fill="none" stroke="#f6efe2" stroke-width="2.5" stroke-dasharray="5 4"/><path d="M0-18l5.5 11.5 12.5 1.5-9.5 8.5 2.8 12.5L0 9.5-11.3 16l2.8-12.5-9.5-8.5 12.5-1.5z" fill="#e9c46a"/></g>
<g class="ws-drag" transform="translate(246 196) rotate(10)"><path d="M0-34L30-26V-2C30 18 16 28 0 34-16 28-30 18-30-2V-26Z" fill="#e9c46a"/><path d="M0-27L24-21V-2C24 14 13 22 0 27-13 22-24 14-24-2V-21Z" fill="none" stroke="#1b2236" stroke-width="2" stroke-dasharray="4 3"/><text y="6" text-anchor="middle" font-family="'Lilita One', Impact, sans-serif" font-size="15" fill="#1b2236">MEND</text>
<path d="M18 22l0 30 8-7 6 13 6-3-6-13h11z" fill="#fff" stroke="#1b2236" stroke-width="2.2" stroke-linejoin="round"/></g></svg></span>
<span class="ws-body"><span class="label">Free online tool</span><strong>Patch layout tool</strong><span>Pick a jacket, backpack, cap or jeans, drag patches into place at real sizes and save a picture. No sign-up.</span><em>Open the tool <span aria-hidden="true">→</span></em></span></a>
<a class="ws-card ws-planner" href="/patch-planner/">
<span class="planner-fan" aria-hidden="true"><img src="/img/planner/page-4.jpg" alt="" width="600" height="849" loading="lazy"><img src="/img/planner/page-8.jpg" alt="" width="600" height="849" loading="lazy"><img src="/img/planner/page-1.jpg" alt="" width="600" height="849" loading="lazy"></span>
<span class="ws-body"><span class="label">Printable</span><strong>Patch Placement Planner</strong><span>Templates for jackets, bags, caps and jeans, a real-size patch guide and a care cheat sheet.</span><em>See the planner <span aria-hidden="true">→</span></em></span></a>
</div></section>

<section class="rules"><div class="wrap rules-grid">
<div class="rules-copy">
<p class="label">Before you press</p>
<h2>Five rules for patches that <em>stay on</em></h2>
<p>Most peeling patches come down to one of these. Get them right and an iron-on patch can last for years of washing.</p>
<a class="arrow-link" href="/guides/how-to-iron-on-a-patch/">Read the full ironing guide <span aria-hidden="true">→</span></a>
</div>
<figure class="care-label">
<div class="care-symbols" aria-hidden="true">${['iron', 'nosteam', 'wash', 'notumble', 'dry'].map(k => CARE[k]).join('')}</div>
<ol>
<li>Check the care label first. If the fabric can't take a hot iron, sew or glue the patch instead.</li>
<li>Turn the steam off and lay a pressing cloth between the iron and the patch.</li>
<li>Press firmly and hold still, rather than sliding the iron around.</li>
<li>Press again from inside the garment, then let it cool completely.</li>
<li>Wait a day before washing, then wash inside out on a cool, gentle cycle.</li>
</ol>
<figcaption>Patched Patches · Care instructions · Keep this label</figcaption>
</figure>
</div></section>

<section class="kit"><div class="wrap">
<div class="section-head"><div><p class="label">The starter kit</p><h2>Three things cover <em>almost every</em> patch job</h2></div><a class="arrow-link" href="/best-patch-supplies/">All our supply picks <span aria-hidden="true">→</span></a></div>
<ul class="pieces">
<li style="--tint:#c2522b"><a href="/guides/best-fabric-glue-for-patches/"><span class="piece-tag">Piece A · Cut 1</span><span class="piece-art"><svg viewBox="0 0 120 120" aria-hidden="true"><g transform="rotate(-14 60 60)"><rect x="34" y="38" width="52" height="68" rx="10" fill="var(--card)" stroke="currentColor" stroke-width="3.5"/><rect x="34" y="58" width="52" height="26" fill="var(--tint)"/><path d="M48 38V26h24v12z" fill="currentColor"/><path d="M56 26l4-16 4 16z" fill="currentColor"/></g></svg></span><strong>Fabric glue</strong><span>For nylon, caps and anything that can't take an iron.</span><em>Choose a glue <span aria-hidden="true">→</span></em></a></li>
<li style="--tint:#2f4d8a"><a href="/guides/best-iron-for-patches/"><span class="piece-tag">Piece B · Cut 1</span><span class="piece-art"><svg viewBox="0 0 120 120" aria-hidden="true"><path d="M18 88h86V76c0-22-14-36-36-36H42l-4 8h28c13 0 22 8 25 20H26z" fill="var(--card)" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><path d="M18 88h86" stroke="var(--tint)" stroke-width="8" stroke-linecap="round"/><path d="M50 40q2-14 18-14h14" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="52" cy="74" r="3" fill="var(--tint)"/><circle cx="64" cy="74" r="3" fill="var(--tint)"/><circle cx="76" cy="74" r="3" fill="var(--tint)"/></svg></span><strong>An iron or mini press</strong><span>Your own iron works. A mini iron makes caps and sleeves easy.</span><em>Compare irons <span aria-hidden="true">→</span></em></a></li>
<li style="--tint:#4f7a5a"><a href="/guides/how-to-sew-on-a-patch-by-hand/"><span class="piece-tag">Piece C · Cut 1</span><span class="piece-art"><svg viewBox="0 0 120 120" aria-hidden="true"><path d="M92 20L30 96" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><ellipse cx="88" cy="25" rx="3" ry="8" transform="rotate(39 88 25)" fill="var(--card)" stroke="currentColor" stroke-width="2"/><path d="M88 25C60 30 40 40 44 62s30 22 26 40" fill="none" stroke="var(--tint)" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 0"/></svg></span><strong>Needle and thread</strong><span>The most permanent way to put a patch on anything.</span><em>Learn to sew one on <span aria-hidden="true">→</span></em></a></li>
</ul>
</div></section>` }));

const newest = guides.map(g => lastmod[`/guides/${g.slug}/`]).sort().pop();
const urls = [['/', newest], ['/guides/', newest], ...used.map(t => [`/topics/${t.slug}/`]),
  ...guides.map(g => [`/guides/${g.slug}/`, lastmod[`/guides/${g.slug}/`]]), ...pages.map(p => [`/${p.slug}/`]), [TOOL_PATH]];
writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, d]) => `  <url><loc>${config.url}${u}</loc>${d ? `<lastmod>${d}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`);
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${config.url}/sitemap.xml\n`);
writeFileSync(join(OUT, '404.html'), layout({ title: 'Page not found', description: 'Page not found', path: '/404',
  body: `<div class="wrap narrow section"><h1>Page not found</h1><p>That page doesn't exist. Try the <a href="/guides/">list of guides</a>.</p></div>` }));

console.log(`Built ${guides.length} guides, ${used.length} topics and ${pages.length} pages into ${OUT}/`);
