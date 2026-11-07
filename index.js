/*  ✦  Shadow Cherry  ✦
    影色のさくらんぼ · fog, ash & porcelain rose
    a SillyTavern extension by ewwn1h

    Replaces the welcome screen with a shelf of character cameos.
    Tap a cameo to see that character's chats; pin, archive, search, filter.
    The theme itself lives in the Moonlit Echoes preset.
*/

const MODULE = 'shadowCherry';
const DEFAULTS = Object.freeze({
    home: true,
    closeButton: true,
    filter: 'recent',
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
    recent: 'недавние', active: 'активные', frequent: 'частые',
    pinned: '✦ закреплённые', all: 'все', archived: 'архив', empty: 'Пока здесь пусто. Начните чат с кем-нибудь из персонажей.',
    noMatch: 'Никого не нашлось.', today: 'сегодня', yesterday: 'вчера',
    chats: n => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'чат' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'чата' : 'чатов'}`,
    mes: 'mes', newChat: '+ новый чат', pin: '✦ закрепить', unpin: '✦ открепить', toArchive: 'в архив', fromArchive: 'из архива',
    last: '✦ last', rename: 'переименовать', fav: '✦ избранное', unfav: '✦ убрать', download: 'скачать', del: 'удалить',
    showAll: (n) => `показать всех · ${n}`, collapse: 'свернуть',
    more: 'ещё', loading: 'загружаю чаты…', noChats: 'У этого персонажа пока нет чатов.',
    renamePrompt: 'Новое название чата', deleteConfirm: 'Удалить этот чат? Вернуть его не получится.',
    renamed: 'Чат переименован.', deleted: 'Чат удалён.', failed: 'Не получилось. Подробности в консоли.',
    close: 'Закрыть чат', panelClose: 'Крестик «закрыть чат» на верхней панели',
    panelHome: 'Своя главная (полка)', panelNote: 'Заменяет стартовый экран полкой с камеями. Если стоит Character Chat Pills, отключите его, чтобы главные не спорили.',
} : {
    continue: 'continue', search: 'search characters…', archive: 'archive', back: '‹ back',
    recent: 'recent', active: 'active', frequent: 'frequent',
    pinned: '✦ pinned', all: 'all', archived: 'archive', empty: 'Nothing here yet. Start a chat with one of your characters.',
    noMatch: 'No one found.', today: 'today', yesterday: 'yesterday',
    chats: n => `${n} chat${n === 1 ? '' : 's'}`,
    mes: 'mes', newChat: '+ new chat', pin: '✦ pin', unpin: '✦ unpin', toArchive: 'archive', fromArchive: 'unarchive',
    last: '✦ last', rename: 'rename', fav: '✦ favourite', unfav: '✦ unfavourite', download: 'download', del: 'delete',
    showAll: (n) => `show all · ${n}`, collapse: 'collapse',
    more: 'more', loading: 'loading chats…', noChats: 'This character has no chats yet.',
    renamePrompt: 'New chat name', deleteConfirm: 'Delete this chat? This cannot be undone.',
    renamed: 'Chat renamed.', deleted: 'Chat deleted.', failed: 'That did not work. See the console for details.',
    close: 'Close chat', panelClose: '“Close chat” cross on the top bar',
    panelHome: 'Custom home (shelf)', panelNote: 'Replaces the welcome screen with a shelf of cameos. If Character Chat Pills is installed, turn it off so the two homes do not clash.',
};

/* ── helpers ──────────────────────────────────────────── */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stripExt = (name) => String(name || '').replace(/\.jsonl$/i, '');

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
const view = { mode: 'shelf', avatar: null, query: '', archive: false, openMenu: null, chats: null, expanded: false };
const FOLD_AT = 8;        // two rows of four
const TEASER = 4;         // a faded third row hints that there is more
const lastSnips = new Map(); // avatar -> last line of their latest chat
const chatCounts = new Map();   // avatar -> number of chats (lazy, cached)

function characterIndex(avatar) {
    return ctx().characters.findIndex((c) => c.avatar === avatar);
}
function characterBy(avatar) {
    return ctx().characters.find((c) => c.avatar === avatar);
}
function chattedCharacters() {
    return ctx().characters.filter((c) => c && Number(c.date_last_chat) > 0);
}

/* ── markup pieces ────────────────────────────────────── */
function cameo(c, cls = '') {
    const hasImg = c.avatar && c.avatar !== 'none';
    const src = hasImg ? ctx().getThumbnailUrl('avatar', c.avatar) : '';
    const initial = esc((c.name || '?').trim().charAt(0).toUpperCase());
    return `<span class="sc-cameo ${cls}">${hasImg ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">` : `<span class="sc-ini">${initial}</span>`}</span>`;
}

function shelfItem(c, s) {
    const m = toMoment(Number(c.date_last_chat));
    const count = chatCounts.get(c.avatar);
    const meta = [dayLabel(m), count > 0 ? count : null].filter((x) => x !== null && x !== '').join(' · ');
    return `<button type="button" class="sc-sh" data-avatar="${esc(c.avatar)}" title="${esc(c.name)}">
        <span class="sc-wrapc">${cameo(c)}${s.pinned.includes(c.avatar) ? '<span class="sc-pin">✦</span>' : ''}${isToday(m) ? '<span class="sc-fresh"></span>' : ''}</span>
        <span class="sc-nm">${esc(c.name)}</span>
        <span class="sc-meta" data-meta-for="${esc(c.avatar)}">${esc(meta)}</span>
    </button>`;
}

function sortList(list, filter) {
    const byDate = (a, b) => Number(b.date_last_chat) - Number(a.date_last_chat);
    if (filter === 'frequent') return [...list].sort((a, b) => Number(b.chat_size || 0) - Number(a.chat_size || 0) || byDate(a, b));
    if (filter === 'active') {
        const week = Date.now() - 7 * 24 * 3600 * 1000;
        return list.filter((c) => Number(c.date_last_chat) >= week).sort(byDate);
    }
    return [...list].sort(byDate);
}

function shelfHtml() {
    const s = getSettings();
    const q = view.query.trim().toLowerCase();
    let list = chattedCharacters().filter((c) => view.archive ? s.archived.includes(c.avatar) : !s.archived.includes(c.avatar));
    if (q) list = list.filter((c) => String(c.name).toLowerCase().includes(q));
    list = sortList(list, s.filter);

    const last = lastCharacter();
    const snip = last ? lastSnips.get(last.avatar) : '';
    const cont = !view.archive && !q && last ? `
        <button type="button" class="sc-cont sc-hud" data-continue="${esc(last.avatar)}">
            ${cameo(last, 'sc-cameo-cont')}
            <span class="sc-cont-t">
                <b>${T.continue}</b>
                <span class="sc-nm">${esc(last.name)}</span>
                <span class="sc-cont-line">${last.chat ? esc(stripExt(last.chat)) : ''}${snip ? ` · ${esc(snip)}` : ''}</span>
            </span>
            <span class="sc-go" aria-hidden="true">›</span>
        </button>` : '';

    const pinned = view.archive ? [] : list.filter((c) => s.pinned.includes(c.avatar));
    const rest = view.archive ? list : list.filter((c) => !s.pinned.includes(c.avatar));
    const empty = !chattedCharacters().length ? T.empty : !list.length ? T.noMatch : '';

    // fold the main shelf to two rows unless searching, browsing the archive or expanded
    const canFold = !q && !view.archive && rest.length > FOLD_AT;
    const folded = canFold && !view.expanded;
    const shown = folded ? rest.slice(0, FOLD_AT + TEASER) : rest;

    return `
        <div class="sc-head"><span class="sc-logo">Shadow Cherry</span><span class="sc-jp">影色のさくらんぼ</span></div>
        ${cont}
        <div class="sc-tools">
            <label class="sc-search"><span aria-hidden="true">⌕</span><input type="search" id="sc-q" placeholder="${T.search}" value="${esc(view.query)}" autocomplete="off"></label>
            <button type="button" class="sc-btn ${view.archive ? 'sc-on' : ''}" data-act="archive-view">${view.archive ? T.back : T.archive}</button>
        </div>
        ${view.archive ? '' : `<div class="sc-chips" role="group">
            ${['recent', 'active', 'frequent'].map((f) => `<button type="button" data-filter="${f}" aria-pressed="${s.filter === f}">${T[f]}</button>`).join('')}
        </div>`}
        ${pinned.length ? `<div class="sc-orn"><span>${T.pinned}</span></div><div class="sc-shelf">${pinned.map((c) => shelfItem(c, s)).join('')}</div>` : ''}
        ${rest.length ? `<div class="sc-orn"><span>${view.archive ? T.archived : T.all} · ${rest.length}</span></div>
            <div class="sc-fold ${folded ? 'sc-closed' : ''}"><div class="sc-shelf">${shown.map((c) => shelfItem(c, s)).join('')}</div></div>
            ${canFold ? `<button type="button" class="sc-btn sc-fold-btn" data-act="fold" aria-expanded="${!folded}">${folded ? T.showAll(rest.length) : T.collapse}</button>` : ''}` : ''}
        ${empty ? `<p class="sc-empty">${empty}</p>` : ''}`;
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
        const res = await fetch('/api/characters/chats', {
            method: 'POST', headers: ctx().getRequestHeaders(),
            body: JSON.stringify({ avatar_url: c.avatar }),
        });
        const data = await res.json();
        if (!Array.isArray(data) || !data.length) return;
        const want = `${stripExt(c.chat)}.jsonl`;
        const time = (x) => toMoment(x.last_mes)?.valueOf() ?? 0;
        const chat = data.find((x) => x.file_name === want) || [...data].sort((a, b) => time(b) - time(a))[0];
        lastSnips.set(c.avatar, cleanSnip(chat?.mes, 120));
        const line = homeEl?.querySelector('.sc-cont-line');
        if (line && view.mode === 'shelf') line.textContent = [stripExt(c.chat), lastSnips.get(c.avatar)].filter(Boolean).join(' · ');
    } catch { /* the bar still works without the line */ }
}

