/*  ✦  Shadow Cherry  ✦
    影色のさくらんぼ · fog, ash & porcelain rose
    a SillyTavern extension by ewwn1h

    Replaces the welcome screen with rows of character cameos that scroll
    sideways (pinned, recent, frequent, everyone, new) and adds a "close chat"
    cross to the top bar. Tap a cameo to see that character's chats.
    The theme itself lives in the Moonlit Echoes preset.
*/

const MODULE = 'shadowCherry';
const DEFAULTS = Object.freeze({
    home: true,
    closeButton: true,
    filter: 'recent',      // sort order of the "all" view: recent · frequent · name
});

const ctx = () => SillyTavern.getContext();

/* ── settings ─────────────────────────────────────────── */
// one settings object for the whole session: fill in missing keys in place
function getSettings() {
    const all = ctx().extensionSettings;
    const s = (all[MODULE] ||= {});
    for (const [key, value] of Object.entries(DEFAULTS)) {
        if (!(key in s)) s[key] = value;
    }
    if (!Array.isArray(s.pinned)) s.pinned = [];
    if (!Array.isArray(s.archived)) s.archived = [];
    if (!s.favChats || typeof s.favChats !== 'object') s.favChats = {};
    return s;
}
const save = () => ctx().saveSettingsDebounced();

/* ── language ─────────────────────────────────────────── */
const RU = (() => {
    try {
        const loc = ctx().getCurrentLocale?.() || localStorage.getItem('language') || '';
        return String(loc).toLowerCase().startsWith('ru');
    } catch { return false; }
})();
const T = RU ? {
    continue: 'продолжить', search: 'поиск персонажей…', archive: 'архив', back: '‹ назад',
    recent: 'недавние', frequent: 'частые', name: 'а–я', seeAll: 'все →', found: 'нашлось',
    chatFrom: (d) => `чат от ${d}`,
    pinned: '✦ закреплённые', all: 'все', fresh: 'новые', archived: 'архив',
    empty: 'Пока здесь пусто. Добавьте персонажа, и он появится на полке.',
    noMatch: 'Никого не нашлось.', noArchive: 'В архиве пусто.', noChatsYet: 'без чатов',
    today: 'сегодня', yesterday: 'вчера', justNow: 'только что', minAgo: (n) => `${n} мин назад`, hAgo: (n) => `${n} ч назад`,
    moon: ['новолуние', 'растущий серп', 'первая четверть', 'растущая луна', 'полнолуние', 'убывающая луна', 'последняя четверть', 'убывающий серп'],
    mes: 'mes', chats: 'chats', newChat: '+ новый чат', pin: '✦ закрепить', unpin: '✦ открепить', toArchive: 'в архив', fromArchive: 'из архива',
    last: '✦ last', rename: 'переименовать', fav: '✦ избранное', unfav: '✦ убрать', download: 'скачать', del: 'удалить',
    more: 'ещё', loading: 'загружаю чаты…', noChats: 'У этого персонажа пока нет чатов.',
    renamePrompt: 'Новое название чата', deleteConfirm: 'Удалить этот чат? Вернуть его не получится.',
    renamed: 'Чат переименован.', deleted: 'Чат удалён.', failed: 'Не получилось. Подробности в консоли.',
    close: 'Закрыть чат', panelClose: 'Крестик «закрыть чат» на верхней панели',
    panelHome: 'Своя главная (полка)',
} : {
    continue: 'continue', search: 'search characters…', archive: 'archive', back: '‹ back',
    recent: 'recent', frequent: 'frequent', name: 'a–z', seeAll: 'all →', found: 'found',
    chatFrom: (d) => `chat from ${d}`,
    pinned: '✦ pinned', all: 'all', fresh: 'new', archived: 'archive',
    empty: 'Nothing here yet. Add a character and it will show up on the shelf.',
    noMatch: 'No one found.', noArchive: 'The archive is empty.', noChatsYet: 'no chats',
    today: 'today', yesterday: 'yesterday', justNow: 'just now', minAgo: (n) => `${n} min ago`, hAgo: (n) => `${n} h ago`,
    moon: ['new moon', 'waxing crescent', 'first quarter', 'waxing gibbous', 'full moon', 'waning gibbous', 'last quarter', 'waning crescent'],
    mes: 'mes', chats: 'chats', newChat: '+ new chat', pin: '✦ pin', unpin: '✦ unpin', toArchive: 'archive', fromArchive: 'unarchive',
    last: '✦ last', rename: 'rename', fav: '✦ favourite', unfav: '✦ unfavourite', download: 'download', del: 'delete',
    more: 'more', loading: 'loading chats…', noChats: 'This character has no chats yet.',
    renamePrompt: 'New chat name', deleteConfirm: 'Delete this chat? This cannot be undone.',
    renamed: 'Chat renamed.', deleted: 'Chat deleted.', failed: 'That did not work. See the console for details.',
    close: 'Close chat', panelClose: '“Close chat” cross on the top bar',
    panelHome: 'Custom home (shelf)',
};

/* ── helpers ──────────────────────────────────────────── */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stripExt = (name) => String(name || '').replace(/\.jsonl$/i, '');

