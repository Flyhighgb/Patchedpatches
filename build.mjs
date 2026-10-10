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

// Topics shown on the homepage. Each has an illustration in public/img/<slug>.svg
// and a share image in public/og/<slug>.png (made by `npm run og`).
const TOPICS = [
  { name: 'Applying patches', slug: 'applying-patches', tint: '#3f78c9', blurb: 'Ironing on, sewing on and gluing patches so they stay put.' },
  { name: 'Patch care', slug: 'patch-care', tint: '#5cb83c', blurb: 'Washing, fixing peeling edges and removing patches cleanly.' },
  { name: 'Choosing patches', slug: 'choosing-patches', tint: '#e8467c', blurb: 'Embroidered, woven, PVC and chenille, and which backing to pick.' },
  { name: 'Projects and ideas', slug: 'projects-and-ideas', tint: '#ff6b4a', blurb: 'Jackets, bags, denim and making your own patches.' },
  { name: 'Tools and kit', slug: 'tools-and-kit', tint: '#f2a71b', blurb: 'The best irons, heat presses, fabric glues and needles for patches.' },
];
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
const tintFor = category => topicFor(category)?.tint || '#c2571a';
const ogFor = category => existsSync(`public/og/${topicFor(category)?.slug}.png`) ? `/og/${topicFor(category).slug}.png` : '/og/default.png';

