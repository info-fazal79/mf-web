/** Small, dependency-free UI behaviours shared by every page. */

function initTheme() {
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const root = document.documentElement;
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try {
        localStorage.setItem('theme', next);
      } catch {}
    }),
  );
}

function initHeader() {
  const header = document.getElementById('site-header');
  const toTop = document.querySelector<HTMLElement>('[data-back-to-top]');
  const onScroll = () => {
    const y = window.scrollY;
    header?.classList.toggle('is-scrolled', y > 12);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    header?.style.setProperty('--progress', String(max > 0 ? Math.min(1, y / max) : 0));
    toTop?.classList.toggle('is-visible', y > 600);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  toTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  const toggle = document.querySelector<HTMLButtonElement>('[data-mobile-toggle]');
  const menu = document.getElementById('mobile-menu');
  toggle?.addEventListener('click', () => {
    const open = menu?.classList.toggle('hidden') === false;
    toggle.setAttribute('aria-expanded', String(open));
  });
}

let lastFocus: HTMLElement | null = null;

function openDrawer(id: string) {
  const el = document.querySelector<HTMLElement>(`[data-drawer="${id}"]`);
  if (!el) return;
  lastFocus = document.activeElement as HTMLElement;
  document.getElementById('mobile-menu')?.classList.add('hidden');
  el.classList.remove('hidden');
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => {
    el.querySelector<HTMLElement>('[data-drawer-backdrop]')!.style.opacity = '1';
    // Tailwind v4 `translate-x-full` uses the CSS `translate` property, not `transform`.
    el.querySelector<HTMLElement>('[data-drawer-panel]')!.style.translate = '0 0';
    el.querySelector<HTMLElement>('[data-drawer-close]')?.focus();
  });
}

function closeDrawer(el: HTMLElement) {
  el.querySelector<HTMLElement>('[data-drawer-backdrop]')!.style.opacity = '0';
  el.querySelector<HTMLElement>('[data-drawer-panel]')!.style.translate = '';
  document.body.classList.remove('no-scroll');
  setTimeout(() => el.classList.add('hidden'), 300);
  lastFocus?.focus();
}

function initDrawers() {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const opener = target.closest<HTMLElement>('[data-open]');
    if (opener) {
      e.preventDefault();
      openDrawer(opener.dataset.open!);
      return;
    }
    if (target.closest('[data-drawer-close]') || target.matches('[data-drawer-backdrop]')) {
      const drawer = target.closest<HTMLElement>('[data-drawer]');
      if (drawer) closeDrawer(drawer);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll<HTMLElement>('[data-drawer]:not(.hidden)').forEach(closeDrawer);
  });
  if (location.hash === '#consultation') openDrawer('consult');
}

function initFab() {
  const fab = document.querySelector<HTMLElement>('[data-fab]');
  const btn = fab?.querySelector<HTMLButtonElement>('[data-fab-toggle]');
  btn?.addEventListener('click', () => {
    const open = fab!.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => {
    if (fab && !fab.contains(e.target as Node)) fab.classList.remove('is-open');
  });
}

function initNewsletter() {
  document.querySelectorAll<HTMLFormElement>('[data-newsletter]').forEach((form) => {
    const msg = form.parentElement?.querySelector<HTMLElement>('[data-newsletter-msg]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = form.querySelector<HTMLInputElement>('input[type=email]')!;
      const show = (text: string, ok: boolean) => {
        if (!msg) return;
        msg.textContent = text;
        msg.className = `mt-2 text-xs ${ok ? 'text-accent' : 'text-red-500'}`;
      };
      if (!input.checkValidity()) return show('Please enter a valid email address.', false);
      const { supabase } = await import('@/lib/supabase');
      if (supabase) {
        const { error } = await supabase.from('subscribers').insert({ email: input.value.trim().toLowerCase() });
        if (error && error.code !== '23505') return show('Could not subscribe right now. Please try again.', false);
      }
      form.reset();
      show('Thanks for subscribing! 🎉', true);
    });
  });
}

function initReveal() {
  const els = document.querySelectorAll<HTMLElement>('.reveal');
  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('is-visible');
          io.unobserve(en.target);
        }
      }),
    { rootMargin: '0px 0px -60px 0px' },
  );
  els.forEach((el) => io.observe(el));
}

function initCounters() {
  const els = document.querySelectorAll<HTMLElement>('[data-count]');
  const io = new IntersectionObserver((entries) =>
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target as HTMLElement;
      io.unobserve(el);
      const end = Number(el.dataset.count);
      const decimals = (el.dataset.count!.split('.')[1] ?? '').length;
      const start = performance.now();
      const dur = 1400;
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (end * eased).toFixed(decimals);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }),
  );
  els.forEach((el) => io.observe(el));
}

function initTyping() {
  const el = document.querySelector<HTMLElement>('[data-typing]');
  if (!el) return;
  const words: string[] = JSON.parse(el.dataset.typing || '[]');
  if (!words.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let w = 0;
  let c = words[0].length;
  let deleting = true;
  const step = () => {
    const word = words[w];
    c += deleting ? -1 : 1;
    el.textContent = word.slice(0, c);
    let delay = deleting ? 35 : 70;
    if (!deleting && c === word.length) {
      deleting = true;
      delay = 1800;
    } else if (deleting && c === 0) {
      deleting = false;
      w = (w + 1) % words.length;
      delay = 300;
    }
    setTimeout(step, delay);
  };
  setTimeout(step, 2200);
}

export function initUI() {
  initTheme();
  initHeader();
  initDrawers();
  initFab();
  initNewsletter();
  initReveal();
  initCounters();
  initTyping();
}