// SillyTavern names new chats "Name - 2026-10-21@01h24m59s"; show those as a date instead
const AUTO_NAME = /^.* - (\d{4})-(\d{2})-(\d{2}) ?@(\d{2})h ?(\d{2})m ?(\d{2})s(?: ?\d+ms)?$/;
function chatTitle(file) {
    const name = stripExt(file);
    const m = name.match(AUTO_NAME);
    if (!m) return { text: name, auto: false };
    return { text: T.chatFrom(`${m[3]}.${m[2]}.${m[1].slice(2)}, ${m[4]}:${m[5]}`), auto: true };
}

function toMoment(value) {
    try {
        const m = ctx().timestampToMoment(value);
        return m && m.isValid && m.isValid() ? m : null;
    } catch { return null; }
}
function dayLabel(m) {
    if (!m) return '';
    const now = window.moment ? window.moment() : null;
    if (now && m.isSame(now, 'day')) return T.today;
    if (now && m.isSame(now.clone().subtract(1, 'day'), 'day')) return T.yesterday;
    return m.format('DD.MM');
}
const isToday = (m) => !!m && window.moment && m.isSame(window.moment(), 'day');
// "12 min ago" for the last day, then the same label as under the cameos
function agoLabel(m) {
    if (!m) return '';
    const min = Math.floor((Date.now() - m.valueOf()) / 6e4);
    if (min < 1) return T.justNow;
    if (min < 60) return T.minAgo(min);
    if (min < 1440) return T.hAgo(Math.floor(min / 60));
    return dayLabel(m);
}