function layout({ title, description, path, body, schema, image = '/og/default.png' }) {
  // Google shows about 60 characters of a title, so long titles drop the site name.
  const full = path === '/' ? `${config.name}: ${config.tagline.replace(/\.$/, '')}` : title.length > 48 ? title : `${title} | ${config.name}`;
  const analytics = config.analytics
    ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${esc(config.analytics)}"}'></script>` : '';
  const ads = config.adsenseClient
    ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(config.adsenseClient)}" crossorigin="anonymous"></script>` : '';
  const schemas = [].concat(schema || []);
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
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@400;600;700;800&display=swap">
<link rel="stylesheet" href="/style.css?v=${cssVersion}">
<script defer src="/fx.js?v=${fxVersion}"></script>
${schemas.map(s => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join('\n')}
${ads}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header"><div class="wrap">
  <a class="logo" href="/"><img src="/favicon.svg" alt="" width="32" height="32"> ${esc(config.name)}</a>
  <nav aria-label="Main"><a href="/guides/"><span class="hide-sm">All guides</span><span class="show-sm">Guides</span></a><a class="hide-sm" href="/topics/tools-and-kit/">Tools &amp; kit</a><a href="/best-patch-supplies/"><span class="hide-sm">Best supplies</span><span class="show-sm">Supplies</span></a><a class="hide-sm" href="/about/">About</a></nav>
</div></header>
<main id="main">
${body}
</main>
<footer class="site-footer"><div class="wrap">
  <div class="footer-grid">
    <div><a class="logo" href="/"><img src="/favicon.svg" alt="" width="32" height="32"> ${esc(config.name)}</a>
      <p>${esc(config.tagline)}</p></div>
    <div><h2>Topics</h2><ul>${TOPICS.filter(t => usedNames.has(t.name)).map(t => `<li><a href="/topics/${t.slug}/">${esc(t.name)}</a></li>`).join('')}<li><a href="/best-patch-supplies/">Best patch supplies</a></li><li><a href="/patch-planner/">Patch Placement Planner</a></li></ul></div>
    <div><h2>About us</h2><ul><li><a href="/about/">About</a></li><li><a href="/about/#how-we-write-our-guides">How we write our guides</a></li><li><a href="/affiliate-disclosure/">Affiliate disclosure</a></li><li><a href="/privacy/">Privacy</a></li></ul></div>
  </div>
  <p class="footer-note">Always check the care label on your garment and the instructions that came with your patch, iron or glue. Information here is general guidance.</p>
  <p class="footer-note">© ${new Date().getFullYear()} ${esc(config.name)}.${guides.some(g => g.image) ? ' Photos from <a href="https://unsplash.com/?utm_source=patchedpatches&amp;utm_medium=referral">Unsplash</a>.' : ''}</p>
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
const STITCH = 'fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="7 5" stroke-linecap="round"';

// Every guide gets its own embroidered patch, drawn from `patch:` (two words split by |) and `shape:` in its front matter.
const SHAPES = {
  circle: { svg: '<circle cx="60" cy="60" r="57"/>', clip: 'circle(48% at 50% 50%)' },
  square: { svg: '<rect x="4" y="4" width="112" height="112" rx="22"/>', clip: 'inset(3% round 18%)' },
  hex: { svg: '<path d="M60 3l51 28.5v57L60 117 9 88.5v-57z"/>', clip: 'polygon(50% 2%, 93% 26%, 93% 74%, 50% 98%, 7% 74%, 7% 26%)' },
  oval: { svg: '<ellipse cx="60" cy="60" rx="57" ry="40"/>', clip: 'ellipse(48% 34% at 50% 50%)' },
  shield: { svg: '<path d="M60 4l52 14v40c0 30-24 50-52 58C32 108 8 88 8 58V18z"/>', clip: 'polygon(50% 3%, 93% 15%, 93% 50%, 82% 78%, 50% 97%, 18% 78%, 7% 50%, 7% 15%)' },
};
const LIGHT_TINTS = ['#f2a71b', '#ffd23f'];
function patchSvg(g, cls = '') {
  const shape = SHAPES[g.shape] || SHAPES.circle;
  const tint = tintFor(g.category);
  const ink = LIGHT_TINTS.includes(tint) ? '#1f3a5f' : '#fff';
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
  : `<span class="thumb patch-thumb">${patchSvg(g)}</span>`;

const disclosure = `<p class="disclosure">This page contains affiliate links. If you buy through them we may earn a small commission, at no extra cost to you. As an Amazon Associate we earn from qualifying purchases. <a href="/affiliate-disclosure/">Learn more</a>.</p>`;


function card(g) {
  return `<li class="card" style="--tint:${tintFor(g.category)}"><a href="/guides/${g.slug}/">
${thumbFor(g)}
<span class="card-body">${g.category ? `<span class="chip">${esc(g.category)}</span>` : ''}<h3>${esc(g.title)}</h3><p>${esc(g.description)}</p><span class="read">${g.minutes} min read</span></span></a></li>`;
}

function featured(g) {
  return `<a class="featured" style="--tint:${tintFor(g.category)}" href="/guides/${g.slug}/">
${g.image ? `<span class="featured-photo">${photo(g.image, '', { w: 900, h: 600, sizes: '(max-width: 760px) 100vw, 560px' })}</span>` : `<span class="featured-photo thumb patch-stage" aria-hidden="true">${patchBlock(g, 'p-featured', 30)}</span>`}
<span class="featured-body"><span class="kicker">New guide</span>${g.category ? `<span class="chip">${esc(g.category)}</span>` : ''}<h3>${esc(g.title)}</h3><p>${esc(g.description)}</p><span class="more">Read the guide <span aria-hidden="true">→</span></span></span></a>`;
}

function topicTile(t, count) {
  return `<li class="topic" style="--tint:${t.tint}"><a href="/topics/${t.slug}/"><span class="icon"><img src="/img/icons/${t.slug}.svg" alt="" width="48" height="48"></span>
<span><strong>${esc(t.name)}</strong><small>${esc(t.blurb)}</small><span class="count">${count} guide${count === 1 ? '' : 's'} →</span></span></a></li>`;
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
    body: `<header class="page-head" style="--tint:${tintFor(g.category)}"><div class="wrap page-head-grid">
<div>
<p class="crumbs"><a href="/guides/">Guides</a>${topic ? ` › <a href="/topics/${topic.slug}/">${esc(topic.name)}</a>` : g.category ? ` › ${esc(g.category)}` : ''}</p>
<h1>${esc(g.title)}</h1>
<p class="lead">${esc(g.description)}</p>
<p class="meta"><span>By the ${esc(config.name)} editorial team</span><span>Last reviewed ${esc(longDate(reviewed))}</span><span>${g.minutes} min read</span></p>
</div>
${g.image ? `<figure class="head-photo">${photo(g.image, g.imageAlt, { w: 720, h: 540, sizes: '(max-width: 760px) 100vw, 360px', eager: true })}</figure>`
  : `<span class="head-icon patch-stage" aria-hidden="true">${patchBlock(g, 'p-head', 28)}</span>`}
</div></header>
<div class="wrap article-grid">
<article class="post">
${g.affiliate ? disclosure : ''}
${g.toc.length > 2 ? `<details class="toc toc-inline"><summary>In this guide</summary><ol>${g.toc.map(h => `<li><a href="#${h.id}">${h.text}</a></li>`).join('')}</ol></details>` : ''}
${g.html}
<div class="picks"><div><strong>Need the right kit?</strong><span>See our picks of irons, heat presses, fabric glues and needles for patches.</span></div><a class="button" href="/best-patch-supplies/">See our supply picks</a></div>
<p class="trust-line">Based on manufacturer instructions and established sewing practice. <a href="/about/#how-we-write-our-guides">How we write our guides</a>.</p>
</article>
${g.toc.length > 2 ? `<aside class="sidebar"><nav class="toc" aria-label="In this guide"><p class="toc-title">In this guide</p><ol>${g.toc.map(h => `<li><a href="#${h.id}">${h.text}</a></li>`).join('')}</ol></nav></aside>` : ''}
</div>
${more.length ? `<section class="band"><div class="wrap"><h2>Related guides</h2><ul class="cards">${more.map(card).join('')}</ul></div></section>` : ''}`
  }));
}