function cleanSnip(text, max = 180) {
    return String(text || '')
        .replace(/<[^>]*>/g, ' ')            // html tags
        .replace(/[*_~`]+/g, '')             // markdown emphasis
        .replace(/\s+/g, ' ').trim().slice(0, max);
}

function chatRow(c, chat, i, isLast) {
    const s = getSettings();
    const name = stripExt(chat.file_name);
    const fav = (s.favChats[c.avatar] || []).includes(chat.file_name);
    const m = toMoment(chat.last_mes);
    const meta = [m ? `${dayLabel(m)} · ${m.format('HH:mm')}` : '', chat.chat_items ? `${chat.chat_items} ${T.mes}` : ''].filter(Boolean).join(' · ');
    const snip = cleanSnip(chat.mes);
    const open = view.openMenu === i;
    return `<div class="sc-crow ${isLast ? 'sc-last' : ''}" data-file="${esc(chat.file_name)}">
        <button type="button" class="sc-crow-main" data-act="open-chat">
            <span class="sc-crow-t">${fav ? '<span class="sc-star">✦</span>' : ''}<span>${esc(name)}</span>${isLast ? `<span class="sc-tag">${T.last}</span>` : ''}</span>
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
    if (!c) { view.mode = 'shelf'; return shelfHtml(); }
    const pinned = s.pinned.includes(c.avatar), archived = s.archived.includes(c.avatar);
    let body;
    if (!view.chats) body = `<p class="sc-empty">${T.loading}</p>`;
    else if (!view.chats.length) body = `<p class="sc-empty">${T.noChats}</p>`;
    else {
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
        </div>
        <div class="sc-chats">${body}</div>`;
}

/* ── render & mount ───────────────────────────────────── */
let homeEl = null;

function render({ keepFocus = false } = {}) {
    if (!homeEl || !homeEl.isConnected) return;
    const caret = keepFocus ? document.getElementById('sc-q')?.selectionStart : null;
    homeEl.dataset.mode = view.mode;
    homeEl.innerHTML = view.mode === 'page' ? pageHtml() : shelfHtml();
    if (keepFocus) {
        const q = document.getElementById('sc-q');
        if (q) { q.focus(); if (caret != null) q.setSelectionRange(caret, caret); }
    }
    if (view.mode === 'shelf') { loadCounts(); loadLastSnip(); }
}

async function loadCounts() {
    const want = chattedCharacters().map((c) => c.avatar).filter((a) => !chatCounts.has(a));
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
            const metaEl = homeEl?.querySelector(`[data-meta-for="${CSS.escape(avatar)}"]`);
            const c = characterBy(avatar);
            if (metaEl && c) {
                const n = chatCounts.get(avatar);
                metaEl.textContent = [dayLabel(toMoment(Number(c.date_last_chat))), n > 0 ? n : null].filter((x) => x !== null && x !== '').join(' · ');
            }
        }));
        if (!homeEl?.isConnected) return;
    }
}

async function loadChats(avatar) {
    view.chats = null;
    render();
    try {
        const res = await fetch('/api/characters/chats', {
            method: 'POST', headers: ctx().getRequestHeaders(),
            body: JSON.stringify({ avatar_url: avatar }),
        });
        const data = await res.json();
        const list = Array.isArray(data) ? data.filter((x) => x && x.file_name) : [];
        const time = (x) => toMoment(x.last_mes)?.valueOf() ?? 0;
        list.sort((a, b) => time(b) - time(a));
        if (view.avatar !== avatar) return;
        view.chats = list;
        chatCounts.set(avatar, list.length);
    } catch (e) {
        console.error('[Shadow Cherry] could not load chats', e);
        view.chats = [];
    }
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
    view.mode = 'shelf'; view.avatar = null; view.openMenu = null; view.chats = null;
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
        try { m?.setActiveCharacter?.(avatar); ctx().saveSettingsDebounced(); } catch { /* optional */ }
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
    try {
        await ctx().selectCharacterById(id);
        const m = await st();
        if (m?.doNewChat) await m.doNewChat({ deleteCurrentChat: false });
        else document.getElementById('option_start_new_chat')?.click();
    } catch (e) {
        console.error('[Shadow Cherry] new chat failed', e);
        toast('error', T.failed);
    }
}

async function renameChat(avatar, file) {
    const id = characterIndex(avatar);
    const oldName = stripExt(file);
    const { callGenericPopup, POPUP_TYPE } = ctx();
    const newName = await callGenericPopup(`<h3>${esc(T.renamePrompt)}</h3>`, POPUP_TYPE.INPUT, oldName);
    if (!newName || typeof newName !== 'string' || newName.trim() === oldName) return;
    try {
        const m = await st();
        if (!m?.renameGroupOrCharacterChat) throw new Error('renameGroupOrCharacterChat missing');
        await m.renameGroupOrCharacterChat({ characterId: String(id), oldFileName: oldName, newFileName: newName.trim(), loader: false });
        try { await m.updateRemoteChatName?.(id, newName.trim()); } catch { /* optional */ }
        const s = getSettings(), favs = s.favChats[avatar];
        if (favs?.includes(file)) { favs[favs.indexOf(file)] = `${newName.trim()}.jsonl`; save(); }
        toast('success', T.renamed);
        loadChats(avatar);
    } catch (e) {
        console.error('[Shadow Cherry] rename failed', e);
        toast('error', T.failed);
    }
}

async function deleteChat(avatar, file) {
    const { callGenericPopup, POPUP_TYPE } = ctx();
    const ok = await callGenericPopup(esc(T.deleteConfirm), POPUP_TYPE.CONFIRM);
    if (!ok) return;
    try {
        const m = await st();
        if (!m?.deleteCharacterChatByName) throw new Error('deleteCharacterChatByName missing');
        await m.deleteCharacterChatByName(String(characterIndex(avatar)), stripExt(file));
        const s = getSettings(), favs = s.favChats[avatar];
        if (favs?.includes(file)) { favs.splice(favs.indexOf(file), 1); save(); }
        chatCounts.delete(avatar);
        toast('success', T.deleted);
        view.openMenu = null;
        loadChats(avatar);
    } catch (e) {
        console.error('[Shadow Cherry] delete failed', e);
        toast('error', T.failed);
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
        case 'fold': view.expanded = !view.expanded; render(); break;
        case 'back': view.mode = 'shelf'; view.avatar = null; view.openMenu = null; view.chats = null; render(); document.getElementById('chat').scrollTop = 0; break;
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
    render({ keepFocus: true });
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
        btn.innerHTML = `<div class="sc-close-toggle drawer-header"><div class="drawer-icon closedIcon interactable" role="button" tabindex="0" title="${T.close}" aria-label="${T.close}"></div></div>`;
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
                    <small class="sc-note">${T.panelNote}</small>
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
    }
    const { eventSource, eventTypes } = ctx();
    const refresh = () => { chatCounts.clear(); lastSnips.clear(); if (homeEl?.isConnected) render(); else mount(); };
    eventSource?.on?.(eventTypes.CHAT_CHANGED, () => { lastSnips.clear(); setTimeout(() => { mount(); updateCloseButton(); }, 0); });
    eventSource?.on?.(eventTypes.CHARACTER_EDITED, refresh);
    eventSource?.on?.(eventTypes.CHARACTER_DELETED, refresh);
    eventSource?.on?.(eventTypes.CHAT_DELETED, refresh);
    mount();
    updateCloseButton();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