// Mean lunar phase from the length of the synodic month. It can be half a day
// off the real sky, which is plenty for a glyph and a name.
const SYNODIC = 29.530588853;
function moonHtml() {
    const age = ((((Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 864e5) % SYNODIC) + SYNODIC) % SYNODIC;
    const f = age / SYNODIC;                    // 0 new · .5 full
    const quarter = [0, 1, 2, 3, 4].find((q) => Math.abs(age - q * SYNODIC / 4) <= 1.2);
    const name = T.moon[quarter !== undefined ? (quarter % 4) * 2 : Math.floor(f * 4) * 2 + 1];
    const a = Math.cos(2 * Math.PI * f);        // 1 new · -1 full
    const waxing = f < 0.5;
    // lit side: half of the limb, then the terminator back up as a squeezed arc
    const lit = `M7 2A5 5 0 0 ${waxing ? 1 : 0} 7 12A${(Math.abs(a) * 5).toFixed(2)} 5 0 0 ${(a > 0) === waxing ? 0 : 1} 7 2Z`;
    return `<span class="sc-moon" title="${esc(`${name} · ${Math.round((1 - a) * 50)}%`)}"><svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.5"/><path d="${lit}"/></svg>${esc(name)}</span>`;
}

// SillyTavern's own helpers that the context does not expose. Loaded lazily;
// if a future version renames one, that single action degrades instead of the whole home.
let stModule;
async function st() {
    if (stModule !== undefined) return stModule;
    try { stModule = await import('../../../../script.js'); }
    catch (e) { console.warn('[Shadow Cherry] script.js helpers unavailable', e); stModule = null; }
    return stModule;
}
function toast(kind, text) {
    try { window.toastr?.[kind]?.(text); } catch { /* no toasts */ }
}

/* ── state ────────────────────────────────────────────── */
// mode: 'shelf' (rows) · 'all' (everyone, as a grid) · 'page' (one character's chats)
const view = { mode: 'shelf', prev: 'shelf', avatar: null, query: '', archive: false, openMenu: null, chats: null };
const ROW_MAX = 12;       // cameos per sideways row; "frequent" and "all" appear once there are more
const lastSnips = new Map(); // avatar -> last line of their latest chat
const chatCounts = new Map();   // avatar -> number of chats (lazy, cached)
const pendingCounts = new Set(); // avatars whose count is being fetched right now

function characterIndex(avatar) {
    return ctx().characters.findIndex((c) => c.avatar === avatar);
}
function characterBy(avatar) {
    return ctx().characters.find((c) => c.avatar === avatar);
}
const hasChats = (c) => Number(c?.date_last_chat) > 0;
function chattedCharacters() {
    return ctx().characters.filter((c) => c && hasChats(c));
}

/* ── markup pieces ────────────────────────────────────── */
function cameo(c, cls = '') {
    const hasImg = c.avatar && c.avatar !== 'none';
    const src = hasImg ? ctx().getThumbnailUrl('avatar', c.avatar) : '';
    const initial = esc((c.name || '?').trim().charAt(0).toUpperCase());
    return `<span class="sc-cameo ${cls}" data-ini="${initial}">${hasImg ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">` : `<span class="sc-ini">${initial}</span>`}</span>`;
}

// under a cameo: day of the last chat and how many chats there are
function metaText(c) {
    if (!hasChats(c)) return T.noChatsYet;
    const count = chatCounts.get(c.avatar);
    return [dayLabel(toMoment(Number(c.date_last_chat))), count > 0 ? count : null].filter((x) => x !== null && x !== '').join(' · ');
}

function shelfItem(c, s, big = false) {
    const m = hasChats(c) ? toMoment(Number(c.date_last_chat)) : null;
    return `<button type="button" class="sc-sh ${big ? 'sc-big' : ''}" data-avatar="${esc(c.avatar)}" title="${esc(c.name)}">
        <span class="sc-wrapc">${cameo(c)}${s.pinned.includes(c.avatar) ? '<span class="sc-pin">✦</span>' : ''}${isToday(m) ? '<span class="sc-fresh"></span>' : ''}</span>
        <span class="sc-nm">${esc(c.name)}</span>
        <span class="sc-meta" data-meta-for="${esc(c.avatar)}">${esc(metaText(c))}</span>
    </button>`;
}

function sortList(list, filter) {
    const byDate = (a, b) => Number(b.date_last_chat) - Number(a.date_last_chat);
    if (filter === 'frequent') return [...list].sort((a, b) => Number(b.chat_size || 0) - Number(a.chat_size || 0) || byDate(a, b));
    if (filter === 'name') return [...list].sort((a, b) => String(a.name).localeCompare(String(b.name)) || byDate(a, b));
    return [...list].sort(byDate);
}
// search and archive list everyone: those with chats first, the rest by name
const chattedFirst = (list) => [...sortList(list.filter(hasChats), 'recent'), ...sortList(list.filter((c) => !hasChats(c)), 'name')];

function continueHtml(hidden) {
    const last = lastCharacter();
    if (!last) return '';
    const title = chatTitle(last.chat);
    const snip = lastSnips.get(last.avatar) || '';
    const line = [title.auto ? '' : title.text, snip].filter(Boolean).join(' · ');
    const ago = agoLabel(toMoment(Number(last.date_last_chat)));
    return `
        <button type="button" class="sc-cont sc-hud" data-continue="${esc(last.avatar)}"${hidden ? ' hidden' : ''}>
            ${cameo(last, 'sc-cameo-cont')}
            <span class="sc-cont-t">
                <b>${T.continue}${ago ? ` · ${esc(ago)}` : ''}</b>
                <span class="sc-nm">${esc(last.name)}</span>
                <span class="sc-cont-line">${esc(line)}</span>
            </span>
            <span class="sc-go" aria-hidden="true">›</span>
        </button>`;
}

function headHtml() {
    return `<div class="sc-head"><span class="sc-logo">Shadow Cherry</span><span class="sc-side"><span class="sc-jp">影色のさくらんぼ</span>${moonHtml()}</span></div>`;
}

function toolsHtml() {
    return `<div class="sc-tools">
            <label class="sc-search"><span aria-hidden="true">⌕</span><input type="search" id="sc-q" placeholder="${T.search}" value="${esc(view.query)}" autocomplete="off"></label>
            <button type="button" class="sc-btn ${view.archive ? 'sc-on' : ''}" data-act="archive-view">${view.archive ? T.back : T.archive}</button>
        </div>`;
}

const rowHtml = (label, list, s, { big = false, all = false } = {}) => !list.length ? '' : `
    <div class="sc-sec"><span>${label}</span>${all ? `<button type="button" class="sc-link" data-act="all">${T.seeAll}</button>` : ''}</div>
    <div class="sc-strip">${list.map((c) => shelfItem(c, s, big)).join('')}</div>`;

const gridHtml = (list, s) => `<div class="sc-shelf">${list.map((c) => shelfItem(c, s)).join('')}</div>`;

const emptyHtml = (text) => `<p class="sc-empty">${text}</p>`;

// everything under the search box
function shelfBody() {
    const s = getSettings();
    const q = view.query.trim().toLowerCase();
    const matches = (c) => !q || String(c.name).toLowerCase().includes(q);
    const everyone = ctx().characters.filter(Boolean);
    const shown = everyone.filter((c) => !s.archived.includes(c.avatar));

    if (view.archive) {
        const list = chattedFirst(everyone.filter((c) => s.archived.includes(c.avatar) && matches(c)));
        return list.length
            ? `<div class="sc-sec"><span>${T.archived} · ${list.length}</span></div>${gridHtml(list, s)}`
            : emptyHtml(q ? T.noMatch : T.noArchive);
    }
    if (q) {
        const list = chattedFirst(shown.filter(matches));
        return list.length
            ? `<div class="sc-sec"><span>${T.found} · ${list.length}</span></div>${gridHtml(list, s)}`
            : emptyHtml(T.noMatch);
    }
    if (!shown.length) return emptyHtml(T.empty);

    const isPinned = (c) => s.pinned.includes(c.avatar);
    const active = shown.filter(hasChats);
    // characters nobody has opened yet, newest card first
    const fresh = shown.filter((c) => !hasChats(c) && !isPinned(c))
        .sort((a, b) => Number(b.date_added || 0) - Number(a.date_added || 0));
    // "frequent" and "all" only once there are more characters than one row holds;
    // before that they would repeat the row above
    const many = active.length > ROW_MAX;
    return rowHtml(T.pinned, sortList(shown.filter(isPinned), 'recent'), s, { big: true })
        + rowHtml(T.recent, sortList(active.filter((c) => !isPinned(c)), 'recent').slice(0, ROW_MAX), s)
        + (many ? rowHtml(T.frequent, sortList(active, 'frequent').slice(0, ROW_MAX), s) : '')
        + (many ? rowHtml(`${T.all} · ${active.length}`, sortList(active, 'name').slice(0, ROW_MAX), s, { all: true }) : '')
        + rowHtml(T.fresh, fresh.slice(0, ROW_MAX), s);
}

let bodyDrawn = '';       // last html of the rows, to skip redraws that change nothing
function shelfHtml() {
    const searching = view.archive || !!view.query.trim();
    bodyDrawn = shelfBody();
    return headHtml() + continueHtml(searching) + toolsHtml() + `<div class="sc-body">${bodyDrawn}</div>`;
}

function allHtml() {
    const s = getSettings();
    const sort = ['recent', 'frequent', 'name'].includes(s.filter) ? s.filter : 'recent';
    const list = sortList(chattedCharacters().filter((c) => !s.archived.includes(c.avatar)), sort);
    return `
        <button type="button" class="sc-back" data-act="back">${T.back}</button>
        <div class="sc-sec"><span>${T.all} · ${list.length}</span></div>
        <div class="sc-chips" role="group">
            ${['recent', 'frequent', 'name'].map((f) => `<button type="button" data-filter="${f}" aria-pressed="${sort === f}">${T[f]}</button>`).join('')}
        </div>
        ${gridHtml(list, s)}`;
}

function lastCharacter() {
    const s = getSettings();
    return sortList(chattedCharacters().filter((c) => !s.archived.includes(c.avatar)), 'recent')[0];
}

// the continue bar shows a line from the last chat; fetched once per character
async function loadLastSnip() {
    const c = lastCharacter();
    if (!c || lastSnips.has(c.avatar)) return;
    lastSnips.set(c.avatar, '');
    try {
        const list = await fetchChats(c.avatar);
        if (!list.length) return;
        const want = `${stripExt(c.chat)}.jsonl`;
        const chat = list.find((x) => x.file_name === want) || list[0];
        lastSnips.set(c.avatar, cleanSnip(chat?.mes, 120));
        const line = homeEl?.querySelector('.sc-cont-line');
        const title = chatTitle(c.chat);
        if (line && view.mode === 'shelf') line.textContent = [title.auto ? '' : title.text, lastSnips.get(c.avatar)].filter(Boolean).join(' · ');
    } catch { /* the bar still works without the line */ }
}

// A preview line out of a message. Status panels, thoughts and code are not the
// story, so blocks like <details>…</details>, <info>…</info> or ```…``` go whole;
// tags that only format text (<b>, <i>, <span>…) keep what is inside them.
const FORMATTING = 'b|i|em|strong|u|s|del|span|font|q|a|mark|small|sub|sup|p';
const BLOCKS = new RegExp(`<(?!(?:${FORMATTING})\\b)([a-z][\\w-]*)\\b[^>]*>[\\s\\S]*?</\\1\\s*>`, 'gi');
function cleanSnip(text, max = 180) {
    const raw = String(text || '');
    if (raw === '[The chat is empty]') return '';     // SillyTavern's placeholder for an empty file
    const tidy = (t) => t
        .replace(/<[^>]*>/g, ' ')            // leftover tags
        .replace(/[*_~`]+/g, '')             // markdown emphasis
        .replace(/\s+/g, ' ').trim();
    const story = raw
        .replace(/<!--[\s\S]*?-->/g, ' ')    // hidden comments (other extensions keep data there)
        .replace(/```[\s\S]*?(?:```|$)/g, ' ')
        .replace(BLOCKS, ' ');
    return (tidy(story) || tidy(raw)).slice(0, max);
}