for (const p of pages) {
  write(`/${p.slug}/`, layout({ title: p.title, description: p.description, path: `/${p.slug}/`,
    body: `<header class="page-head"><div class="wrap"><h1>${esc(p.title)}</h1>${['best-patch-supplies', 'patch-planner'].includes(p.slug) ? `<p class="lead">${esc(p.description)}</p>` : ''}</div></header><div class="wrap narrow"><article class="post">${p.affiliate ? disclosure : ''}${p.html}</article></div>` }));
}

const used = TOPICS.filter(t => guides.some(g => g.category === t.name));
const unknown = [...new Set(guides.map(g => g.category).filter(c => c && !topicFor(c)))];
if (unknown.length) console.warn(`Unknown categories (add them to TOPICS in build.mjs): ${unknown.join(', ')}`);

for (const t of used) {
  const list = guides.filter(g => g.category === t.name);
  write(`/topics/${t.slug}/`, layout({ title: `${t.name} guides`, description: `${t.blurb} Practical guides from ${config.name}.`,
    path: `/topics/${t.slug}/`, image: ogFor(t.name),
    schema: crumbSchema([['Guides', '/guides/'], [t.name, `/topics/${t.slug}/`]]),
    body: `<header class="page-head" style="--tint:${t.tint}"><div class="wrap page-head-grid"><div><p class="crumbs"><a href="/guides/">Guides</a> › ${esc(t.name)}</p><h1>${esc(t.name)}</h1><p class="lead">${esc(t.blurb)}</p></div>
<span class="head-icon"><img src="/img/icons/${t.slug}.svg" alt="" width="140" height="140"></span></div></header>
<div class="wrap section"><h2 class="visually-hidden">Guides</h2><ul class="cards">${list.map(card).join('')}</ul></div>` }));
}

write('/guides/', layout({ title: 'All guides', description: `Every ${config.name} guide to applying, caring for and choosing patches, grouped by topic.`, path: '/guides/',
  body: `<header class="page-head"><div class="wrap"><h1>All guides</h1><p class="lead">${guides.length} practical guides, grouped by topic.</p></div></header><div class="wrap">` + [...used.map(t => t.name), ...unknown].map(c => {
    const t = topicFor(c);
    return `<section class="section"><h2>${t ? `<a href="/topics/${t.slug}/">${esc(c)}</a>` : esc(c)}</h2><ul class="cards">${guides.filter(g => g.category === c).map(card).join('')}</ul></section>`;
  }).join('') + '</div>' }));

