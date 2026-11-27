{
// Listen: private audiobook player. Library + audio are AES-GCM encrypted on the
// player-data branch; the key arrives once in the install link's #k= fragment.
const DATA = 'https://raw.githubusercontent.com/renxida/renxida.github.io/player-data/';
const SPEEDS = [0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.3, 2.6, 3];
const SLEEPS = [['Off', 0], ['15 min', 15], ['30 min', 30], ['45 min', 45], ['60 min', 60], ['End of section', -1]];
const $ = id => document.getElementById(id);
const a = $('a');
const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>'
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const fmt = s => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const ls = {get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
            set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }};

// ---------- IndexedDB
let dbp;
function db() {
  return dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open('listen', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('audio'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function idb(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction(store, mode), req = fn(tx.objectStore(store));
    tx.oncomplete = () => res(req?.result); tx.onerror = () => rej(tx.error);
  });
}
const kvGet = k => idb('kv', 'readonly', s => s.get(k));
const kvSet = (k, v) => idb('kv', 'readwrite', s => s.put(v, k));
const audGet = k => idb('audio', 'readonly', s => s.get(k));
const audSet = (k, v) => idb('audio', 'readwrite', s => s.put(v, k));
const audDel = k => idb('audio', 'readwrite', s => s.delete(k));
const audKeys = () => idb('audio', 'readonly', s => s.getAllKeys());

// ---------- crypto
let cryptoKey = null;
const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
async function loadKey() {
  const m = location.hash.match(/k=([A-Za-z0-9_-]{40,})/);
  let raw = m ? m[1] : await kvGet('key').catch(() => null);
  if (m) { await kvSet('key', m[1]); history.replaceState(null, '', location.pathname); }
  if (!raw) return false;
  cryptoKey = await crypto.subtle.importKey('raw', b64u(raw), 'AES-GCM', false, ['decrypt']);
  return true;
}
async function decrypt(buf) {
  const u = new Uint8Array(buf);
  return crypto.subtle.decrypt({name: 'AES-GCM', iv: u.slice(0, 12)}, cryptoKey, u.slice(12));
}

// ---------- state
let lib = {books: []};
let have = new Set();          // downloaded track ids
const busy = new Map();        // track id -> download promise
let cur = null;                // {book, ti}
let sleepAt = 0, sleepEnd = false;
const pos = id => ls.get('pos:' + id, 0);
const savePos = () => { if (cur && a.src) { ls.set('pos:' + track().id, a.currentTime); ls.set('last', {b: cur.book.id, t: cur.ti}); ls.set('lastBook:' + cur.book.id, cur.ti); } };
const track = () => cur.book.tracks[cur.ti];
const bookDur = b => b.tracks.reduce((s, t) => s + t.duration, 0);
function bookDone(b) {
  const ti = ls.get('lastBook:' + b.id, 0); let s = 0;
  b.tracks.forEach((t, i) => { if (i < ti) s += t.duration; else if (i === ti) s += Math.min(pos(t.id), t.duration); });
  return s;
}

// ---------- library sync
async function sync() {
  $('sync').textContent = 'Syncing…';
  try {
    const r = await fetch(DATA + 'library.bin?t=' + Date.now(), {cache: 'no-store'});
    if (!r.ok) throw new Error(r.status);
    const buf = await r.arrayBuffer();
    lib = JSON.parse(new TextDecoder().decode(await decrypt(buf)));
    await kvSet('lib', buf);
    $('sync').textContent = '';
  } catch (e) {
    $('sync').textContent = navigator.onLine ? 'Sync failed' : 'Offline';
  }
  render();
  // drop audio no longer in the library, fetch what's new
  const live = new Set(lib.books.flatMap(b => b.tracks.map(t => t.id)));
  for (const k of await audKeys()) if (!live.has(k)) { await audDel(k); have.delete(k); }
  for (const b of lib.books) for (const t of b.tracks) if (!have.has(t.id)) await download(t).catch(() => {});
}
function download(t) {
  if (busy.has(t.id)) return busy.get(t.id);
  const p = (async () => {
    const r = await fetch(DATA + t.file + '?v=' + t.id);
    if (!r.ok) throw new Error(r.status);
    const total = t.bytes || 0, reader = r.body.getReader(), parts = []; let got = 0;
    for (;;) {
      const {done, value} = await reader.read(); if (done) break;
      parts.push(value); got += value.length;
      setProg(t.id, total ? got / (total + 28) : 0);
    }
    const plain = await decrypt(await new Blob(parts).arrayBuffer());
    await audSet(t.id, new Blob([plain], {type: t.mime || 'audio/ogg'}));
    have.add(t.id); setProg(t.id, null); render();
  })().finally(() => busy.delete(t.id));
  busy.set(t.id, p); return p;
}
const prog = new Map();
function setProg(id, v) { if (v === null) prog.delete(id); else prog.set(id, v); render(); }

// ---------- library view
function render() {
  const L = $('list');
  if (!lib.books.length) { L.innerHTML = '<div class="empty">Nothing here yet. Ask Claude to add something.</div>'; return; }
  L.innerHTML = lib.books.map(b => {
    const d = bookDur(b), done = bookDone(b), n = b.tracks.filter(t => have.has(t.id)).length;
    const dl = b.tracks.map(t => prog.get(t.id)).find(v => v !== undefined);
    const state = n === b.tracks.length ? 'Downloaded' : dl !== undefined ? `Downloading ${Math.round(dl * 100)}%` : `${n}/${b.tracks.length} downloaded`;
    const left = d - done;
    return `<button class="book${cur && cur.book.id === b.id ? ' on' : ''}" data-b="${esc(b.id)}">
      <div><div class="t">${esc(b.title)}</div><div class="a">${esc(b.author)}</div></div>
      <div class="a">${fmt(d)}</div>
      <div class="m"><div class="bar"><i style="width:${d ? (done / d * 100).toFixed(1) : 0}%"></i></div><span>${done > 5 ? (left < 30 ? 'Finished' : fmt(left) + ' left') : esc(state)}</span></div>
    </button>`;
  }).join('');
}
$('list').addEventListener('click', e => {
  const el = e.target.closest('[data-b]'); if (!el) return;
  const b = lib.books.find(x => x.id === el.dataset.b);
  if (cur && cur.book.id === b.id) { openFull(); if (a.paused) play(); return; }
  load(b, ls.get('lastBook:' + b.id, 0), true).then(openFull);
});

// ---------- playback
let loadedId = null, urlObj = null;
async function load(book, ti, autoplay) {
  savePos();
  cur = {book, ti}; const t = track();
  let blob = await audGet(t.id);
  if (!blob) { $('ftitle').textContent = 'Downloading…'; await download(t); blob = await audGet(t.id); }
  if (urlObj) URL.revokeObjectURL(urlObj);
  urlObj = URL.createObjectURL(blob); loadedId = t.id;
  a.src = urlObj;
  const p = pos(t.id);
  if (a.readyState < 1) await new Promise(r => { a.onloadedmetadata = r; a.onerror = r; setTimeout(r, 8000); });
  a.currentTime = p >= t.duration - 2 ? 0 : p;
  a.defaultPlaybackRate = a.playbackRate = ls.get('speed', 1);
  meta(); paint(); render();
  if (autoplay) play();
}
const play = () => a.play().catch(() => {});
const toggle = () => a.paused ? play() : a.pause();
function seekBy(d) { a.currentTime = Math.max(0, Math.min(a.duration || 0, a.currentTime + d)); }
const marks = () => track()?.marks || [];
function markIdx() { const m = marks(); let i = -1; m.forEach((x, j) => { if (a.currentTime + 0.5 >= x.t) i = j; }); return i; }
function prevSec() {
  const m = marks(), i = markIdx();
  if (i >= 0 && a.currentTime - m[i].t > 3) return void (a.currentTime = m[i].t);
  if (i > 0) return void (a.currentTime = m[i - 1].t);
  if (a.currentTime > 3 || cur.ti === 0) return void (a.currentTime = 0);
  ls.set('pos:' + cur.book.tracks[cur.ti - 1].id, 0); load(cur.book, cur.ti - 1, !a.paused);
}
function nextSec() {
  const m = marks(), i = markIdx();
  if (i + 1 < m.length) return void (a.currentTime = m[i + 1].t);
  if (cur.ti + 1 < cur.book.tracks.length) { ls.set('pos:' + cur.book.tracks[cur.ti + 1].id, 0); load(cur.book, cur.ti + 1, !a.paused); }
}
a.addEventListener('ended', () => {
  ls.set('pos:' + track().id, track().duration);
  if (sleepEnd) { sleepEnd = false; paintSleep(); return; }
  if (cur.ti + 1 < cur.book.tracks.length) { ls.set('pos:' + cur.book.tracks[cur.ti + 1].id, 0); load(cur.book, cur.ti + 1, true); }
  else { ls.set('lastBook:' + cur.book.id, cur.ti); render(); }
});
let lastSave = 0, lastMark = -2;
a.addEventListener('timeupdate', () => {
  const now = Date.now();
  if (now - lastSave > 5000) { lastSave = now; savePos(); render(); }
  if (sleepAt && now >= sleepAt) { sleepAt = 0; fadeStop(); }
  if (sleepEnd) { const i = markIdx(), m = marks(); if (m[i + 1] && a.currentTime >= m[i + 1].t - 0.3 && lastMark === i) { sleepEnd = false; fadeStop(); } lastMark = i; }
  paint();
});
for (const ev of ['play', 'pause', 'ratechange']) a.addEventListener(ev, () => { savePos(); paint(); posState(); if (ev !== 'ratechange') render(); });
document.addEventListener('visibilitychange', savePos);
window.addEventListener('pagehide', savePos);
function fadeStop() {
  const v0 = a.volume; let k = 0;
  const iv = setInterval(() => { k++; a.volume = Math.max(0, v0 * (1 - k / 20)); if (k >= 20) { clearInterval(iv); a.pause(); a.volume = v0; seekBy(-15); paintSleep(); } }, 150);
}

// ---------- lock screen
function meta() {
  if (!('mediaSession' in navigator) || !cur) return;
  const i = markIdx(), m = marks();
  navigator.mediaSession.metadata = new MediaMetadata({
    title: m[i] ? m[i].title : track().title,
    artist: cur.book.author, album: cur.book.title,
    artwork: [{src: 'icon-192.png', sizes: '192x192', type: 'image/png'}, {src: 'icon-512.png', sizes: '512x512', type: 'image/png'}]
  });
}
function posState() {
  if (!('mediaSession' in navigator) || !a.duration) return;
  try { navigator.mediaSession.setPositionState({duration: a.duration, playbackRate: a.playbackRate, position: Math.min(a.currentTime, a.duration)}); } catch {}
  navigator.mediaSession.playbackState = a.paused ? 'paused' : 'playing';
}
if ('mediaSession' in navigator) {
  const h = (k, f) => { try { navigator.mediaSession.setActionHandler(k, f); } catch {} };
  h('play', play); h('pause', () => a.pause());
  h('seekbackward', d => seekBy(-(d.seekOffset || 15)));
  h('seekforward', d => seekBy(d.seekOffset || 30));
  h('seekto', d => { a.currentTime = d.seekTime; posState(); });
  h('previoustrack', prevSec); h('nexttrack', nextSec);
}

// ---------- full player view
function paint() {
  const pi = a.paused ? ICON.play : ICON.pause;
  $('play').innerHTML = pi; $('miniPlay').innerHTML = pi;
  if (!cur) return;
  const t = track(), d = a.duration || t.duration, i = markIdx(), m = marks();
  $('mini').classList.add('show');
  $('miniT').textContent = cur.book.title;
  $('miniS').textContent = (m[i] ? m[i].title + ' · ' : cur.book.tracks.length > 1 ? t.title + ' · ' : '') + fmt((d - a.currentTime) / a.playbackRate) + ' left';
  $('fbook').textContent = cur.book.title; $('fauth').textContent = cur.book.author;
  $('ftitle').textContent = cur.book.tracks.length > 1 ? t.title : '';
  $('fmark').textContent = m[i] ? m[i].title : '';
  if (!dragging) $('seek').value = d ? Math.round(a.currentTime / d * 1000) : 0;
  $('cur').textContent = fmt(a.currentTime);
  $('left').textContent = '-' + fmt(d - a.currentTime);
  $('trackBtn').textContent = a.playbackRate + '×';
  if (i !== lastPaintMark) { lastPaintMark = i; meta(); paintLists(); }
}
let lastPaintMark = -2, dragging = false;
function paintLists() {
  const m = marks(), i = markIdx();
  $('marksL').hidden = $('marks').hidden = !m.length;
  $('marks').innerHTML = m.map((x, j) => `<button class="${j === i ? 'on' : ''}" data-t="${x.t}"><span>${esc(x.title)}</span><span>${fmt(x.t)}</span></button>`).join('');
  const T = cur.book.tracks;
  $('tracksL').hidden = $('tracks').hidden = T.length < 2;
  $('tracks').innerHTML = T.length < 2 ? '' : T.map((x, j) => `<button class="${j === cur.ti ? 'on' : ''}" data-i="${j}"><span>${esc(x.title)}</span><span>${fmt(x.duration)}</span></button>`).join('');
  $('src').textContent = cur.book.source || '';
}
function paintSpeed() {
  const s = ls.get('speed', 1);
  $('speeds').innerHTML = SPEEDS.map(x => `<button class="chip${x === s ? ' on' : ''}" data-s="${x}">${x}×</button>`).join('');
}
function paintSleep() {
  const on = sleepEnd ? -1 : sleepAt ? ls.get('sleepPick', 0) : 0;
  $('sleeps').innerHTML = SLEEPS.map(([l, v]) => `<button class="chip${v === on ? ' on' : ''}" data-z="${v}">${l}</button>`).join('');
}
$('speeds').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; const s = +b.dataset.s; ls.set('speed', s); a.defaultPlaybackRate = a.playbackRate = s; paintSpeed(); });
$('sleeps').addEventListener('click', e => {
  const b = e.target.closest('[data-z]'); if (!b) return; const v = +b.dataset.z;
  sleepEnd = v === -1; sleepAt = v > 0 ? Date.now() + v * 60000 : 0; ls.set('sleepPick', v); paintSleep();
});
$('marks').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { a.currentTime = +b.dataset.t; play(); } });
$('tracks').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) load(cur.book, +b.dataset.i, true); });
$('seek').addEventListener('input', () => { dragging = true; const d = a.duration || 0; $('cur').textContent = fmt($('seek').value / 1000 * d); });
$('seek').addEventListener('change', () => { dragging = false; a.currentTime = $('seek').value / 1000 * (a.duration || 0); posState(); });
$('play').onclick = toggle; $('miniPlay').onclick = toggle;
$('back').onclick = () => seekBy(-15); $('fwd').onclick = () => seekBy(30);
$('prev').onclick = prevSec; $('next').onclick = nextSec;
$('trackBtn').onclick = () => { const s = ls.get('speed', 1), i = SPEEDS.indexOf(s); const n = SPEEDS[(i + 1) % SPEEDS.length]; ls.set('speed', n); a.defaultPlaybackRate = a.playbackRate = n; paintSpeed(); };
$('restart').onclick = () => { if (!cur) return; cur.book.tracks.forEach(t => ls.set('pos:' + t.id, 0)); load(cur.book, 0, true); };
function openFull() { $('full').classList.add('open'); history.pushState({full: 1}, ''); }
function closeFull() { $('full').classList.remove('open'); }
$('miniOpen').onclick = openFull;
$('close').onclick = () => history.state?.full ? history.back() : closeFull();
window.addEventListener('popstate', closeFull);

// ---------- boot
(async () => {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  paint(); paintSpeed(); paintSleep();
  if (!(await loadKey().catch(() => false))) { $('lock').hidden = false; $('list').hidden = true; return; }
  try { const buf = await kvGet('lib'); if (buf) lib = JSON.parse(new TextDecoder().decode(await decrypt(buf))); } catch {}
  have = new Set(await audKeys().catch(() => []));
  render();
  const last = ls.get('last', null), b = last && lib.books.find(x => x.id === last.b);
  if (b && b.tracks[last.t]) load(b, last.t, false).catch(() => {});
  sync();
  setInterval(() => { if (document.visibilityState === 'visible' && a.paused) sync(); }, 10 * 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && a.paused) sync(); });
})();
}