function chatRow(c, chat, i, isLast) {
    const s = getSettings();
    const title = chatTitle(chat.file_name);
    const fav = (s.favChats[c.avatar] || []).includes(chat.file_name);
    const m = toMoment(chat.last_mes);
    const meta = [m ? `${dayLabel(m)} · ${m.format('HH:mm')}` : '', chat.chat_items ? `${chat.chat_items} ${T.mes}` : ''].filter(Boolean).join(' · ');
    const snip = cleanSnip(chat.mes);
    const open = view.openMenu === i;
    return `<div class="sc-crow ${isLast ? 'sc-last' : ''}" data-file="${esc(chat.file_name)}">
        <button type="button" class="sc-crow-main" data-act="open-chat">
            <span class="sc-crow-t">${fav ? '<span class="sc-star">✦</span>' : ''}<span class="${title.auto ? 'sc-auto' : ''}">${esc(title.text)}</span>${isLast ? `<span class="sc-tag">${T.last}</span>` : ''}</span>
            ${meta ? `<span class="sc-meta">${esc(meta)}</span>` : ''}
            ${snip ? `<span class="sc-snip">${esc(snip)}</span>` : ''}
        </button>
        <button type="button" class="sc-more" data-act="menu" data-i="${i}" aria-expanded="${open}" aria-label="${T.more}">⋯</button>
        ${open ? `<div class="sc-acts">
            <button type="button" data-act="rename">${T.rename}</button>
            <button type="button" data-act="fav">${fav ? T.unfav : T.fav}</button>
            <button type="button" data-act="download">${T.download}</button>
            <button type="button" class="sc-del" data-act="delete">${T.del}</button>
        </div>` : ''}
    </div>`;
}

