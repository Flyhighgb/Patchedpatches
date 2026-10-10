// Pointer tilt for the hero denim and the cards, plus gentle scroll reveals. Skipped when the reader prefers reduced motion.
(() => {
  // Tap a patch on the washing line to flip it over and see its iron-on backing.
  document.addEventListener('click', e => { const p = e.target.closest('.garment .p3'); if (p) p.classList.toggle('flipped'); });
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // The washing line turns gently towards the pointer, so the patches show their thickness.
  const line = document.querySelector('.garments');
  if (line && fine) {
    const hero = line.closest('.hero') || document.body;
    hero.addEventListener('pointermove', e => {
      const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5;
      line.style.setProperty('--ry', `${(x * 24).toFixed(2)}deg`);
      line.style.setProperty('--rx', `${(-y * 14).toFixed(2)}deg`);
    });
    hero.addEventListener('pointerleave', () => { line.style.removeProperty('--rx'); line.style.removeProperty('--ry'); });
  }

  if (fine) for (const el of document.querySelectorAll('.card a, .topic a, a.featured')) {
    el.classList.add('tilt');
    const max = el.matches('a.featured') ? 4 : 8;
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--ry', `${((px - .5) * max * 2).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${((.5 - py) * max * 2).toFixed(2)}deg`);
      el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
      el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
    });
    el.addEventListener('pointerleave', () => { el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); });
  }

  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(entries => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }, { rootMargin: '0px 0px -8% 0px' });
  for (const group of document.querySelectorAll('.topics, .cards, .perks, .thread, .tags, .kit-list, .featured, .post table')) {
    const items = group.matches('ul, ol') ? group.children : [group];
    [...items].forEach((el, i) => {
      // Only animate what starts below the fold, so nothing on the first screen moves twice.
      if (el.getBoundingClientRect().top < innerHeight) return;
      el.classList.add('rv'); el.style.setProperty('--rd', `${(i % 4) * 70}ms`); io.observe(el);
    });
  }
})();