// Homepage hero: a sunny washing line of clothes covered in 3D patches.
// Each patch is a front face, a few edge layers behind it for thickness, and a silver heat-seal back you see when it flips.
const FACES = {
  star: `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="58" fill="#ff6b4a"/><circle cx="60" cy="60" r="47" ${STITCH}/><path d="M60 26l9.5 21 23 2.4-17.3 15.3 5 22.6L60 75.6 39.8 87.3l5-22.6L27.5 49.4l23-2.4z" fill="#ffd23f"/></svg>`,
  pp: `<svg viewBox="0 0 120 120"><rect x="2" y="2" width="116" height="116" rx="22" fill="#e8467c"/><rect x="12" y="12" width="96" height="96" rx="15" ${STITCH}/><text x="60" y="78" text-anchor="middle" font-family="'Lilita One', Impact, sans-serif" font-size="50" fill="#fff">PP</text></svg>`,
  hex: `<svg viewBox="0 0 120 120"><path d="M60 2l52 29v58l-52 29-52-29V31z" fill="#ffd23f"/><path d="M60 14l41 23v46l-41 23-41-23V37z" fill="none" stroke="#1f3a5f" stroke-width="4" stroke-dasharray="7 5" stroke-linecap="round"/><path d="M78 36L44 88" stroke="#1f3a5f" stroke-width="6" stroke-linecap="round"/><ellipse cx="76" cy="40" rx="3" ry="7" transform="rotate(33 76 40)" fill="#ffd23f"/><path d="M76 40q-30 10-26 34" stroke="#e8467c" stroke-width="3.5" fill="none" stroke-linecap="round"/></svg>`,
  oval: `<svg viewBox="0 0 160 100"><ellipse cx="80" cy="50" rx="78" ry="48" fill="#1f3a5f"/><ellipse cx="80" cy="50" rx="66" ry="37" ${STITCH}/><text x="80" y="60" text-anchor="middle" font-family="'Lilita One', Impact, sans-serif" font-size="25" letter-spacing="2" fill="#ffd23f">IRON ON</text></svg>`,
  bolt: `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="58" fill="#5cb83c"/><circle cx="60" cy="60" r="46" ${STITCH}/><path d="M66 22L38 66h22l-6 32 28-46H60z" fill="#fff"/></svg>`,
  heart: `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="58" fill="#fff4d6"/><circle cx="60" cy="60" r="46" fill="none" stroke="#ff6b4a" stroke-width="4" stroke-dasharray="7 5" stroke-linecap="round"/><path d="M60 92S28 70 28 50a16 16 0 0 1 32-6 16 16 0 0 1 32 6c0 20-32 42-32 42z" fill="#e8467c"/></svg>`,
  flower: `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="58" fill="#7ad0f0"/><circle cx="60" cy="60" r="46" ${STITCH}/><g fill="#fff">${[0, 60, 120, 180, 240, 300].map(a => `<ellipse cx="60" cy="38" rx="11" ry="17" transform="rotate(${a} 60 60)"/>`).join('')}</g><circle cx="60" cy="60" r="12" fill="#ffd23f"/></svg>`,
};
const PEG = '<span class="peg"></span>';
const GARMENTS = [
  ['g-tee', `<svg viewBox="0 0 200 200"><path d="M62 18l-50 30 22 38 24-12v112h84V74l24 12 22-38-50-30q-38 26-76 0z" fill="#ff6b4a" stroke="#c94a2c" stroke-width="4" stroke-linejoin="round"/><path d="M62 18q38 26 76 0" fill="none" stroke="#c94a2c" stroke-width="4"/></svg>`,
    [['heart', 26, 'left:30%;top:36%;width:40%']]],
  ['g-jacket', `<svg viewBox="0 0 200 220"><path d="M58 14l-42 22-8 150 32 6 6-110v134h108V82l6 110 32-6-8-150-42-22q-42 22-84 0z" fill="#3f78c9" stroke="#285ea8" stroke-width="4" stroke-linejoin="round"/><path d="M100 30v186M58 14l42 40 42-40" fill="none" stroke="#285ea8" stroke-width="4"/><path d="M52 150h96" stroke="#ffd23f" stroke-width="3" stroke-dasharray="6 5"/></svg>`,
    [['star', 40, 'left:16%;top:22%;width:36%'], ['pp', 28, 'left:56%;top:26%;width:28%'], ['oval', 22, 'left:18%;top:52%;width:40%;aspect-ratio:1.6'], ['bolt', 30, 'left:60%;top:54%;width:22%']]],
  ['g-cap', `<svg viewBox="0 0 200 140"><path d="M30 104q0-84 80-84t70 84z" fill="#ffd23f" stroke="#d9a90f" stroke-width="4"/><path d="M14 104h180q-10 20-60 20H40q-26 0-26-20z" fill="#f2a71b" stroke="#d9a90f" stroke-width="4"/><circle cx="106" cy="22" r="7" fill="#d9a90f"/></svg>`,
    [['hex', 26, 'left:36%;top:28%;width:34%']]],
  ['g-tote', `<svg viewBox="0 0 200 220"><path d="M62 70V48a38 38 0 0 1 76 0v22" fill="none" stroke="#3e9a2c" stroke-width="10"/><path d="M28 70h144l-10 140H38z" fill="#7cc444" stroke="#3e9a2c" stroke-width="4" stroke-linejoin="round"/></svg>`,
    [['flower', 30, 'left:20%;top:42%;width:34%'], ['bolt', 22, 'left:56%;top:62%;width:24%']]],
];
const garment = ([cls, svg, patches]) => `<div class="garment ${cls}">${PEG}${PEG}${svg}${patches.map(([f, z, pos], i) => patch3d(`p-${f}${cls === 'g-jacket' && i === 0 ? ' p-flip' : ''}`, FACES[f], z, pos)).join('')}</div>`;
const heroScene = `<div class="scene" aria-hidden="true">
<span class="sun"></span><span class="cloud c1"></span><span class="cloud c2"></span><span class="cloud c3"></span>
<svg class="hills" viewBox="0 0 1440 220" preserveAspectRatio="none"><path d="M0 120 C 200 40, 380 60, 560 110 S 900 40, 1100 90 S 1340 60, 1440 80 V220 H0z" class="hill-back"/><path d="M0 170 C 240 110, 420 150, 640 160 S 1000 100, 1220 140 S 1400 150, 1440 140 V220 H0z" class="hill-front"/>
<g class="flowers">${[[90, 168, '#fff'], [130, 176, '#ffd23f'], [330, 158, '#e8467c'], [370, 166, '#fff'], [760, 170, '#ffd23f'], [980, 150, '#fff'], [1030, 160, '#e8467c'], [1330, 160, '#ffd23f'], [1380, 170, '#fff']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="5" fill="${c}"/><circle cx="${x}" cy="${y}" r="2" fill="#f2a71b"/>`).join('')}</g></svg>
<div class="basket"><svg viewBox="0 0 140 100"><g transform="rotate(-14 44 26)"><circle cx="44" cy="30" r="22" fill="#e8467c"/><circle cx="44" cy="30" r="17" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="5 4"/></g><g transform="rotate(10 92 24)"><rect x="70" y="4" width="42" height="42" rx="9" fill="#ffd23f"/><rect x="75" y="9" width="32" height="32" rx="6" fill="none" stroke="#1f3a5f" stroke-width="2.5" stroke-dasharray="5 4"/></g><circle cx="68" cy="36" r="16" fill="#5cb83c"/><circle cx="68" cy="36" r="12" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="5 4"/><path d="M8 42h124l-12 54H20z" fill="#d7a663"/><path d="M14 56h112M18 70h104M22 84h96" stroke="#b9874a" stroke-width="3"/><path d="M40 42l-6 54M70 42v54M100 42l6 54" stroke="#b9874a" stroke-width="3"/><rect x="4" y="38" width="132" height="10" rx="5" fill="#c79a5b"/></svg></div>
<div class="line"><span class="pole pole-l"></span><span class="pole pole-r"></span>
<svg class="rope" viewBox="0 0 1000 60" preserveAspectRatio="none"><path d="M0 6 Q 500 70 1000 6"/></svg>
<span class="bird"><svg viewBox="0 0 60 44"><path d="M8 26c0-12 10-20 22-20 8 0 14 4 16 10l10 2-9 5c-1 10-9 17-21 17C14 40 8 34 8 26z" fill="#1f3a5f"/><path d="M14 24c6 8 16 8 22 2-8 2-16 0-22-2z" fill="#7ad0f0"/><circle cx="38" cy="15" r="2.6" fill="#fff"/><path d="M28 40l-2 4M34 40l2 4" stroke="#f2a71b" stroke-width="2.5" stroke-linecap="round"/><path d="M8 24L1 18l3 10z" fill="#1f3a5f"/></svg></span>
<div class="garments">${GARMENTS.map(garment).join('')}</div></div>
</div>`;
const SHORT = { 'how-to-iron-on-a-patch': 'Ironing on', 'how-to-sew-on-a-patch-by-hand': 'Sewing on', 'how-to-remove-an-iron-on-patch': 'Removing',
  'how-to-wash-clothes-with-patches': 'Washing', 'iron-on-vs-sew-on-patches': 'Iron-on vs sew-on' };
const popular = Object.entries(SHORT).map(([slug, short]) => ({ ...guides.find(g => g.slug === slug), short })).filter(g => g.slug).slice(0, 5);

writeFileSync(join(OUT, 'index.html'), layout({ title: config.name, description: 'Step-by-step UK guides to ironing on, sewing on, washing and removing patches, plus the best glues, irons and heat presses for the job.', path: '/',
  schema: { '@context': 'https://schema.org', '@type': 'WebSite', name: config.name, url: config.url },
  body: `<section class="hero sunny">