function pageHtml() {
    const s = getSettings();
    const c = characterBy(view.avatar);
    const pinned = s.pinned.includes(c.avatar), archived = s.archived.includes(c.avatar);
    let body, stat = '';
    if (!view.chats) body = emptyHtml(T.loading);
    else if (!view.chats.length) body = emptyHtml(T.noChats);
    else {
        const total = view.chats.reduce((sum, x) => sum + (Number(x.chat_items) || 0), 0);
        stat = `${view.chats.length} ${T.chats}${total ? ` · ${total} ${T.mes}` : ''}`;
        const lastFile = view.chats[0].file_name;
        const favs = s.favChats[c.avatar] || [];
        const ordered = [...view.chats].sort((a, b) => Number(favs.includes(b.file_name)) - Number(favs.includes(a.file_name)));
        body = ordered.map((chat) => chatRow(c, chat, view.chats.indexOf(chat), chat.file_name === lastFile)).join('');
    }
    return `
        <button type="button" class="sc-back" data-act="back">${T.back}</button>
        <div class="sc-dh">${cameo(c, 'sc-cameo-sm')}<span class="sc-nm">${esc(c.name)}</span>
            <button type="button" class="sc-btn sc-fill" data-act="new-chat">${T.newChat}</button></div>
        <div class="sc-dh-tools">
            <button type="button" class="sc-btn ${pinned ? 'sc-on' : ''}" data-act="pin">${pinned ? T.unpin : T.pin}</button>
            <button type="button" class="sc-btn ${archived ? 'sc-on' : ''}" data-act="archive">${archived ? T.fromArchive : T.toArchive}</button>
            ${stat ? `<span class="sc-meta sc-stat">${esc(stat)}</span>` : ''}
        </div>
        <div class="sc-chats">${body}</div>`;
}

/* ── render & mount ───────────────────────────────────── */
let homeEl = null;

const FOOT = '<div class="sc-foot" aria-hidden="true">✦</div>';

function render() {
    if (!homeEl || !homeEl.isConnected) return;
    if (view.mode === 'page' && !characterBy(view.avatar)) view.mode = 'shelf';
    homeEl.dataset.mode = view.mode;
    homeEl.innerHTML = (view.mode === 'page' ? pageHtml() : view.mode === 'all' ? allHtml() : shelfHtml()) + FOOT;
    if (view.mode !== 'page') loadCounts();
    if (view.mode === 'shelf') loadLastSnip();
}

// Typing in the search box redraws only the rows under it. The input itself is
// never replaced, so the phone keyboard keeps its state (autocorrect, dictation).
function renderBody({ onlyIfChanged = false } = {}) {
    const body = homeEl?.isConnected && view.mode === 'shelf' ? homeEl.querySelector('.sc-body') : null;
    if (!body) return;
    const html = shelfBody();
    if (onlyIfChanged && html === bodyDrawn) return;
    bodyDrawn = html;
    body.innerHTML = html;
    const cont = homeEl.querySelector('.sc-cont');
    if (cont) cont.hidden = view.archive || !!view.query.trim();
    loadCounts();
}

// Counts are asked only for the cameos on screen, once each; avatars already
// in flight are skipped, so typing in the search box never repeats a request.
async function loadCounts() {
    if (!homeEl) return;
    const onScreen = new Set([...homeEl.querySelectorAll('[data-meta-for]')].map((el) => el.dataset.metaFor));
    const want = [...onScreen].filter((a) => !chatCounts.has(a) && !pendingCounts.has(a) && hasChats(characterBy(a)));
    want.forEach((a) => pendingCounts.add(a));
    for (let i = 0; i < want.length; i += 4) {
        await Promise.all(want.slice(i, i + 4).map(async (avatar) => {
            try {
                const res = await fetch('/api/characters/chats', {
                    method: 'POST', headers: ctx().getRequestHeaders(),
                    body: JSON.stringify({ avatar_url: avatar, simple: true }),
                });
                const data = await res.json();
                chatCounts.set(avatar, Array.isArray(data) ? data.length : 0);
            } catch { chatCounts.set(avatar, null); }
            pendingCounts.delete(avatar);
            // the same character can sit in several rows at once
            const c = characterBy(avatar);
            if (c) homeEl?.querySelectorAll(`[data-meta-for="${CSS.escape(avatar)}"]`).forEach((metaEl) => { metaEl.textContent = metaText(c); });
        }));
        if (!homeEl?.isConnected) { want.forEach((a) => pendingCounts.delete(a)); return; }
    }
}

