// Small touches: the hero jacket turns towards the pointer, patches flip on tap, the guide contents follow your place, and sections ease in.
// Motion is skipped when the reader prefers reduced motion.
(() => {
  // Tap a patch on the jacket to flip it over and see its iron-on backing.
  document.addEventListener('click', e => { const p = e.target.closest('.jacket .p3'); if (p) p.classList.toggle('flipped'); });

  // Highlight the section you're reading in the guide's contents.
  const links = [...document.querySelectorAll('.sidebar .toc a')];
  if (links.length && 'IntersectionObserver' in window) {
    const byId = new Map(links.map(a => [decodeURIComponent(a.hash.slice(1)), a]));
    const seen = new Set();
    const spy = new IntersectionObserver(entries => {
      for (const en of entries) en.isIntersecting ? seen.add(en.target.id) : seen.delete(en.target.id);
      const heads = [...byId.keys()].map(id => document.getElementById(id)).filter(Boolean);
      const current = heads.find(h => seen.has(h.id)) || heads.filter(h => h.getBoundingClientRect().top < innerHeight * .3).pop();
      for (const a of links) a.classList.toggle('on', !!current && byId.get(current.id) === a);
    }, { rootMargin: '-80px 0px -55% 0px' });
    for (const id of byId.keys()) { const h = document.getElementById(id); if (h) spy.observe(h); }
  }

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // The jacket turns gently towards the pointer, so the patches show their thickness.
  const jacket = document.querySelector('.jacket-tilt');
  if (jacket && fine) {
    const hero = jacket.closest('.hero');
    let raf = 0;
    hero.addEventListener('pointermove', e => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5;
        jacket.style.setProperty('--ry', `${(x * 22 - 4).toFixed(2)}deg`);
        jacket.style.setProperty('--rx', `${(-y * 14 + 2).toFixed(2)}deg`);
      });
    });
    hero.addEventListener('pointerleave', () => { jacket.style.removeProperty('--rx'); jacket.style.removeProperty('--ry'); });
  }

  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(entries => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }, { rootMargin: '0px 0px -8% 0px' });
  for (const group of document.querySelectorAll('.cards, .index, .pieces, .promise ul, .workshop-grid, .featured, .care-label, .summary, .picks')) {
    const items = group.matches('ul, ol, .workshop-grid') ? group.children : [group];
    [...items].forEach((el, i) => {
      // Only animate what starts below the fold, so nothing on the first screen moves twice.
      if (el.getBoundingClientRect().top < innerHeight) return;
      el.classList.add('rv'); el.style.setProperty('--rd', `${(i % 4) * 80}ms`); io.observe(el);
    });
  }
})();
