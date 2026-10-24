// Patch layout tool: pick a garment, add patches, drag them into place, then save a picture or a share link.
// Everything is one SVG, so the saved picture is exactly what's on screen. The layout is kept in the browser and in the share link only.
(() => {
  const root = document.querySelector('.layout-tool');
  if (!root) return;
  const svg = root.querySelector('.stage svg');
  const $ = s => root.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';
  const FONT = "'Lilita One', Impact, 'Arial Black', sans-serif";
  const KEY = 'pp-layout-v1';

  // Garments are drawn in a 400 x 440 box. `cm` is how many drawing units make a centimetre on an adult medium.
  const GARMENTS = {
    'jacket-back': { name: 'Jacket back', cm: 4.45, draw: (c, d, t) => `
<path d="M120 40Q200 60 280 40L340 70 380 300 340 312 320 160V420H80V160L60 312 20 300 60 70Z" fill="${c}" stroke="${d}" stroke-width="4" stroke-linejoin="round"/>
<path d="M120 40Q200 70 280 40Q262 22 200 26Q138 22 120 40Z" fill="${d}"/>
<path d="M80 132Q200 156 320 132M140 146V390M260 146V390M80 390H320" fill="none" stroke="${d}" stroke-width="3"/>
<path d="M80 140Q200 164 320 140M80 398H320M148 150V384M268 150V384" fill="none" stroke="${t}" stroke-width="2" stroke-dasharray="5 4"/>` },
    'jacket-front': { name: 'Jacket front', cm: 4.45, draw: (c, d, t) => `
<path d="M120 40Q200 60 280 40L340 70 380 300 340 312 320 160V420H80V160L60 312 20 300 60 70Z" fill="${c}" stroke="${d}" stroke-width="4" stroke-linejoin="round"/>
<path d="M120 40L200 112 172 40ZM280 40L200 112 228 40Z" fill="${d}"/>
<path d="M200 112V420M80 390H320M106 146H174V196H106ZM226 146H294V196H226Z" fill="none" stroke="${d}" stroke-width="3"/>
<path d="M106 166L140 178 174 166M226 166L260 178 294 166M80 398H320" fill="none" stroke="${t}" stroke-width="2" stroke-dasharray="5 4"/>
<g fill="${t}"><circle cx="212" cy="150" r="5"/><circle cx="212" cy="220" r="5"/><circle cx="212" cy="290" r="5"/><circle cx="212" cy="360" r="5"/><circle cx="140" cy="186" r="4"/><circle cx="260" cy="186" r="4"/></g>` },
    backpack: { name: 'Backpack', cm: 5.6, draw: (c, d, t) => `
<path d="M160 70V48Q160 24 200 24Q240 24 240 48V70" fill="none" stroke="${d}" stroke-width="12"/>
<rect x="110" y="64" width="180" height="356" rx="54" fill="${c}" stroke="${d}" stroke-width="4"/>
<rect x="140" y="266" width="120" height="134" rx="26" fill="${c}" stroke="${d}" stroke-width="3"/>
<path d="M122 120Q200 80 278 120" fill="none" stroke="${d}" stroke-width="3"/>
<path d="M126 128Q200 90 274 128M148 288H252" fill="none" stroke="${t}" stroke-width="2" stroke-dasharray="5 4"/>
<rect x="268" y="112" width="8" height="18" rx="3" fill="${t}"/><rect x="238" y="280" width="8" height="18" rx="3" fill="${t}"/>` },
    cap: { name: 'Cap', cm: 12, draw: (c, d, t) => `
<path d="M70 300Q70 96 200 96Q330 96 330 300Z" fill="${c}" stroke="${d}" stroke-width="4" stroke-linejoin="round"/>
<path d="M200 96V300" stroke="${d}" stroke-width="3"/>
<path d="M30 302Q200 268 370 302Q352 362 200 362Q48 362 30 302Z" fill="${d}"/>
<path d="M60 314Q200 288 340 314" fill="none" stroke="${t}" stroke-width="2" stroke-dasharray="5 4"/>
<circle cx="200" cy="98" r="9" fill="${d}"/>` },
    jeans: { name: 'Jeans', cm: 4.6, draw: (c, d, t) => `
<path d="M108 30H292L314 420H212L200 176 188 420H86Z" fill="${c}" stroke="${d}" stroke-width="4" stroke-linejoin="round"/>
<path d="M108 66H292M200 66Q208 130 200 176M120 66Q130 108 172 112M280 66Q270 108 228 112" fill="none" stroke="${d}" stroke-width="3"/>
<path d="M110 74H290M196 72Q202 126 194 166" fill="none" stroke="${t}" stroke-width="2" stroke-dasharray="5 4"/>
<circle cx="200" cy="48" r="6" fill="${t}"/>` },
  };
  const GARMENT_COLOURS = ['#5b7fb0', '#9db9dc', '#3a3f47', '#b49a6a', '#c94a3c', '#5b7d4a', '#efe6d2'];
  const PATCH_COLOURS = ['#ff6b4a', '#e8467c', '#ffd23f', '#5cb83c', '#3f78c9', '#1f3a5f', '#7ad0f0', '#fff4d6', '#2b2420', '#8e5cd9'];
  const LIGHT = ['#ffd23f', '#7ad0f0', '#fff4d6', '#efe6d2', '#9db9dc'];

  // Patch shapes, centred on 0,0 and 100 units wide. `h` is their height, used for the size readout.
  const SHAPES = {
    circle: { name: 'Circle', h: 100, d: '<circle r="50"/>' },
    square: { name: 'Square', h: 100, d: '<rect x="-50" y="-50" width="100" height="100" rx="18"/>' },
    hex: { name: 'Hexagon', h: 100, d: '<path d="M0-50L43.3-25V25L0 50-43.3 25V-25Z"/>' },
    oval: { name: 'Oval', h: 64, d: '<ellipse rx="50" ry="32"/>' },
    shield: { name: 'Shield', h: 100, d: '<path d="M0-50L44-38V-2C44 26 24 42 0 50-24 42-44 26-44-2V-38Z"/>' },
    star: { name: 'Star', h: 95, d: `<path d="${[...Array(10)].map((_, i) => { const r = i % 2 ? 22 : 52, a = Math.PI / 5 * i - Math.PI / 2; return `${i ? 'L' : 'M'}${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a) + 4).toFixed(1)}`; }).join('')}Z" stroke-linejoin="round"/>` },
    heart: { name: 'Heart', h: 90, d: '<path d="M0 44C-30 24-50 6-50-14-50-32-36-44-22-44-11-44-3-38 0-30 3-38 11-44 22-44 36-44 50-32 50-14 50 6 30 24 0 44Z"/>' },
    rocker: { name: 'Rocker', h: 50, d: '<path d="M-50-10Q0-40 50-10V20Q0-10-50 20Z"/>', stitch: '<path d="M-46-6Q0-34 46-6V16Q0-15-46 16Z"/>' },
  };

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const shade = (hex, f) => '#' + hex.slice(1).match(/../g).map(h => Math.max(0, Math.min(255, Math.round(parseInt(h, 16) * f))).toString(16).padStart(2, '0')).join('');
  const inkFor = colour => LIGHT.includes(colour) ? '#1f3a5f' : '#ffffff';

  const fresh = () => ({ garment: 'jacket-back', colour: '#5b7fb0', patches: [
    { id: 1, shape: 'rocker', colour: '#2b2420', text: 'PATCHED', size: 30, rot: 0, x: 200, y: 112 },
    { id: 2, shape: 'circle', colour: '#ff6b4a', text: 'MEND IT', size: 16, rot: 0, x: 200, y: 240 },
  ] });
  let state = load() || fresh();
  let selected = null;
  let nextId = Math.max(0, ...state.patches.map(p => p.id)) + 1;

  function load() {
    try {
      const hash = location.hash.match(/^#d=(.+)$/);
      if (hash) return valid(JSON.parse(decodeURIComponent(escape(atob(hash[1])))));
    } catch {}
    try { return valid(JSON.parse(localStorage.getItem(KEY))); } catch { return null; }
  }
  function valid(s) {
    if (!s || !GARMENTS[s.garment] || !Array.isArray(s.patches)) return null;
    s.patches = s.patches.filter(p => SHAPES[p.shape]).slice(0, 60).map((p, i) => ({ id: i + 1, shape: p.shape, colour: String(p.colour || '#ff6b4a').slice(0, 7),
      text: String(p.text || '').slice(0, 14), size: +p.size || 8, rot: +p.rot || 0, x: +p.x || 200, y: +p.y || 200 }));
    s.colour = /^#[0-9a-f]{6}$/i.test(s.colour) ? s.colour : '#5b7fb0';
    return s;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }

  function patchSvg(p) {
    const g = GARMENTS[state.garment], shape = SHAPES[p.shape];
    const scale = p.size * g.cm / 100;
    const ink = inkFor(p.colour), edge = shade(p.colour, .62);
    const text = p.text.trim().toUpperCase();
    let label = '';
    if (text && p.shape === 'rocker') {
      const fs = Math.min(15, 140 / text.length);
      const base = fs * .36;
      label = `<path id="arc${p.id}" d="M-46 ${(5 + base).toFixed(1)}Q0 ${(-25 + base).toFixed(1)} 46 ${(5 + base).toFixed(1)}" fill="none"/><text font-family="${FONT}" font-size="${fs.toFixed(1)}" fill="${ink}" text-anchor="middle" letter-spacing="1"><textPath href="#arc${p.id}" startOffset="50%">${esc(text)}</textPath></text>`;
    } else if (text) {
      const words = text.split(/\s+/).slice(0, 2);
      const longest = Math.max(...words.map(w => w.length));
      const fs = Math.min(p.shape === 'oval' ? 22 : 28, (p.shape === 'oval' ? 140 : 120) / longest);
      const ys = words.length === 1 ? [fs * .36] : [-fs * .14, fs * .9];
      label = words.map((w, i) => `<text y="${(ys[i] + (p.shape === 'shield' ? -4 : p.shape === 'star' ? 8 : 0)).toFixed(1)}" font-family="${FONT}" font-size="${fs.toFixed(1)}" fill="${ink}" text-anchor="middle" letter-spacing=".5">${esc(w)}</text>`).join('');
    }
    return `<g class="patch${p.id === selected ? ' sel' : ''}" data-id="${p.id}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.rot}) scale(${scale.toFixed(4)})" tabindex="0" role="button" aria-label="${esc(shape.name)} patch${text ? `: ${esc(text)}` : ''}">
<g transform="translate(2 3)" fill="#000" opacity=".22">${shape.d}</g>
<g fill="${p.colour}" stroke="${edge}" stroke-width="5">${shape.d}</g>
<g fill="none" stroke="${ink}" stroke-width="3" stroke-dasharray="6 4" stroke-linecap="round" opacity=".85"${shape.stitch ? '' : ' transform="scale(.8)"'}>${shape.stitch || shape.d}</g>
${label}</g>`;
  }

  function render() {
    const g = GARMENTS[state.garment];
    const thread = state.colour === '#efe6d2' ? '#b49a6a' : '#e0a84a';
    svg.innerHTML = `<rect class="bg" width="400" height="440" fill="transparent"/><g class="garment">${g.draw(state.colour, shade(state.colour, .72), thread)}</g><g class="patches">${state.patches.map(patchSvg).join('')}</g>`;
    for (const b of root.querySelectorAll('[data-garment]')) b.setAttribute('aria-pressed', b.dataset.garment === state.garment);
    for (const b of root.querySelectorAll('[data-gcolour]')) b.setAttribute('aria-pressed', b.dataset.gcolour === state.colour);
    const p = current();
    $('.edit').hidden = !p;
    $('.edit-empty').hidden = !!p;
    if (p) {
      $('#pt-text').value = p.text;
      $('#pt-size').value = p.size;
      $('#pt-rot').value = p.rot;
      $('#pt-size-out').textContent = `${p.size} cm wide (${(p.size / 2.54).toFixed(1)} in)`;
      $('#pt-rot-out').textContent = `${p.rot}°`;
      for (const b of root.querySelectorAll('[data-pcolour]')) b.setAttribute('aria-pressed', b.dataset.pcolour === p.colour);
    }
    $('.count').textContent = `${state.patches.length} patch${state.patches.length === 1 ? '' : 'es'}`;
    save();
  }
  const current = () => state.patches.find(p => p.id === selected);
  const update = (fn) => { const p = current(); if (p) { fn(p); render(); } };

  // Build the swatches and buttons in the controls.
  $('.garment-picks').innerHTML = Object.entries(GARMENTS).map(([k, g]) => `<button type="button" data-garment="${k}">${g.name}</button>`).join('');
  $('.garment-colours').innerHTML = GARMENT_COLOURS.map(c => `<button type="button" class="swatch" data-gcolour="${c}" style="--c:${c}" aria-label="Garment colour ${c}"></button>`).join('');
  $('.patch-colours').innerHTML = PATCH_COLOURS.map(c => `<button type="button" class="swatch" data-pcolour="${c}" style="--c:${c}" aria-label="Patch colour ${c}"></button>`).join('');
  $('.shape-picks').innerHTML = Object.entries(SHAPES).map(([k, s]) => `<button type="button" data-shape="${k}" title="Add a ${s.name.toLowerCase()} patch"><svg viewBox="-56 -56 112 112" aria-hidden="true"><g fill="currentColor">${s.d}</g></svg><span>${s.name}</span></button>`).join('');

  root.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.garment) { state.garment = b.dataset.garment; render(); }
    else if (b.dataset.gcolour) { state.colour = b.dataset.gcolour; render(); }
    else if (b.dataset.pcolour) update(p => { p.colour = b.dataset.pcolour; });
    else if (b.dataset.shape) {
      const size = b.dataset.shape === 'rocker' ? Math.round(240 / GARMENTS[state.garment].cm) : Math.round(70 / GARMENTS[state.garment].cm);
      const used = state.patches.map(p => p.colour);
      const colour = PATCH_COLOURS.find(c => !used.includes(c)) || PATCH_COLOURS[state.patches.length % PATCH_COLOURS.length];
      const n = state.patches.length % 5;
      state.patches.push({ id: nextId, shape: b.dataset.shape, colour, text: '', size, rot: 0, x: 170 + n * 16, y: 200 + n * 14 });
      selected = nextId++;
      render();
    }
    else if (b.dataset.act === 'front') update(p => { state.patches = state.patches.filter(o => o !== p).concat(p); });
    else if (b.dataset.act === 'copy') { const p = current(); if (p) { state.patches.push({ ...p, id: nextId, x: p.x + 14, y: p.y + 14 }); selected = nextId++; render(); } }
    else if (b.dataset.act === 'delete') { state.patches = state.patches.filter(p => p.id !== selected); selected = null; render(); }
    else if (b.dataset.act === 'reset') { if (confirm('Start again with a blank garment?')) { state = { ...fresh(), patches: [] }; selected = null; render(); } }
    else if (b.dataset.act === 'png') savePicture(b);
    else if (b.dataset.act === 'link') copyLink(b);
  });
  $('#pt-text').addEventListener('input', e => update(p => { p.text = e.target.value.slice(0, 14); }));
  $('#pt-size').addEventListener('input', e => update(p => { p.size = +e.target.value; }));
  $('#pt-rot').addEventListener('input', e => update(p => { p.rot = +e.target.value; }));

  // Drag patches with a mouse, finger or pen.
  const toSvg = e => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
  let drag = null;
  svg.addEventListener('pointerdown', e => {
    const el = e.target.closest('.patch');
    if (!el) { if (selected !== null) { selected = null; render(); } return; }
    selected = +el.dataset.id;
    const p = current(), at = toSvg(e);
    drag = { dx: p.x - at.x, dy: p.y - at.y, id: e.pointerId };
    svg.setPointerCapture(e.pointerId);
    render();
    e.preventDefault();
  });
  svg.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const at = toSvg(e), p = current();
    if (!p) return;
    p.x = Math.max(0, Math.min(400, at.x + drag.dx));
    p.y = Math.max(0, Math.min(440, at.y + drag.dy));
    const el = svg.querySelector(`.patch[data-id="${p.id}"]`);
    el.setAttribute('transform', el.getAttribute('transform').replace(/translate\([^)]*\)/, `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`));
  });
  const end = () => { if (drag) { drag = null; save(); } };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);

  // Keyboard: focus a patch, then arrows move it and Delete removes it.
  svg.addEventListener('focusin', e => { const el = e.target.closest('.patch'); if (el && +el.dataset.id !== selected) { selected = +el.dataset.id; render(); svg.querySelector(`.patch[data-id="${selected}"]`)?.focus(); } });
  svg.addEventListener('keydown', e => {
    const p = current();
    if (!p) return;
    const step = e.shiftKey ? 10 : 2;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) { p.x += moves[e.key][0]; p.y += moves[e.key][1]; }
    else if (e.key === 'Delete' || e.key === 'Backspace') { state.patches = state.patches.filter(o => o !== p); selected = null; }
    else return;
    e.preventDefault();
    render();
    svg.querySelector(`.patch[data-id="${selected}"]`)?.focus();
  });

  // Save picture: the SVG drawn onto a 1200 x 1500 canvas with a light background and the site name underneath.
  // A picture made from an SVG can't use the page's web fonts, so the patch font (Lilita One, SIL Open Font Licence) is embedded in it.
  let fontCss = null;
  async function patchFont() {
    if (fontCss !== null) return fontCss;
    try {
      const bytes = new Uint8Array(await (await fetch('/fonts/lilita-one.woff2')).arrayBuffer());
      let bin = ''; for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
      fontCss = `@font-face{font-family:'Lilita One';src:url(data:font/woff2;base64,${btoa(bin)})}`;
    } catch { fontCss = ''; }
    return fontCss;
  }
  async function savePicture(button) {
    const was = selected; selected = null; render();
    const font = await patchFont();
    const markup = new XMLSerializer().serializeToString(svg).replace(/<svg([^>]*)>/, `<svg$1 width="1080" height="1188"><style>${font}</style>`);
    selected = was; render();
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = 1200; c.height = 1500;
      const x = c.getContext('2d');
      x.fillStyle = '#e6f7ff'; x.fillRect(0, 0, 1200, 1500);
      x.fillStyle = '#7cc444'; x.fillRect(0, 1380, 1200, 120);
      x.drawImage(img, 60, 120, 1080, 1188);
      x.fillStyle = '#1f3a5f'; x.textAlign = 'center';
      x.font = '700 54px Nunito, system-ui, sans-serif';
      x.fillText(`My ${GARMENTS[state.garment].name.toLowerCase()} patch layout`, 600, 84);
      x.fillStyle = '#fff'; x.font = '700 40px Nunito, system-ui, sans-serif';
      x.fillText('Planned on patchedpatches.co.uk', 600, 1454);
      c.toBlob(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'my-patch-layout.png';
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        flash(button, 'Saved!');
      });
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
  }

  function copyLink(button) {
    const url = `${location.origin}${location.pathname}#d=${btoa(unescape(encodeURIComponent(JSON.stringify(state))))}`;
    history.replaceState(null, '', url);
    (navigator.clipboard?.writeText(url) || Promise.reject()).then(() => flash(button, 'Link copied!'), () => flash(button, 'Copy the address bar'));
  }
  function flash(b, text) { const was = b.textContent; b.textContent = text; setTimeout(() => { b.textContent = was; }, 1800); }

  render();
})();