// a character's chats, newest first
async function fetchChats(avatar) {
    const res = await fetch('/api/characters/chats', {
        method: 'POST', headers: ctx().getRequestHeaders(),
        body: JSON.stringify({ avatar_url: avatar }),
    });
    const data = await res.json();
    const list = Array.isArray(data) ? data.filter((x) => x && x.file_name) : [];
    const time = (x) => toMoment(x.last_mes)?.valueOf() ?? 0;
    return list.sort((a, b) => time(b) - time(a));
}

// Reads the list again without the "loading" flash; null if it could not be read.
// The caller draws.
async function reloadChats(avatar) {
    try {
        const list = await fetchChats(avatar);
        chatCounts.set(avatar, list.length);
        if (view.mode === 'page' && view.avatar === avatar) view.chats = list;
        return list;
    } catch (e) {
        console.error('[Shadow Cherry] could not load chats', e);
        return null;
    }
}

async function loadChats(avatar) {
    view.chats = null;
    render();
    if (!await reloadChats(avatar) && view.avatar === avatar) view.chats = [];
    render();
}

function isWelcomeShowing(chatEl) {
    return !!chatEl.querySelector(':scope > .welcomePanel') && ctx().getCurrentChatId() === undefined;
}

function mount() {
    const chatEl = document.getElementById('chat');
    if (!chatEl) return;
    const s = getSettings();
    const want = s.home && isWelcomeShowing(chatEl);
    if (!want) {
        if (homeEl?.isConnected) homeEl.remove();
        return;
    }
    if (homeEl?.isConnected && homeEl.parentElement === chatEl) return;
    homeEl = document.createElement('div');
    homeEl.id = 'sc-home';
    chatEl.prepend(homeEl);
    Object.assign(view, { mode: 'shelf', prev: 'shelf', avatar: null, query: '', archive: false, openMenu: null, chats: null });
    // the rows rise in once, when the home appears; later redraws stay still
    const el = homeEl;
    el.classList.add('sc-enter');
    setTimeout(() => el.classList.remove('sc-enter'), 900);
    render();
    chatEl.scrollTop = 0;
}

/* ── actions ──────────────────────────────────────────── */
async function openCharacterChatFile(avatar, file) {
    const id = characterIndex(avatar);
    if (id < 0) return;
    try {
        await ctx().selectCharacterById(id);
        const m = await st();
        try { m?.setActiveCharacter?.(avatar); save(); } catch { /* optional */ }
        const name = stripExt(file);
        if (name && ctx().getCurrentChatId() !== name) await ctx().openCharacterChat(name);
    } catch (e) {
        console.error('[Shadow Cherry] open chat failed', e);
        toast('error', T.failed);
    }
}

async function newChat(avatar) {
    const id = characterIndex(avatar);
    if (id < 0) return;
    // opening a character without chats already starts the first one
    const first = view.avatar === avatar && Array.isArray(view.chats) ? !view.chats.length : !hasChats(characterBy(avatar));
    try {
        await ctx().selectCharacterById(id);
        if (first) return;
        const m = await st();
        if (m?.doNewChat) await m.doNewChat({ deleteCurrentChat: false });
        else document.getElementById('option_start_new_chat')?.click();
    } catch (e) {
        console.error('[Shadow Cherry] new chat failed', e);
        toast('error', T.failed);
    }
}

// favourites are remembered by file name, so they follow renames and go with deleted chats
function moveFav(avatar, from, to) {
    const favs = getSettings().favChats[avatar];
    const i = favs ? favs.indexOf(from) : -1;
    if (i < 0) return;
    favs[i] = to;
    save();
}
function dropFav(avatar, file) {
    const s = getSettings(), favs = s.favChats[avatar];
    const i = favs ? favs.indexOf(file) : -1;
    if (i < 0) return;
    favs.splice(i, 1);
    if (!favs.length) delete s.favChats[avatar];
    save();
}

let renaming = false;     // our own rename is in progress: skip the CHAT_RENAMED echo
async function renameChat(avatar, file) {
    const id = characterIndex(avatar);
    if (id < 0) return;
    const oldName = stripExt(file);
    const { callGenericPopup, POPUP_TYPE } = ctx();
    const typed = await callGenericPopup(`<h3>${esc(T.renamePrompt)}</h3>`, POPUP_TYPE.INPUT, oldName);
    const newName = typeof typed === 'string' ? typed.trim() : '';
    if (!newName || newName === oldName) return;
    try {
        const m = await st();
        if (!m?.renameGroupOrCharacterChat) throw new Error('renameGroupOrCharacterChat missing');
        const before = new Set((view.chats || []).map((x) => x.file_name));
        const wasCurrent = characterBy(avatar)?.chat === oldName;
        renaming = true;
        try { await m.renameGroupOrCharacterChat({ characterId: String(id), oldFileName: oldName, newFileName: newName, loader: false }); }
        finally { renaming = false; }
        // SillyTavern reports its own failures and may tidy the name, so read the result back
        const list = await reloadChats(avatar);
        if (list && !list.some((x) => x.file_name === file)) {
            const renamed = list.find((x) => !before.has(x.file_name))?.file_name || `${newName}.jsonl`;
            // "continue" opens the character's current chat: keep it pointing at this file
            if (wasCurrent) { try { await m.updateRemoteChatName?.(id, stripExt(renamed)); } catch { /* optional */ } }
            moveFav(avatar, file, renamed);
            toast('success', T.renamed);
        }
        render();
    } catch (e) {
        console.error('[Shadow Cherry] rename failed', e);
        toast('error', T.failed);
    }
}

