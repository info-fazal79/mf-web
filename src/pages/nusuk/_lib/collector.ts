/**
 * "কোড সংগ্রহ" bookmarklet for Facebook group pages.
 * Facebook only keeps the posts that are on screen as real text, so copying a long
 * page gives "Facebook Facebook…". This button scrolls the page slowly, reads the
 * NG- codes from what is on screen at each step, opens "See more" where needed,
 * and at the end shows all codes (no repeats) with a Copy button.
 * It runs only in the admin's own browser, only when clicked.
 */
function collector() {
  const W = window as unknown as { __nkCollect?: boolean };
  if (W.__nkCollect) return;
  W.__nkCollect = true;
  const RE = /(?<![A-Za-z0-9_-])NG-[A-Za-z0-9]{8}(?![A-Za-z0-9_-]|\.\.\.|…)/g;
  const found = new Map<string, string>();
  let stop = false;
  let same = 0;
  let lastH = 0;
  let steps = 0;

  const box = document.createElement('div');
  box.setAttribute('style', 'position:fixed;z-index:2147483647;right:16px;bottom:16px;width:300px;background:#063d2e;color:#fff;font:14px/1.45 system-ui,sans-serif;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.35);padding:14px');
  box.innerHTML =
    '<div style="font-weight:700;font-size:15px;margin-bottom:6px">📥 কোড সংগ্রহ হচ্ছে…</div>' +
    '<div id="nkc-n" style="font-size:28px;font-weight:800;color:#f5d76e">0</div>' +
    '<div id="nkc-s" style="opacity:.8;font-size:12px;margin-bottom:10px">পাতা নিচে নামছে, অপেক্ষা করুন</div>' +
    '<textarea id="nkc-t" readonly style="display:none;width:100%;height:120px;border-radius:8px;border:0;padding:6px;font:12px monospace;color:#063d2e;box-sizing:border-box"></textarea>' +
    '<div style="display:flex;gap:6px;margin-top:8px">' +
    '<button id="nkc-c" style="display:none;flex:1;background:#f5d76e;color:#063d2e;border:0;border-radius:8px;padding:8px;font-weight:700;cursor:pointer">কপি করুন</button>' +
    '<button id="nkc-x" style="flex:1;background:rgba(255,255,255,.15);color:#fff;border:0;border-radius:8px;padding:8px;font-weight:700;cursor:pointer">থামান</button>' +
    '</div>';
  document.body.appendChild(box);
  const $ = (id: string) => box.querySelector('#' + id) as HTMLElement;

  const scan = () => {
    // "See more" on long posts, so a code at the end isn't cut off
    document.querySelectorAll('div[role="button"]').forEach((b) => {
      const t = (b.textContent || '').trim();
      if (t === 'See more' || t === 'আরও দেখুন') (b as HTMLElement).click();
    });
    for (const c of document.body.innerText.match(RE) ?? []) if (!found.has(c.toLowerCase())) found.set(c.toLowerCase(), c);
    $('nkc-n').textContent = String(found.size);
  };

  const finish = () => {
    scan();
    const list = [...found.values()].join('\n');
    $('nkc-s').textContent = found.size ? 'শেষ! "কপি করুন" চেপে Instant Keys বক্সে পেস্ট করুন।' : 'কোনো কোড পাওয়া যায়নি।';
    (box.firstChild as HTMLElement).textContent = '📥 কোড সংগ্রহ শেষ';
    const t = $('nkc-t') as HTMLTextAreaElement;
    t.value = list;
    t.style.display = found.size ? 'block' : 'none';
    $('nkc-c').style.display = found.size ? 'block' : 'none';
    $('nkc-x').textContent = 'বন্ধ করুন';
    $('nkc-x').onclick = () => { box.remove(); W.__nkCollect = false; };
  };

  $('nkc-x').onclick = () => { stop = true; };
  $('nkc-c').onclick = () => {
    const t = $('nkc-t') as HTMLTextAreaElement;
    const done = () => { $('nkc-c').textContent = '✓ কপি হয়েছে'; };
    navigator.clipboard.writeText(t.value).then(done, () => { t.select(); document.execCommand('copy'); done(); });
  };

  const step = () => {
    scan();
    steps++;
    const h = document.documentElement.scrollHeight;
    same = h === lastH && window.innerHeight + window.scrollY >= h - 50 ? same + 1 : 0;
    lastH = h;
    // Stops when the page stops growing at the bottom (6 tries), when you press Stop, or after ~10 minutes
    if (stop || same >= 6 || steps > 600) return finish();
    window.scrollBy(0, Math.round(window.innerHeight * 0.7));
    setTimeout(step, 1000);
  };
  // Start from the newest posts at the top of the group
  window.scrollTo(0, 0);
  setTimeout(step, 1500);
}

/** The javascript: link to drag to the bookmarks bar (encoded, so line breaks and comments survive). */
export const collectorHref = () => `javascript:${encodeURIComponent(`(${collector.toString()})();void 0`)}`;