<div class="wrap hero-copy">
<p class="eyebrow">Patches, in plain English</p>
<h1>Get your patch on, and <span class="sewn">keep it on!<svg class="stitch-line" viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true"><defs><mask id="sew"><path class="sew-reveal" d="M4 14 C 70 4, 130 22, 190 12 S 280 6, 296 12" stroke="#fff" stroke-width="10" fill="none" pathLength="1"/></mask></defs><path d="M4 14 C 70 4, 130 22, 190 12 S 280 6, 296 12" mask="url(#sew)"/></svg></span></h1>
<p class="lead">Friendly, step-by-step guides to ironing on, sewing on, washing and removing patches, plus the kit that makes it easy.</p>
<p class="quick"><span>Popular:</span> ${popular.map(g => `<a href="/guides/${g.slug}/">${esc(g.short)}</a>`).join('')}</p>
</div>
${heroScene}
</section>
<section class="meadow"><div class="wrap">
<h2>Why Patched Patches?</h2>
<ul class="perks">
<li><span class="perk-icon" style="--tint:#ff6b4a"><svg viewBox="0 0 40 40"><g fill="#fff"><circle cx="9" cy="10" r="4"/><circle cx="9" cy="20" r="4"/><circle cx="9" cy="30" r="4"/><rect x="16" y="8" width="18" height="4" rx="2"/><rect x="16" y="18" width="18" height="4" rx="2"/><rect x="16" y="28" width="12" height="4" rx="2"/></g></svg></span><strong>Step by step</strong><span>Clear, numbered steps you can follow at the ironing board.</span></li>
<li><span class="perk-icon" style="--tint:#3f78c9"><svg viewBox="0 0 40 40"><path d="M5 30h30v-4c0-9-6-15-15-15h-8l-2 4h10c5 0 8 3 9 7H8z" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><circle cx="17" cy="24" r="2" fill="#fff"/><circle cx="24" cy="24" r="2" fill="#fff"/></svg></span><strong>Fabric-safe</strong><span>Which fabrics can take heat, and what to do when they can't.</span></li>
<li><span class="perk-icon" style="--tint:#5cb83c"><svg viewBox="0 0 40 40"><path d="M31 15a12 12 0 1 0 1 9" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><path d="M33 7v9h-9" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 20l4 4 7-8" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span><strong>Kept up to date</strong><span>Every guide shows when it was last reviewed.</span></li>
</ul>
<h2>What do you need help with?</h2>
<ol class="thread">${used.map((t, i) => `<li class="spool" style="--tint:${t.tint}"><a href="/topics/${t.slug}/"><span class="bubble"><img src="/img/icons/${t.slug}.svg" alt="" width="84" height="84"></span><span class="tag"><strong>${esc(t.name)}</strong><small>${esc(t.blurb)}</small><em>${guides.filter(g => g.category === t.name).length} guide${guides.filter(g => g.category === t.name).length === 1 ? '' : 's'} →</em></span></a></li>`).join('')}</ol>
</div></section>
<section class="rules"><div class="wrap">
<div class="rules-head"><p class="eyebrow">Quick rules</p><h2>Five rules for patches that stay on</h2>
<p>Most peeling patches come down to one of these. Get them right and an iron-on patch can last for years.</p></div>
<ol class="tags">
<li>Check the care label first: if the fabric can't take a hot iron, sew or glue the patch instead</li>
<li>Turn the steam off and use a pressing cloth between the iron and the patch</li>
<li>Press firmly and hold still rather than sliding the iron around</li>
<li>Press again from the inside of the garment, then let it cool completely</li>
<li>Wait a day before washing, then wash inside out on a cool, gentle cycle</li>
</ol>
</div></section>
<section class="kit"><div class="wrap">
<div class="kit-head"><h2>Your patch starter kit</h2><p>Three bits of kit cover almost every patch job. Our guides explain how to choose each one.</p></div>
<ul class="kit-list">
<li style="--tint:#ff6b4a"><a href="/guides/best-fabric-glue-for-patches/"><span class="kit-art"><svg viewBox="0 0 120 120" aria-hidden="true"><g transform="rotate(-14 60 60)"><rect x="34" y="38" width="52" height="68" rx="10" fill="#fff" stroke="#1f3a5f" stroke-width="4"/><rect x="34" y="58" width="52" height="26" fill="#ff6b4a"/><text x="60" y="78" text-anchor="middle" font-family="'Lilita One', Impact, sans-serif" font-size="17" fill="#fff">GLUE</text><path d="M48 38V26h24v12z" fill="#1f3a5f"/><path d="M56 26l4-16 4 16z" fill="#1f3a5f"/></g></svg></span><strong>Fabric glue</strong><span>For nylon, caps and anything that can't take an iron.</span><em>Choose a glue →</em></a></li>
<li style="--tint:#3f78c9"><a href="/guides/best-iron-for-patches/"><span class="kit-art"><img src="/img/icons/applying-patches.svg" alt="" width="96" height="96"></span><strong>Iron or mini press</strong><span>Your own iron works; a mini iron makes caps and sleeves easy.</span><em>Compare irons →</em></a></li>
<li style="--tint:#5cb83c"><a href="/guides/how-to-sew-on-a-patch-by-hand/"><span class="kit-art"><img src="/img/icons/tools-and-kit.svg" alt="" width="96" height="96"></span><strong>Needle and thread</strong><span>The most permanent way to put a patch on anything.</span><em>Learn to sew one on →</em></a></li>
</ul>
<p class="kit-more"><a class="button" href="/best-patch-supplies/">See all our supply picks</a></p>
</div></section>
<section class="planner-band"><div class="wrap planner-grid">
<div class="planner-copy"><p class="eyebrow">Printable planner</p><h2>Plan your perfect patch jacket</h2>
<p>Templates for jackets, bags, caps and jeans, a real-size patch guide and a care cheat sheet. Print it, sketch it, then press with confidence.</p>
<a class="button" href="/patch-planner/">See the planner</a></div>
<a class="planner-fan" href="/patch-planner/" aria-label="See the Patch Placement Planner"><img src="/img/planner/page-4.jpg" alt="" width="600" height="849" loading="lazy"><img src="/img/planner/page-8.jpg" alt="" width="600" height="849" loading="lazy"><img src="/img/planner/page-1.jpg" alt="" width="600" height="849" loading="lazy"></a>
</div></section>
<section class="section latest"><div class="wrap"><div class="section-head"><h2>Latest guides</h2><a href="/guides/">See all guides →</a></div>
${featured(guides[0])}
<ul class="cards">${guides.slice(1, 7).map(card).join('')}</ul></div></section>` }));

const newest = guides.map(g => lastmod[`/guides/${g.slug}/`]).sort().pop();
const urls = [['/', newest], ['/guides/', newest], ...used.map(t => [`/topics/${t.slug}/`]),
  ...guides.map(g => [`/guides/${g.slug}/`, lastmod[`/guides/${g.slug}/`]]), ...pages.map(p => [`/${p.slug}/`])];
writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, d]) => `  <url><loc>${config.url}${u}</loc>${d ? `<lastmod>${d}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`);
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${config.url}/sitemap.xml\n`);
writeFileSync(join(OUT, '404.html'), layout({ title: 'Page not found', description: 'Page not found', path: '/404',
  body: `<div class="wrap narrow section"><h1>Page not found</h1><p>That page doesn't exist. Try the <a href="/guides/">list of guides</a>.</p></div>` }));

console.log(`Built ${guides.length} guides, ${used.length} topics and ${pages.length} pages into ${OUT}/`);