async function deleteChat(avatar, file) {
    const id = characterIndex(avatar);
    if (id < 0) return;
    const { callGenericPopup, POPUP_TYPE } = ctx();
    const ok = await callGenericPopup(esc(T.deleteConfirm), POPUP_TYPE.CONFIRM);
    if (!ok) return;
    try {
        const m = await st();
        if (!m?.deleteCharacterChatByName) throw new Error('deleteCharacterChatByName missing');
        await m.deleteCharacterChatByName(String(id), stripExt(file));
        // it only logs when the server refuses, so check that the file is really gone
        const list = await reloadChats(avatar);
        if (list?.some((x) => x.file_name === file)) throw new Error('the chat is still there');
        dropFav(avatar, file);
        lastSnips.delete(avatar);
        if (list) toast('success', T.deleted);
        view.openMenu = null;
        render();
    } catch (e) {
        console.error('[Shadow Cherry] delete failed', e);
        toast('error', T.failed);
        render();
    }
}

async function downloadChat(avatar, file) {
    try {
        const res = await fetch('/api/chats/export', {
            method: 'POST', headers: ctx().getRequestHeaders(),
            body: JSON.stringify({ is_group: false, avatar_url: avatar, file, exportfilename: file, format: 'jsonl' }),
        });
        const data = await res.json();
        if (!res.ok || typeof data.result !== 'string') throw new Error(data?.message || 'export failed');
        const url = URL.createObjectURL(new Blob([data.result], { type: 'application/jsonl' }));
        const a = Object.assign(document.createElement('a'), { href: url, download: file });
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
        console.error('[Shadow Cherry] download failed', e);
        toast('error', T.failed);
    }
}

function toggleIn(list, value) {
    const i = list.indexOf(value);
    if (i >= 0) list.splice(i, 1); else list.push(value);
}

function onClick(e) {
    if (!homeEl || !homeEl.contains(e.target)) return;
    const s = getSettings();

    const sh = e.target.closest('.sc-sh');
    if (sh) {
        view.prev = view.mode === 'all' ? 'all' : 'shelf';
        view.mode = 'page'; view.avatar = sh.dataset.avatar; view.openMenu = null;
        document.getElementById('chat').scrollTop = 0;
        loadChats(view.avatar);
        return;
    }
    const cont = e.target.closest('[data-continue]');
    if (cont) { const c = characterBy(cont.dataset.continue); if (c) openCharacterChatFile(c.avatar, c.chat); return; }

    const chip = e.target.closest('[data-filter]');
    if (chip) { s.filter = chip.dataset.filter; save(); render(); return; }

    const actEl = e.target.closest('[data-act]');
    if (!actEl) {
        if (view.openMenu !== null && !e.target.closest('.sc-acts')) { view.openMenu = null; render(); }
        return;
    }
    const act = actEl.dataset.act;
    const row = actEl.closest('.sc-crow');
    const file = row?.dataset.file;
    const avatar = view.avatar;

    switch (act) {
        case 'archive-view': view.archive = !view.archive; view.query = ''; render(); break;
        case 'all': view.mode = 'all'; render(); document.getElementById('chat').scrollTop = 0; break;
        case 'back': view.mode = view.mode === 'page' ? view.prev : 'shelf'; view.prev = 'shelf'; view.avatar = null; view.openMenu = null; view.chats = null; render(); document.getElementById('chat').scrollTop = 0; break;
        case 'new-chat': newChat(avatar); break;
        case 'pin': toggleIn(s.pinned, avatar); save(); render(); break;
        case 'archive': toggleIn(s.archived, avatar); save(); render(); break;
        case 'open-chat': openCharacterChatFile(avatar, file); break;
        case 'menu': { const i = Number(actEl.dataset.i); view.openMenu = view.openMenu === i ? null : i; render(); break; }
        case 'rename': view.openMenu = null; render(); renameChat(avatar, file); break;
        case 'fav': { const list = (s.favChats[avatar] ||= []); toggleIn(list, file); if (!list.length) delete s.favChats[avatar]; save(); view.openMenu = null; render(); break; }
        case 'download': view.openMenu = null; render(); downloadChat(avatar, file); break;
        case 'delete': view.openMenu = null; render(); deleteChat(avatar, file); break;
    }
}

function onInput(e) {
    if (e.target?.id !== 'sc-q') return;
    view.query = e.target.value;
    renderBody();
}

// a picture that does not load gives way to the character's initial
function onImageError(e) {
    const frame = e.target instanceof HTMLImageElement ? e.target.closest('#sc-home .sc-cameo') : null;
    if (!frame) return;
    e.target.remove();
    frame.insertAdjacentHTML('beforeend', `<span class="sc-ini">${esc(frame.dataset.ini)}</span>`);
}

