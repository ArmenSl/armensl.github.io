// Homepage: the agent reads the model (UML), then generates the name out of blocks.
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const rand = (a, b) => a + Math.random() * (b - a);
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const reduced = () => window.Site && Site.reducedMotion();
  const secret = id => window.Site && Site.secret(id);

  let palette = {};
  function readPalette() {
    palette = {
      ink: css('--ink'), dim: css('--dim'), mute: css('--mute'), line: css('--line-2'),
      model: css('--model'), agent: css('--agent'), out: css('--out'), bg2: css('--bg-2'),
    };
  }

  /* =========================================================
     Name blocks — real font pixels sampled onto a grid
     ========================================================= */
  const Name = (() => {
    const hero = $('.hero');
    const stage = $('#nameStage');
    const canvas = $('#nameCanvas');
    if (!hero || !stage || !canvas) return null;
    const ctx = canvas.getContext('2d');
    const LINES = ['Armen', 'Sulejmani'];
    // The canvas covers the whole hero so blocks can fly out of the workbench;
    // the name itself lives inside #nameStage.
    let blocks = [], cell = 6, W = 0, H = 0, CW = 0, CH = 0, raf = 0, pointer = null;
    let mode = 'hidden'; // hidden | fly | scatter | idle
    let party = 0, onLanded = null, lastKey = '';

    function layout() {
      W = Math.round(stage.clientWidth);
      if (!W) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const font = s => `700 ${s}px Geist, system-ui, -apple-system, sans-serif`;
      const m = document.createElement('canvas').getContext('2d');
      m.font = font(100);
      if ('letterSpacing' in m) m.letterSpacing = '1px'; // = 0.01em at 100px, matches the draw below
      const widest = Math.max(...LINES.map(l => m.measureText(l).width));
      const fs = Math.max(36, Math.min(116, Math.floor((100 * W * 0.97) / widest)));
      cell = Math.max(3, Math.round(fs / (fs < 80 ? 17 : 15)));
      const lh = Math.round(fs * 0.98);
      H = Math.ceil((lh * LINES.length + fs * 0.12) / cell) * cell;
      stage.style.height = H + 'px';
      stage.classList.add('ready');

      const off = document.createElement('canvas');
      off.width = W; off.height = H;
      const o = off.getContext('2d');
      o.font = font(fs);
      if ('letterSpacing' in o) o.letterSpacing = `${0.01 * fs}px`;
      o.fillStyle = '#000';
      LINES.forEach((l, i) => o.fillText(l, 2, Math.round(lh * i + fs * 0.8)));
      const data = o.getImageData(0, 0, W, H).data;

      const hr = hero.getBoundingClientRect();
      const sr = stage.getBoundingClientRect();
      const offX = Math.round(sr.left - hr.left), offY = Math.round(sr.top - hr.top);
      CW = Math.round(hr.width); CH = Math.round(hr.height);
      lastKey = `${W}x${CW}x${CH}`;

      // a cell becomes a block when the glyph covers enough of it
      // (coverage, not a single centre sample, keeps the gap above i and j)
      const covered = (x, y) => {
        let sum = 0;
        for (let yy = y; yy < y + cell; yy++) for (let xx = x; xx < x + cell; xx++) sum += data[(yy * W + xx) * 4 + 3];
        return sum / (cell * cell * 255) > 0.42;
      };
      blocks = [];
      for (let y = 0; y + cell <= H; y += cell) {
        for (let x = 0; x + cell <= W; x += cell) {
          if (covered(x, y)) {
            const tx = x + offX, ty = y + offY;
            blocks.push({ tx, ty, x: tx, y: ty, fx: tx, fy: ty, arc: 0, d: 0, dur: 1, ox: 0, oy: 0, landed: 1 });
          }
        }
      }
      // prune lone overshoot cells (bottom of S/u/e/a): at small sizes they read as accents
      const key = (x, y) => x + ',' + y;
      const filled = new Set(blocks.map(b => key(b.tx, b.ty)));
      blocks = blocks.filter(b =>
        [[cell, 0], [-cell, 0], [0, cell], [0, -cell]].filter(([dx, dy]) => filled.has(key(b.tx + dx, b.ty + dy))).length > 1);

      canvas.width = CW * dpr;
      canvas.height = CH * dpr;
      canvas.style.width = CW + 'px';
      canvas.style.height = CH + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Blocks are emitted from the agent trace, wherever it sits on screen.
    function origin() {
      const c = canvas.getBoundingClientRect();
      const t = $('#trace');
      if (!t) return { x: CW, y: CH / 2 };
      const r = t.getBoundingClientRect();
      return { x: r.left + Math.min(220, r.width * 0.5) - c.left, y: r.bottom - 40 - c.top };
    }

    function fly(fromCurrent, done) {
      const o = origin();
      const now = performance.now();
      const span = Math.max(1, W);
      const minX = Math.min(...blocks.map(b => b.tx));
      blocks.forEach(b => {
        if (fromCurrent) { b.fx = b.x; b.fy = b.y; }
        else { b.fx = o.x + rand(-24, 24); b.fy = o.y + rand(-10, 10); }
        b.arc = rand(-80, 80);
        b.d = now + ((b.tx - minX) / span) * 700 + rand(0, 400);
        b.dur = rand(620, 900);
        b.landed = 0;
      });
      onLanded = done || null;
      mode = 'fly';
      loop();
    }

    function settle() {
      mode = 'idle';
      const cb = onLanded; onLanded = null;
      if (cb) cb(blocks.length);
    }

    function finish() {
      blocks.forEach(b => { b.x = b.tx; b.y = b.ty; b.ox = 0; b.oy = 0; b.landed = 1; });
      draw();
      settle();
    }

    function hide() {
      mode = 'hidden';
      onLanded = null;
      ctx.clearRect(0, 0, CW, CH);
    }

    function loop() {
      if (raf) return;
      raf = requestAnimationFrame(now => {
        raf = 0;
        let busy = false;
        if (mode === 'fly') {
          let left = 0;
          blocks.forEach(b => {
            const t = Math.min(1, Math.max(0, (now - b.d) / b.dur));
            const e = easeInOut(t);
            b.x = b.fx + (b.tx - b.fx) * e;
            b.y = b.fy + (b.ty - b.fy) * e + Math.sin(Math.PI * t) * b.arc;
            if (t < 1) left++;
            else if (!b.landed) b.landed = now;
          });
          busy = true;
          if (!left) settle();
        }
        if (mode === 'idle') {
          const R = cell * 9;
          blocks.forEach(b => {
            let gx = 0, gy = 0;
            if (pointer) {
              const dx = b.tx + cell / 2 - pointer.x, dy = b.ty + cell / 2 - pointer.y;
              const dist = Math.hypot(dx, dy);
              if (dist < R && dist > 0.01) {
                const p = Math.pow(1 - dist / R, 2) * cell * 2.6;
                gx = (dx / dist) * p; gy = (dy / dist) * p;
              }
            }
            b.ox += (gx - b.ox) * 0.22;
            b.oy += (gy - b.oy) * 0.22;
            b.x = b.tx + b.ox; b.y = b.ty + b.oy;
            if (Math.abs(b.ox - gx) > 0.05 || Math.abs(b.oy - gy) > 0.05) busy = true;
            if (b.landed > 1 && now - b.landed < 450) busy = true;
          });
          if (pointer) busy = true;
        }
        if (party > now) busy = true;
        draw(now);
        if (busy) loop();
      });
    }

    function draw(now = performance.now()) {
      ctx.clearRect(0, 0, CW, CH);
      if (mode === 'hidden') return;
      const s = Math.max(1, cell - (cell >= 4 ? 1 : 0));
      const partyCols = [palette.model, palette.agent, palette.out];
      blocks.forEach((b, i) => {
        if (mode === 'fly' && now < b.d) return; // still queued inside the generator
        let col = palette.ink;
        if (party > now) col = partyCols[(i + Math.floor(now / 90)) % 3];
        else if (!b.landed || (b.landed > 1 && now - b.landed < 450)) col = palette.out;
        ctx.fillStyle = col;
        ctx.fillRect(Math.round(b.x), Math.round(b.y), s, s);
      });
    }

    const local = e => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    // blocks lean away from the cursor
    stage.addEventListener('pointermove', e => {
      pointer = local(e);
      if (mode === 'idle') loop();
    });
    stage.addEventListener('pointerleave', () => { pointer = null; if (mode === 'idle') loop(); });

    // click: scatter, then reassemble
    stage.addEventListener('click', e => {
      if (mode !== 'idle') return;
      secret('scatter');
      if (reduced()) return;
      const p = local(e);
      const start = performance.now();
      blocks.forEach(b => {
        const dx = b.tx - p.x, dy = b.ty - p.y;
        const dist = Math.hypot(dx, dy) || 1;
        const f = rand(60, 220);
        b.fx = b.x; b.fy = b.y;
        b.sx = b.tx + (dx / dist) * f + rand(-20, 20);
        b.sy = b.ty + (dy / dist) * f * 0.6 + rand(-20, 20);
      });
      mode = 'scatter';
      const step = t => {
        const k = Math.min(1, (t - start) / 260);
        const e2 = easeOut(k);
        blocks.forEach(b => { b.x = b.fx + (b.sx - b.fx) * e2; b.y = b.fy + (b.sy - b.fy) * e2; });
        draw(t);
        if (k < 1) requestAnimationFrame(step);
        else fly(true);
      };
      requestAnimationFrame(step);
    });

    const relayout = () => {
      const key = `${Math.round(stage.clientWidth)}x${Math.round(hero.clientWidth)}x${Math.round(hero.clientHeight)}`;
      if (key === lastKey) return;
      const wasHidden = mode === 'hidden';
      layout();
      if (!wasHidden) finish();
    };
    const ro = new ResizeObserver(relayout);
    ro.observe(stage);
    ro.observe(hero);

    document.addEventListener('themechange', () => { readPalette(); draw(); });
    document.addEventListener('konami', () => { party = performance.now() + 1600; if (mode === 'idle') loop(); });

    return { layout, fly, finish, hide, count: () => blocks.length };
  })();

  /* =========================================================
     Hero sequence — agent trace drives the UML and the name
     ========================================================= */
  const Hero = (() => {
    const trace = $('#trace');
    const uml = $('#uml');
    const skipBtn = $('#benchSkip');
    if (!trace || !uml || !Name) return null;
    let run = 0, skipping = false, running = false;

    const sleep = ms => new Promise(r => (skipping ? r() : setTimeout(r, ms)));
    const on = sel => $$(sel, uml).forEach(el => el.classList.add('on'));
    async function stagger(sel, gap) {
      for (const el of $$(sel, uml)) { el.classList.add('on'); await sleep(gap); }
    }

    function line(mark, text, cls) {
      const ln = document.createElement('div');
      ln.className = 'ln';
      if (mark) {
        const m = document.createElement('span');
        m.className = cls || 'ok';
        m.textContent = mark;
        ln.appendChild(m);
      }
      const t = document.createElement('span');
      t.textContent = text;
      ln.appendChild(t);
      trace.appendChild(ln);
      return { ln, mark: ln.firstChild, text: t };
    }

    async function typeCmd(text) {
      const ln = document.createElement('div');
      ln.className = 'ln';
      ln.innerHTML = '<span class="ps">$</span><span class="cmd"></span>';
      trace.appendChild(ln);
      const out = ln.lastChild;
      for (let i = 0; i < text.length; i++) {
        out.textContent = text.slice(0, i + 1);
        if (!skipping) await sleep(text[i] === ' ' ? 40 : 22);
      }
    }

    const portrait = $('#heroPortrait');

    function reset() {
      $$('.on', uml).forEach(el => el.classList.remove('on'));
      trace.innerHTML = '';
      Name.hide();
      if (portrait) { portrait.classList.add('pending'); if (portrait._px) portrait._px.reset(); }
    }

    async function play() {
      const me = ++run;
      const alive = () => me === run;
      running = true;
      skipping = reduced();
      skipBtn.innerHTML = 'skip intro<kbd>esc</kbd>';
      reset();

      await sleep(250); if (!alive()) return;
      await typeCmd('besser generate armen.buml --agent'); if (!alive()) return;
      await sleep(260); if (!alive()) return;
      line('›', 'plan: load → resolve → link → generate', 'note');
      await sleep(380); if (!alive()) return;

      line('✓', 'load model · class Armen');
      on('#umlArmen .draw'); on('.sep:not(.side)');
      await sleep(240); if (!alive()) return;
      on('#umlArmen .fade');
      await sleep(320); if (!alive()) return;

      line('✓', 'resolve attributes · role, base, speaks');
      await stagger('.attr', 110); if (!alive()) return;
      await sleep(160); if (!alive()) return;

      line('✓', 'resolve operations · model, generate, delegate');
      await stagger('.op', 110); if (!alive()) return;
      await sleep(160); if (!alive()) return;

      line('✓', 'link associations · uses Agent, leads BESSER');
      on('.side.draw'); on('.link.draw');
      await sleep(320); if (!alive()) return;
      on('.side.fade'); on('.link.fade');
      await sleep(300); if (!alive()) return;

      line('✓', 'check invariant · next > last');
      on('.inv.draw');
      await sleep(260); if (!alive()) return;
      on('.inv.fade');
      await sleep(300); if (!alive()) return;

      if (portrait) {
        line('✓', 'render portrait · avatar.jpg, 6 passes');
        portrait.classList.remove('pending');
        if (portrait._px) portrait._px.go(true, 120, skipping);
        await sleep(700); if (!alive()) return;
      }

      const gen = line('⟳', 'generate page · emitting blocks…', 'run');
      if (!Name.count()) Name.layout();
      const count = await new Promise(res => {
        if (skipping) { Name.finish(); res(Name.count()); return; }
        Name.fly(false, res);
      });
      if (!alive()) return;
      gen.mark.textContent = '✓';
      gen.mark.className = 'ok';
      gen.text.textContent = `generate page · ${count.toLocaleString('en-US')} blocks placed`;
      await sleep(200); if (!alive()) return;
      line('', 'done. the name is made of blocks: hover it, or click.', 'note').ln.classList.add('note');
      const ps = document.createElement('div');
      ps.className = 'ln';
      ps.innerHTML = '<span class="ps">$</span><span class="caret"></span>';
      trace.appendChild(ps);

      running = false;
      skipping = false;
      skipBtn.innerHTML = 'replay ↻';
    }

    function skip() { if (running) skipping = true; }

    skipBtn.addEventListener('click', () => (running ? skip() : play()));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && running) skip();
    });

    return { play, skip, running: () => running };
  })();

  /* =========================================================
     Pixelated media — covers start at 8px blocks, render on hover
     ========================================================= */
  const SPRITES = {
    tower: [
      '..3...........3..',
      '.3..2.......2..3.',
      '3..2..1...1..2..3',
      '3..2.1..o..1.2..3',
      '3..2..1.#.1..2..3',
      '.3..2...#...2..3.',
      '..3....###....3..',
      '.......#.#.......',
      '.......###.......',
      '......#...#......',
      '......#####......',
      '.....#.....#.....',
      '.....#######.....',
      '....#.......#....',
      '....#########....',
      '...#.........#...',
    ],
    tree: [
      '.......mmm.......',
      '.......mmm.......',
      '........#........',
      '....#########....',
      '....#.......#....',
      '...mmm.....mmm...',
      '...mmm.....mmm...',
      '....#.......#....',
      '..#####...#####..',
      '..#...#...#...#..',
      '.ooo.aaa.aaa.ooo.',
      '.ooo.aaa.aaa.ooo.',
    ],
  };

  function spriteColor(ch, phase) {
    switch (ch) {
      case '#': return palette.dim;
      case 'm': return palette.model;
      case 'a': return palette.agent;
      case 'o': return palette.out;
      case '1': case '2': case '3':
        return phase === null || Number(ch) <= phase ? palette.model : null;
      default: return null;
    }
  }

  const projectPx = new Set();
  const projectSharp = new Set();

  function initPx(el) {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    el.prepend(canvas);
    const ctx = canvas.getContext('2d');
    const isSprite = !!el.dataset.sprite;
    const sprite = isSprite ? SPRITES[el.dataset.sprite] : null;
    const crop = el.dataset.crop ? el.dataset.crop.split(',').map(Number) : null;
    const fit = el.dataset.fit || 'cover';
    let img = null, step = 0, timer = 0, wave = 0, waveTimer = 0;
    let levels = (el.dataset.levels || '14,22,36,60').split(',').map(Number);
    const inProjects = !!el.closest('#projects');
    if (inProjects) projectPx.add(el);

    function box() {
      const r = el.getBoundingClientRect();
      return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
    }

    // sprite field: grid of cells, sprite centered
    function spriteField() {
      const { w, h } = box();
      const rows = sprite.length + 6;
      const c = h / rows;
      const cols = Math.max(sprite[0].length + 2, Math.round(w / c));
      return { rows, cols, c, ox: Math.floor((cols - sprite[0].length) / 2), oy: Math.floor((rows - sprite.length) / 2) };
    }

    function drawSource(target, tw, th, phase) {
      const t = target.getContext('2d');
      t.imageSmoothingEnabled = true;
      t.imageSmoothingQuality = 'high';
      t.clearRect(0, 0, tw, th);
      if (isSprite) {
        const f = spriteField();
        const sx = tw / f.cols, sy = th / f.rows;
        sprite.forEach((row, y) => [...row].forEach((ch, x) => {
          const col = spriteColor(ch, phase);
          if (!col) return;
          t.fillStyle = col;
          t.fillRect((x + f.ox) * sx, (y + f.oy) * sy, Math.ceil(sx), Math.ceil(sy));
        }));
        return;
      }
      if (!img) return;
      if (el.dataset.bg) { t.fillStyle = el.dataset.bg; t.fillRect(0, 0, tw, th); }
      let [cx, cy, cw, ch] = crop ? [crop[0], crop[1], crop[2], crop[2]] : [0, 0, img.naturalWidth, img.naturalHeight];
      if (fit === 'contain') {
        const s = Math.min(tw / cw, th / ch) * 0.86;
        const dw = cw * s, dh = ch * s;
        t.drawImage(img, cx, cy, cw, ch, (tw - dw) / 2, (th - dh) / 2, dw, dh);
      } else {
        const ta = tw / th, sa = cw / ch;
        if (sa > ta) { const nw = ch * ta; cx += (cw - nw) / 2; cw = nw; }
        else { const nh = cw / ta; cy += (ch - nh) / 2; ch = nh; }
        t.drawImage(img, cx, cy, cw, ch, 0, 0, tw, th);
      }
    }

    function render(n) {
      const { w, h } = box();
      if (isSprite && n === Infinity) {
        // crisp final: every cell a block with a hairline gap
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const f = spriteField();
        const cw = canvas.width / f.cols, chh = canvas.height / f.rows;
        const gap = Math.max(1, Math.round(dpr));
        sprite.forEach((row, y) => [...row].forEach((ch, x) => {
          const col = spriteColor(ch, el.dataset.sprite === 'tower' ? wave : null);
          if (!col) return;
          ctx.fillStyle = col;
          ctx.fillRect(Math.round((x + f.ox) * cw), Math.round((y + f.oy) * chh), Math.ceil(cw) - gap, Math.ceil(chh) - gap);
        }));
        return;
      }
      const cols = Math.max(2, Math.round(n));
      const rows = Math.max(2, Math.round(cols * (h / w)));
      // two-step downscale so blocks are closer to true averages
      const mid = document.createElement('canvas');
      mid.width = cols * 4; mid.height = rows * 4;
      drawSource(mid, mid.width, mid.height, null);
      canvas.width = cols; canvas.height = rows;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.clearRect(0, 0, cols, rows);
      ctx.drawImage(mid, 0, 0, cols, rows);
    }

    function levelValue(i) { return i >= levels.length ? Infinity : levels[i]; }

    function go(sharp, ms = 55, instant = false) {
      clearInterval(timer);
      const target = sharp ? levels.length : 0;
      if (instant || reduced()) { step = target; apply(); return; }
      timer = setInterval(() => {
        step += sharp ? 1 : -1;
        apply();
        if (step === target) clearInterval(timer);
      }, ms);
    }

    function apply() {
      const sharp = step >= levels.length;
      if (!isSprite) {
        el.classList.toggle('sharp', sharp);
        if (!sharp) render(levelValue(step));
      } else {
        el.classList.toggle('sharp', sharp);
        render(levelValue(step));
        clearInterval(waveTimer);
        if (sharp && el.dataset.sprite === 'tower' && !reduced()) {
          wave = 0;
          waveTimer = setInterval(() => { wave = (wave + 1) % 4; render(Infinity); }, 320);
        } else wave = 3;
      }
      if (sharp && inProjects) {
        projectSharp.add(el);
        if (projectSharp.size === projectPx.size) secret('resolve');
      }
    }

    function setup() {
      if (isSprite) {
        const f = spriteField();
        levels = [Math.round(f.cols / 5), Math.round(f.cols / 2.5)];
      }
      step = 0;
      render(levelValue(0));
    }

    // data-rest="sharp" (hero portrait): sharp at rest, hover shows the blocks instead
    const rest = el.dataset.rest === 'sharp';
    const idle = () => el.classList.contains('pending');
    el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && !idle()) go(!rest); });
    el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !idle()) go(rest); });
    el.addEventListener('focus', () => { if (!idle()) go(!rest); });
    el.addEventListener('blur', () => { if (!idle()) go(rest); });
    el.addEventListener('click', e => { if (e.pointerType !== 'mouse' && !idle()) go(step < levels.length); });
    el._px = {
      go,
      reset() { clearInterval(timer); step = 0; el.classList.remove('sharp'); render(levelValue(0)); },
    };
    document.addEventListener('themechange', () => { readPalette(); if (isSprite) render(levelValue(step)); });
    new ResizeObserver(() => { if (step < levels.length || isSprite) { if (isSprite && step === 0) setup(); else render(levelValue(step)); } }).observe(el);

    if (isSprite) setup();
    else {
      img = new Image();
      img.onload = setup;
      img.src = el.dataset.src;
    }
  }

  /* =========================================================
     Object card — inspect for a hidden attribute
     ========================================================= */
  function initObject() {
    const btn = $('#objName'), mood = $('#objMood');
    if (!btn || !mood) return;
    btn.addEventListener('click', () => {
      const show = mood.hidden;
      mood.hidden = !show;
      btn.setAttribute('aria-expanded', show);
      if (show) secret('object');
    });
    const armen = $('#umlArmen');
    if (armen) armen.addEventListener('click', () => {
      document.getElementById('about').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' });
    });
  }

  /* =========================================================
     Terminal
     ========================================================= */
  function initTerminal() {
    const out = $('#termOut'), form = $('#termForm'), input = $('#termInput'), term = $('#term');
    if (!out || !form || !input) return;
    const email = () => 'armensulejmani91' + '@' + 'gmail.com';
    const LINKS = {
      github: 'https://github.com/ArmenSl',
      linkedin: 'https://www.linkedin.com/in/armen-sl/',
      scholar: 'https://scholar.google.com/citations?user=qJ95Z8kAAAAJ&hl=en',
      dblp: 'https://dblp.uni-trier.de/pid/253/6310.html',
    };
    const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const history = [];
    let hIdx = 0;

    function print(html, cls) {
      const d = document.createElement('div');
      d.className = 'ln' + (cls ? ' ' + cls : '');
      d.innerHTML = html;
      out.appendChild(d);
      out.scrollTop = out.scrollHeight;
    }
    const row = (k, v) => `<span class="key">${k}</span>${v}`;
    const open = url => window.open(url, '_blank', 'noopener');

    const COMMANDS = {
      help() {
        print('commands:');
        [
          ['whoami', "who's asking"],
          ['about', 'the short version'],
          ['projects', "what I'm building"],
          ['email', 'my address'],
          ['note &lt;msg&gt;', 'write me a note (opens your mail app)'],
          ['cv', 'download my CV'],
          ['github', 'also: linkedin, scholar, dblp'],
          ['theme', 'toggle light / dark'],
          ['clear', 'clear the screen'],
        ].forEach(([k, v]) => print(row(k, v)));
      },
      whoami() { print('guest. could be a collaborator, though.'); },
      about() {
        print('Armen Sulejmani · Research &amp; Software Engineer @ LIST, Luxembourg');
        print('lead developer of BESSER, an open-source low-code platform');
        print('model-driven engineering · applied AI · AI agents');
      },
      projects() {
        print(row('BESSER', '<a href="https://github.com/BESSER-PEARL/BESSER" target="_blank" rel="noopener">low-code platform</a>'));
        print(row('CLIMABOROUGH', '<a href="https://climaborough.eu/" target="_blank" rel="noopener">smart-city dashboards</a>'));
        print(row('6G-TWIN', '<a href="https://6g-twin.eu/" target="_blank" rel="noopener">network digital twins</a>'));
      },
      email() { print(`<a href="mailto:${email()}">${email()}</a>`); },
      note(args) {
        if (!args) { print('usage: note &lt;your message&gt;', 'warn'); return; }
        const href = `mailto:${email()}?subject=${encodeURIComponent('Hello from armen-sulejmani.com')}&body=${encodeURIComponent(args)}`;
        print('✓ opening your mail client with your note…', 'ok');
        window.location.href = href;
      },
      cv() { print('✓ opening Armen_Sulejmani_CV.pdf', 'ok'); open('files/Armen_Sulejmani_CV.pdf'); },
      theme() { Site.toggleTheme(); print(`✓ theme: ${Site.currentTheme()}`, 'ok'); },
      clear() { out.innerHTML = ''; },
      ls() { print('about.obj  projects/  history.log  papers.bib  cv.pdf  log/'); },
      cat(args) {
        if (args === 'cv.pdf') print('binary file. try <span class="c-agent">cv</span>.');
        else if (args) print(`cat: ${esc(args)}: try <span class="c-agent">about</span>.`);
        else print('usage: cat &lt;file&gt;', 'warn');
      },
      cd() { print("you're already where you need to be."); },
      sudo() {
        print('armen is not in the sudoers file. this incident will be reported to the metamodel.', 'warn');
        secret('sudo');
      },
      rm() {
        print('✓ deleted 0 files. everything here is generated from a model, so it would just come back.', 'ok');
        secret('rm');
      },
      generate() {
        print('› regenerating from armen.buml…');
        secret('generate');
        if (Hero) {
          window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
          setTimeout(() => Hero.play(), reduced() ? 0 : 450);
        }
      },
      besser(args) {
        if (/^generate/.test(args)) COMMANDS.generate();
        else print('usage: besser generate &lt;model&gt;', 'warn');
      },
      exit() { print('there is no exit. only refactoring.'); },
      coffee() { print('☕ brewing… done. +1 mood.', 'ok'); },
      top() {
        print('  PID  PROCESS       %CPU');
        [['1', 'ambition', '99.9'], ['2', 'curiosity', '87.0'], ['3', 'shipping', '74.2'], ['4', 'coffee', '42.0'], ['5', 'sleep', ' 3.1']]
          .forEach(([pid, p, c]) => print(`  ${pid.padStart(3)}  ${p.padEnd(12)}  <span class="${pid === '1' ? 'warn' : ''}">${c}</span>`));
      },
      hello() { print('hi! type <span class="c-agent">help</span> to see what I can do.'); },
    };
    COMMANDS.hi = COMMANDS.hello;
    COMMANDS.quit = COMMANDS.exit;
    Object.keys(LINKS).forEach(k => {
      COMMANDS[k] = () => { print(`✓ opening ${k}`, 'ok'); open(LINKS[k]); };
    });

    function run(raw) {
      const line = raw.trim();
      print(`<span class="ps">guest:~$</span> ${esc(line)}`, 'in');
      if (!line) return;
      history.push(line);
      hIdx = history.length;
      const [cmd, ...rest] = line.split(/\s+/);
      const args = line.slice(cmd.length).trim();
      const fn = COMMANDS[cmd.toLowerCase()];
      if (fn) fn(args, rest);
      else print(`command not found: ${esc(cmd)}. type <span class="c-agent">help</span>.`);
    }

    form.addEventListener('submit', e => {
      e.preventDefault();
      run(input.value);
      input.value = '';
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp' && history.length) {
        e.preventDefault();
        hIdx = Math.max(0, hIdx - 1);
        input.value = history[hIdx];
      } else if (e.key === 'ArrowDown' && history.length) {
        e.preventDefault();
        hIdx = Math.min(history.length, hIdx + 1);
        input.value = history[hIdx] || '';
      } else if (e.key === 'Tab' && input.value.trim()) {
        const v = input.value.trim().toLowerCase();
        const hit = ['help', 'whoami', 'about', 'projects', 'email', 'note ', 'cv', 'github', 'linkedin', 'scholar', 'dblp', 'theme', 'clear']
          .find(c => c.startsWith(v));
        if (hit) { e.preventDefault(); input.value = hit; }
      }
    });
    term.addEventListener('click', e => {
      if (!e.target.closest('a, button') && !window.getSelection().toString()) input.focus({ preventScroll: true });
    });
    $$('.term-chips button').forEach(b => b.addEventListener('click', () => {
      if (b.hasAttribute('data-fill')) {
        input.value = b.dataset.cmd;
        input.focus({ preventScroll: true });
      } else run(b.dataset.cmd);
    }));

    print('armen-sulejmani.com · static site, real terminal (sort of)');
    print('type <span class="c-agent">help</span>, or click a command below.');
  }

  /* ========================================================= */
  async function boot() {
    readPalette();
    $$('.px').forEach(initPx);
    initObject();
    initTerminal();
    if (!Name) return;
    try {
      await Promise.race([
        document.fonts.load('700 100px Geist'),
        new Promise(r => setTimeout(r, 1500)),
      ]);
    } catch (e) {}
    Name.layout();
    if (Hero) Hero.play();
    else Name.finish();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
