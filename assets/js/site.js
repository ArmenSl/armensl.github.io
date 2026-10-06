// Shared across every page: theme, nav, mail, reveal, secrets.
(function () {
  const root = document.documentElement;

  // ---------- storage (can throw in private mode) ----------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  // ---------- theme ----------
  const saved = store.get('theme');
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  const currentTheme = () =>
    root.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  function toggleTheme() {
    const next = currentTheme() === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    store.set('theme', next);
    document.dispatchEvent(new CustomEvent('themechange', { detail: next }));
  }
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (!root.dataset.theme) document.dispatchEvent(new CustomEvent('themechange'));
  });

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-theme-toggle]').forEach(b => b.addEventListener('click', toggleTheme));

    // ---------- nav ----------
    const nav = document.querySelector('.nav');
    const menuBtn = document.querySelector('.menu-btn');
    if (nav && menuBtn) {
      menuBtn.addEventListener('click', () => {
        const open = nav.classList.toggle('open');
        menuBtn.setAttribute('aria-expanded', open);
      });
      nav.querySelectorAll('.nav-links a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
    }

    // ---------- mail: assembled at runtime so static scrapers miss it ----------
    document.querySelectorAll('[data-mail]').forEach(a => {
      const e = a.dataset.u + '@' + a.dataset.d;
      a.setAttribute('href', 'mailto:' + e);
      if (a.dataset.show) {
        const span = a.querySelector('.email-text');
        if (span) span.textContent = e;
      }
    });

    // ---------- year ----------
    document.querySelectorAll('[data-year]').forEach(el => (el.textContent = new Date().getFullYear()));

    // ---------- reveal ----------
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => {
          if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
        });
      }, { threshold: 0.1 });
      document.querySelectorAll('.reveal').forEach(el => io.observe(el));
    } else {
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
    }

    // ---------- secrets ----------
    renderSecrets();
    const btn = document.querySelector('.secrets-btn');
    const pop = document.querySelector('.secrets-pop');
    if (btn && pop) {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const open = pop.classList.toggle('open');
        btn.setAttribute('aria-expanded', open);
      });
      document.addEventListener('click', e => {
        if (!pop.contains(e.target)) { pop.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
      });
    }

    const last = document.querySelector('.last-block');
    if (last) last.addEventListener('click', () => { last.classList.add('fell'); Site.secret('block'); });
  });

  // ---------- secrets registry ----------
  const SECRETS = [
    { id: 'sudo', hint: 'ask the terminal for root' },
    { id: 'rm', hint: 'try to delete everything' },
    { id: 'generate', hint: 'regenerate the page from its model' },
    { id: 'scatter', hint: 'click the name' },
    { id: 'object', hint: 'inspect the object' },
    { id: 'resolve', hint: 'bring every project into focus' },
    { id: 'konami', hint: '↑ ↑ ↓ ↓ ← → ← → b a' },
    { id: 'block', hint: 'the last block on the page' },
  ];
  const LABELS = {
    sudo: 'root denied', rm: 'nothing deleted', generate: 'regenerated', scatter: 'scattered',
    object: 'object inspected', resolve: 'full resolution', konami: 'konami', block: 'the last block',
  };
  let found;
  try { found = new Set(JSON.parse(store.get('secrets') || '[]')); } catch (e) { found = new Set(); }

  function renderSecrets() {
    document.querySelectorAll('[data-secret-count]').forEach(el => (el.textContent = found.size));
    document.querySelectorAll('[data-secret-total]').forEach(el => (el.textContent = SECRETS.length));
    const list = document.querySelector('.secrets-pop ul');
    if (list) {
      list.innerHTML = '';
      SECRETS.forEach(s => {
        const li = document.createElement('li');
        const has = found.has(s.id);
        if (has) li.className = 'found';
        li.textContent = has ? LABELS[s.id] : s.hint;
        list.appendChild(li);
      });
    }
  }

  let toastTimer;
  function toast(msg) {
    let t = document.querySelector('.toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'toast';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  // ---------- konami ----------
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let kIdx = 0;
  document.addEventListener('keydown', e => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    kIdx = k === KONAMI[kIdx] ? kIdx + 1 : (k === KONAMI[0] ? 1 : 0);
    if (kIdx === KONAMI.length) {
      kIdx = 0;
      document.dispatchEvent(new CustomEvent('konami'));
      Site.secret('konami');
    }
  });

  window.Site = {
    store,
    toggleTheme,
    currentTheme,
    toast,
    secret(id) {
      if (!SECRETS.some(s => s.id === id)) return;
      if (found.has(id)) return;
      found.add(id);
      store.set('secrets', JSON.stringify([...found]));
      renderSecrets();
      toast(`secret found · ${LABELS[id]} · ${found.size}/${SECRETS.length}`);
    },
    reducedMotion: () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
})();