/* ── pins, archive and favourites follow the character ── */
function moveCharacter(from, to) {
    if (!from || !to || from === to) return;
    const s = getSettings();
    for (const list of [s.pinned, s.archived]) {
        const i = list.indexOf(from);
        if (i >= 0) list[i] = to;
    }
    if (s.favChats[from]) { s.favChats[to] = s.favChats[from]; delete s.favChats[from]; }
    chatCounts.delete(from); lastSnips.delete(from);
    save();
}
function dropCharacter(avatar) {
    if (!avatar) return;
    const s = getSettings();
    for (const list of [s.pinned, s.archived]) {
        const i = list.indexOf(avatar);
        if (i >= 0) list.splice(i, 1);
    }
    delete s.favChats[avatar];
    chatCounts.delete(avatar); lastSnips.delete(avatar);
    save();
}

/* ── close-chat cross on the top bar ──────────────────── */
// Sits before the first top-bar button and shows only while a chat is open.
// It is not a .drawer-toggle, so SillyTavern's drawer logic leaves it alone.
function closeButton() {
    let btn = document.getElementById('sc-close-chat');
    if (!btn) {
        const holder = document.getElementById('top-settings-holder');
        if (!holder) return null;
        btn = document.createElement('div');
        btn.id = 'sc-close-chat';
        btn.className = 'drawer';
        btn.innerHTML = `<div class="drawer-header"><div class="drawer-icon closedIcon interactable" role="button" tabindex="0" title="${T.close}" aria-label="${T.close}"></div></div>`;
        holder.prepend(btn);
        const icon = btn.querySelector('.drawer-icon');
        const run = async () => {
            try {
                const m = await st();
                if (m?.closeCurrentChat) await m.closeCurrentChat();
                else await ctx().executeSlashCommandsWithOptions?.('/closechat');
            } catch (e) {
                console.error('[Shadow Cherry] close chat failed', e);
                toast('error', T.failed);
            }
        };
        icon.addEventListener('click', run);
        icon.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run(); } });
    }
    return btn;
}
function updateCloseButton() {
    const s = getSettings();
    const btn = closeButton();
    if (!btn) return;
    btn.hidden = !s.closeButton || ctx().getCurrentChatId() === undefined;
}

/* ── settings panel ───────────────────────────────────── */
function buildPanel() {
    const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!host || document.getElementById('sc-settings')) return;
    host.insertAdjacentHTML('beforeend', `
        <div id="sc-settings" class="sc-settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b><span class="sc-star">✦</span> Shadow Cherry</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <label class="checkbox_label" for="sc-home-on">
                        <input id="sc-home-on" type="checkbox">
                        <span>${T.panelHome}</span>
                    </label>
                    <label class="checkbox_label" for="sc-close-on">
                        <input id="sc-close-on" type="checkbox">
                        <span>${T.panelClose}</span>
                    </label>
                </div>
            </div>
        </div>`);
    const s = getSettings();
    const box = document.getElementById('sc-home-on');
    box.checked = !!s.home;
    box.addEventListener('change', () => { s.home = box.checked; save(); mount(); });
    const closeBox = document.getElementById('sc-close-on');
    closeBox.checked = !!s.closeButton;
    closeBox.addEventListener('change', () => { s.closeButton = closeBox.checked; save(); updateCloseButton(); });
}

/* ── start ────────────────────────────────────────────── */
function init() {
    getSettings();
    buildPanel();

    const chatEl = document.getElementById('chat');
    if (chatEl) {
        new MutationObserver(() => mount()).observe(chatEl, { childList: true });
        chatEl.addEventListener('click', onClick);
        chatEl.addEventListener('input', onInput);
        chatEl.addEventListener('error', onImageError, true);
    }
    const { eventSource, eventTypes: E } = ctx();
    const on = (type, fn) => { if (type) eventSource?.on?.(type, fn); };     // older versions lack some events
    const redraw = () => { if (homeEl?.isConnected) render(); else mount(); };
    // the character whose chat is open: its count is what changes while the home is away
    const current = () => ctx().characters?.[ctx().characterId]?.avatar;

    on(E.CHAT_CHANGED, () => { lastSnips.clear(); chatCounts.delete(current()); setTimeout(() => { mount(); updateCloseButton(); }, 0); });
    on(E.CHAT_DELETED, (name) => { const a = current(); if (a) { chatCounts.delete(a); dropFav(a, `${name}.jsonl`); } lastSnips.clear(); redraw(); });
    on(E.CHAT_RENAMED, (d) => { if (!renaming && d?.avatarId && !d.groupId) moveFav(d.avatarId, d.oldFileName, d.newFileName); });
    on(E.CHARACTER_EDITED, redraw);
    on(E.CHARACTER_RENAMED, moveCharacter);
    on(E.CHARACTER_DELETED, (d) => { dropCharacter(d?.character?.avatar); redraw(); });
    // the character list was read again (a new card, an import): show it without touching the search box
    on(E.CHARACTER_PAGE_LOADED, () => renderBody({ onlyIfChanged: true }));
    mount();
    updateCloseButton();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
