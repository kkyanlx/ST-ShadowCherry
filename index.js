/*  ✦  Shadow Cherry  ✦
    影色のさくらんぼ · fog, ash & porcelain rose
    a SillyTavern extension by ewwn1h

    Replaces the welcome screen with rows of character cameos that scroll
    sideways (pinned, recent, frequent, everyone, new) and adds a "close chat"
    cross to the top bar. Tap a cameo to see that character's chats and search
    inside them; draw a tarot card to pick someone at random. While a reply is
    on its way, the moth on the stop button flaps its wings and the character's
    cameo glows under the last message with three twinkling stars.
    The theme itself lives in the Moonlit Echoes preset.
*/

const MODULE = 'shadowCherry';
const DEFAULTS = Object.freeze({
    home: true,
    closeButton: true,
    dropCap: true,         // big first letter in the character's messages
    typing: true,          // "is typing": cameo and stars under the last message
    tags: true,            // a row of the characters' tags under the search box
    hint: null,            // text in the empty message box; null = ours, '' = nothing
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
    retry: 'Повторить', listError: 'Не удалось загрузить список чатов.', readError: 'Не удалось прочитать чат.',
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
    panelHome: 'Своя главная (полка)', panelDropCap: 'Буквица в сообщениях персонажа',
    panelTyping: 'Камея «пишет…» под последним сообщением', typing: (n) => `${n} пишет…`,
    panelHint: 'Подсказка в поле ввода', hint: 'шепни в туман…', hintEmpty: 'пусто — без подсказки',
    tagged: 'по тегам', clearTags: 'сбросить ×', tagsLabel: 'теги', panelTags: 'Теги персонажей на полке',
    tagsPrev: 'Прокрутить теги влево', tagsNext: 'Прокрутить теги вправо',
    chatSearch: 'найти в чатах…', searching: 'ищу…', noHits: 'Ничего не нашлось.', moreChats: 'ещё чаты',
    hitsMore: (n) => `и ещё ${n}`, inTitle: 'совпадение в названии или в скрытом тексте',
    draw: 'вытянуть карту', openChat: 'открыть чат', startChat: 'начать чат', drawAgain: 'ещё карту', closeT: 'закрыть',
    arcana: [
        ['Шут', 'шаг в неизвестность, чистый лист'], ['Маг', 'всё, что нужно, уже в руках'],
        ['Верховная Жрица', 'тайна, интуиция, недосказанное'], ['Императрица', 'нежность, забота, изобилие'],
        ['Император', 'порядок, власть, твёрдая рука'], ['Иерофант', 'традиции, правила, клятвы'],
        ['Влюблённые', 'выбор сердцем'], ['Колесница', 'напор, движение, победа'],
        ['Сила', 'мягкость сильнее ярости'], ['Отшельник', 'тишина, одиночество, свой свет'],
        ['Колесо Фортуны', 'судьба делает поворот'], ['Справедливость', 'правда и её последствия'],
        ['Повешенный', 'пауза, взгляд под другим углом'], ['Смерть', 'одно кончается, другое начинается'],
        ['Умеренность', 'равновесие, медленное сближение'], ['Дьявол', 'искушение, одержимость, запретное'],
        ['Башня', 'внезапный перелом'], ['Звезда', 'надежда, исцеление'],
        ['Луна', 'иллюзии и страхи, всё не то, чем кажется'], ['Солнце', 'радость, тепло, ясность'],
        ['Суд', 'пробуждение, второй шанс'], ['Мир', 'круг замкнулся'],
    ],
} : {
    retry: 'Retry', listError: 'Could not load the chat list.', readError: 'Could not read this chat.',
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
    panelHome: 'Custom home (shelf)', panelDropCap: 'Drop cap in the character’s messages',
    panelTyping: '“Is typing” cameo under the last message', typing: (n) => `${n} is typing…`,
    panelHint: 'Message box hint', hint: '<3', hintEmpty: 'empty means no hint',
    tagged: 'by tags', clearTags: 'clear ×', tagsLabel: 'tags', panelTags: 'Character tags on the shelf',
    tagsPrev: 'Scroll tags left', tagsNext: 'Scroll tags right',
    chatSearch: 'search in chats…', searching: 'searching…', noHits: 'Nothing found.', moreChats: 'more chats',
    hitsMore: (n) => `and ${n} more`, inTitle: 'matched in the name or in hidden text',
    draw: 'draw a card', openChat: 'open chat', startChat: 'start a chat', drawAgain: 'draw again', closeT: 'close',
    arcana: [
        ['The Fool', 'a leap into the unknown, a clean slate'], ['The Magician', 'everything you need is already here'],
        ['The High Priestess', 'secrets, intuition, things left unsaid'], ['The Empress', 'tenderness, care, abundance'],
        ['The Emperor', 'order, power, a firm hand'], ['The Hierophant', 'tradition, rules, vows'],
        ['The Lovers', 'a choice made by the heart'], ['The Chariot', 'drive, momentum, victory'],
        ['Strength', 'gentleness stronger than rage'], ['The Hermit', 'silence, solitude, an inner light'],
        ['Wheel of Fortune', 'fate takes a turn'], ['Justice', 'truth and its consequences'],
        ['The Hanged Man', 'a pause, a new angle'], ['Death', 'one thing ends, another begins'],
        ['Temperance', 'balance, a slow coming together'], ['The Devil', 'temptation, obsession, the forbidden'],
        ['The Tower', 'sudden upheaval'], ['The Star', 'hope, healing'],
        ['The Moon', 'illusions and fears, nothing is what it seems'], ['The Sun', 'joy, warmth, clarity'],
        ['Judgement', 'awakening, a second chance'], ['The World', 'the circle closes'],
    ],
};
const NUMERALS = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];

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
const view = { mode: 'shelf', prev: 'shelf', avatar: null, query: '', tags: [], archive: false, openMenu: null, chats: null, chatQuery: '', found: null };
const ROW_MAX = 12;       // cameos per sideways row; "frequent" and "all" appear once there are more
const lastSnips = new Map(); // avatar -> last line of their latest chat
const chatCounts = new Map();   // avatar -> number of chats (lazy, cached)
const pendingCounts = new Set(); // avatars whose count is being fetched right now
const snipVersions = new Map();
const snipChats = new Map();
const snipRequests = new Map();

function invalidateSnip(avatar) {
    lastSnips.delete(avatar);
    snipChats.delete(avatar);
    snipVersions.set(avatar, (snipVersions.get(avatar) || 0) + 1);
    snipRequests.get(avatar)?.abort();
}
function captureCurrentSnip() {
    const context = ctx();
    if (context.getCurrentChatId() === undefined) return;
    const c = context.characters?.[context.characterId];
    if (!c || !Array.isArray(context.chat)) return;
    const file = stripExt(context.getCurrentChatId());
    // Do not associate a welcome/temporary chat with a character's saved chat.
    if (file !== stripExt(c.chat)) return;
    let last;
    for (let i = context.chat.length - 1; i >= 0; i--) {
        if (typeof context.chat[i]?.mes === 'string' && !context.chat[i].is_system) { last = context.chat[i]; break; }
    }
    invalidateSnip(c.avatar);
    lastSnips.set(c.avatar, cleanSnip(last?.mes, 120));
    snipChats.set(c.avatar, file);
}

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

/* ── tags ─────────────────────────────────────────────── */
// SillyTavern keeps the tags in a list and, for each character's avatar, the ids of its tags
function tagBook() {
    const { tags, tagMap } = ctx();
    const byId = new Map((Array.isArray(tags) ? tags : []).filter((t) => t && t.id !== undefined && t.name).map((t) => [String(t.id), t]));
    const of = (c) => [...new Set((tagMap?.[c?.avatar] || []).map(String))].filter((id) => byId.has(id));
    return { byId, of };
}
const tagsOn = () => !!getSettings().tags;

// the tags present on the characters in view, the most used first
function tagRowHtml(list) {
    if (!tagsOn()) return '';
    const book = tagBook();
    const count = new Map();
    for (const c of list) for (const id of book.of(c)) count.set(id, (count.get(id) || 0) + 1);
    for (const id of view.tags) if (!count.has(id) && book.byId.has(id)) count.set(id, 0);
    if (!count.size) return '';
    const ids = [...count.keys()].sort((a, b) => count.get(b) - count.get(a) || String(book.byId.get(a).name).localeCompare(String(book.byId.get(b).name)));
    return `<div class="sc-tags">
        <button type="button" class="sc-tag-arrow" data-act="tags-prev" aria-label="${T.tagsPrev}" title="${T.tagsPrev}" aria-controls="sc-shelf-tags" disabled><svg viewBox="0 0 12 14" aria-hidden="true"><path d="M8 2L3 7l5 5"/></svg></button>
        <div id="sc-shelf-tags" class="sc-tagrow" role="group" aria-label="${T.tagsLabel}">${ids.map((id) => `<button type="button" data-tag="${esc(id)}" aria-pressed="${view.tags.includes(id)}">${esc(book.byId.get(id).name)}<span class="sc-tag-n">${count.get(id)}</span></button>`).join('')}</div>
        <button type="button" class="sc-tag-arrow" data-act="tags-next" aria-label="${T.tagsNext}" title="${T.tagsNext}" aria-controls="sc-shelf-tags" disabled><svg viewBox="0 0 12 14" aria-hidden="true"><path d="M3 2l5 5-5 5"/></svg></button>
    </div>`;
}

// Keep the touch scroller native. Desktop arrows and vertical mouse-wheel
// scrolling share it; at either end, the wheel can scroll the page again.
let cleanupTagScroller = () => {};
function setupTagScroller() {
    cleanupTagScroller();
    cleanupTagScroller = () => {};
    const wrap = homeEl?.querySelector('.sc-tags');
    const row = wrap?.querySelector('.sc-tagrow');
    if (!row) return;
    const prev = wrap.querySelector('[data-act="tags-prev"]');
    const next = wrap.querySelector('[data-act="tags-next"]');
    const update = () => {
        if (!row.isConnected) return;
        // Measure against the full wrapper so the arrows disappear as soon as
        // the tags fit without them, including after a window resize.
        wrap.dataset.overflow = String(row.scrollWidth > wrap.clientWidth + 1);
        const max = row.scrollWidth - row.clientWidth;
        prev.disabled = row.scrollLeft <= 1;
        next.disabled = row.scrollLeft >= max - 1;
        wrap.dataset.canPrev = String(!prev.disabled);
        wrap.dataset.canNext = String(!next.disabled);
    };
    const onWheel = (e) => {
        // Preserve pinch-to-zoom, Shift+wheel and native horizontal trackpad input.
        if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || !e.deltaY || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? row.clientWidth : 1;
        const delta = e.deltaY * scale;
        const max = row.scrollWidth - row.clientWidth;
        if (!e.cancelable || (delta > 0 ? row.scrollLeft >= max - 1 : row.scrollLeft <= 1)) return;
        e.preventDefault();
        row.scrollLeft += delta;
    };
    row.addEventListener('scroll', update, { passive: true });
    row.addEventListener('wheel', onWheel, { passive: false });
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
    observer?.observe(wrap);
    observer?.observe(row);
    window.addEventListener('resize', update);
    document.fonts?.addEventListener('loadingdone', update);
    update();
    document.fonts?.ready.then(update);
    cleanupTagScroller = () => {
        observer?.disconnect();
        row.removeEventListener('scroll', update);
        row.removeEventListener('wheel', onWheel);
        window.removeEventListener('resize', update);
        document.fonts?.removeEventListener('loadingdone', update);
    };
}

function scrollTags(direction) {
    const row = homeEl?.querySelector('.sc-tags .sc-tagrow');
    if (!row) return;
    row.scrollBy({
        left: direction * row.clientWidth * .75,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
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

// a small tarot card with a star, for the "draw a card" button
const CARD_ICON = '<svg viewBox="0 0 16 20" aria-hidden="true"><rect x="2.5" y="1.5" width="11" height="17" rx="1.2"/><rect x="4.5" y="3.5" width="7" height="13" rx=".4" stroke-width=".7"/><path d="M8 6.6Q8.3 9.7 11 10Q8.3 10.3 8 13.4Q7.7 10.3 5 10Q7.7 9.7 8 6.6Z" fill="currentColor" stroke="none"/></svg>';

function toolsHtml() {
    return `<div class="sc-tools">
            <label class="sc-search"><span aria-hidden="true">⌕</span><input type="search" id="sc-q" placeholder="${T.search}" value="${esc(view.query)}" autocomplete="off"></label>
            <button type="button" class="sc-btn ${view.archive ? 'sc-on' : ''}" data-act="archive-view">${view.archive ? T.back : T.archive}</button>
            <button type="button" class="sc-btn sc-draw" data-act="draw" title="${T.draw}" aria-label="${T.draw}">${CARD_ICON}</button>
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
    const book = tagBook();
    if (!tagsOn()) view.tags = [];
    view.tags = view.tags.filter((id) => book.byId.has(id));
    const sel = view.tags;
    // the name, or one of the character's tags, holds what was typed; and every chosen tag is there
    const matches = (c) => {
        const ids = book.of(c);
        if (!sel.every((id) => ids.includes(id))) return false;
        if (!q) return true;
        return String(c.name).toLowerCase().includes(q)
            || (tagsOn() && ids.some((id) => String(book.byId.get(id).name).toLowerCase().includes(q)));
    };
    const everyone = ctx().characters.filter(Boolean);
    const shown = everyone.filter((c) => !s.archived.includes(c.avatar));

    if (view.archive) {
        const list = chattedFirst(everyone.filter((c) => s.archived.includes(c.avatar) && matches(c)));
        return list.length
            ? `<div class="sc-sec"><span>${T.archived} · ${list.length}</span></div>${gridHtml(list, s)}`
            : emptyHtml(q || sel.length ? T.noMatch : T.noArchive);
    }
    if (q || sel.length) {
        const list = chattedFirst(shown.filter(matches));
        const label = sel.length ? T.tagged : T.found;
        const reset = sel.length ? `<button type="button" class="sc-link" data-act="clear-tags">${T.clearTags}</button>` : '';
        return list.length
            ? `<div class="sc-sec"><span>${label} · ${list.length}</span>${reset}</div>${gridHtml(list, s)}`
            : `<div class="sc-sec"><span>${label} · 0</span>${reset}</div>${emptyHtml(T.noMatch)}`;
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
const narrowed = () => view.archive || !!view.query.trim() || view.tags.length > 0;
function shelfHtml() {
    bodyDrawn = shelfBody();
    const s = getSettings();
    const pool = ctx().characters.filter((c) => c && s.archived.includes(c.avatar) === view.archive);
    return headHtml() + continueHtml(narrowed()) + toolsHtml() + tagRowHtml(pool) + `<div class="sc-body">${bodyDrawn}</div>`;
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
    if (c && snipChats.has(c.avatar) && snipChats.get(c.avatar) !== stripExt(c.chat)) invalidateSnip(c.avatar);
    if (!c || lastSnips.has(c.avatar)) return;
    const version = snipVersions.get(c.avatar) || 0;
    const file = stripExt(c.chat);
    const controller = new AbortController();
    snipRequests.set(c.avatar, controller);
    lastSnips.set(c.avatar, '');
    snipChats.set(c.avatar, file);
    try {
        const list = await fetchChats(c.avatar, { signal: controller.signal });
        if (controller.signal.aborted || (snipVersions.get(c.avatar) || 0) !== version || stripExt(c.chat) !== file) return;
        if (!list.length) return;
        chatCounts.set(c.avatar, list.length);
        const want = `${file}.jsonl`;
        const chat = list.find((x) => x.file_name === want) || list[0];
        lastSnips.set(c.avatar, cleanSnip(chat?.mes, 120));
        const bar = homeEl?.querySelector('.sc-cont');
        const line = bar?.dataset.continue === c.avatar ? bar.querySelector('.sc-cont-line') : null;
        const title = chatTitle(c.chat);
        if (line && view.mode === 'shelf') line.textContent = [title.auto ? '' : title.text, lastSnips.get(c.avatar)].filter(Boolean).join(' · ');
    } catch {
        if ((snipVersions.get(c.avatar) || 0) === version) invalidateSnip(c.avatar);
        // The bar still works without a preview; a later visit can retry.
    }
    finally { if (snipRequests.get(c.avatar) === controller) snipRequests.delete(c.avatar); }
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

function retryHtml(message, action) {
    return emptyHtml(message) + `<button type="button" class="sc-btn" data-act="${action}">${T.retry}</button>`;
}
function chatListHtml(c) {
    if (view.listError) return retryHtml(T.listError, 'retry-list');
    const s = getSettings();
    if (!view.chats) return emptyHtml(T.loading);
    if (!view.chats.length) return emptyHtml(T.noChats);
    const lastFile = view.chats[0].file_name;
    const favs = s.favChats[c.avatar] || [];
    const ordered = [...view.chats].sort((a, b) => Number(favs.includes(b.file_name)) - Number(favs.includes(a.file_name)));
    return ordered.map((chat) => chatRow(c, chat, view.chats.indexOf(chat), chat.file_name === lastFile)).join('');
}

// under the search box on a character's page: the list, or what the search found
function chatsBody(c) {
    return chatQueryActive() ? foundHtml(c) : chatListHtml(c);
}

function pageTagsHtml(c) {
    if (!tagsOn()) return '';
    const book = tagBook();
    const ids = book.of(c);
    return ids.length ? `<div class="sc-tagrow sc-ptags">${ids.map((id) => `<button type="button" data-tag="${esc(id)}" data-go="1">${esc(book.byId.get(id).name)}</button>`).join('')}</div>` : '';
}

function pageHtml() {
    const s = getSettings();
    const c = characterBy(view.avatar);
    const pinned = s.pinned.includes(c.avatar), archived = s.archived.includes(c.avatar);
    let stat = '';
    if (view.chats?.length) {
        const total = view.chats.reduce((sum, x) => sum + (Number(x.chat_items) || 0), 0);
        stat = `${view.chats.length} ${T.chats}${total ? ` · ${total} ${T.mes}` : ''}`;
    }
    const search = view.chats?.length ? `<label class="sc-search sc-csearch"><span aria-hidden="true">⌕</span><input type="search" id="sc-cq" placeholder="${T.chatSearch}" value="${esc(view.chatQuery)}" autocomplete="off" enterkeyhint="search"></label>` : '';
    return `
        <button type="button" class="sc-back" data-act="back">${T.back}</button>
        <div class="sc-dh">${cameo(c, 'sc-cameo-sm')}<span class="sc-nm">${esc(c.name)}</span>
            <button type="button" class="sc-btn sc-fill" data-act="new-chat"${Array.isArray(view.chats) ? '' : ' disabled'}>${T.newChat}</button></div>
        ${pageTagsHtml(c)}
        <div class="sc-dh-tools">
            <button type="button" class="sc-btn ${pinned ? 'sc-on' : ''}" data-act="pin">${pinned ? T.unpin : T.pin}</button>
            <button type="button" class="sc-btn ${archived ? 'sc-on' : ''}" data-act="archive">${archived ? T.fromArchive : T.toArchive}</button>
            ${stat ? `<span class="sc-meta sc-stat">${esc(stat)}</span>` : ''}
        </div>
        ${search}
        <div class="sc-chats">${chatsBody(c)}</div>`;
}

/* ── search inside a character's chats ────────────────── */
// The server says which chats match; the lines themselves are found here, in the
// chats it named, a few chats at a time and newest first.
const FOUND_STEP = 6;     // chats shown, and read, per "more chats"
const HITS_SHOWN = 3;     // lines shown per chat
const queryParts = (q) => q.toLowerCase().split(/\s+/).filter(Boolean);
const chatQueryActive = () => view.chatQuery.trim().length >= 2;
let searchSeq = 0;
let searchTimer = null;
let searchRequest = null;
let pageRequest = null;

function stopChatSearch() {
    searchSeq++;
    clearTimeout(searchTimer); searchTimer = null;
    searchRequest?.abort(); searchRequest = null;
}
function stopPageWork() {
    stopChatSearch();
    pageRequest?.abort(); pageRequest = null;
}

// the message as a reader sees it: no tags, no markdown marks
const plainText = (t) => String(t || '').replace(/<[^>]*>/g, ' ').replace(/[*_~`]+/g, '').replace(/\s+/g, ' ').trim();

// a window of text around the first match, with every match marked
function markedSnippet(text, parts) {
    const lower = text.toLowerCase();
    const first = Math.max(0, Math.min(...parts.map((p) => lower.indexOf(p)).filter((i) => i > -1)));
    const firstLen = (parts.find((p) => lower.indexOf(p) === first) || '').length;
    let from = Math.max(0, first - 50), to = Math.min(text.length, first + 120);
    if (from > 0) { const sp = text.indexOf(' ', from); if (sp > -1 && sp < first) from = sp + 1; }
    if (to < text.length) { const sp = text.lastIndexOf(' ', to); if (sp > first + firstLen) to = sp; }
    const slice = text.slice(from, to), low = slice.toLowerCase();
    const ranges = [];
    for (const part of parts) {
        for (let i = low.indexOf(part); i > -1; i = low.indexOf(part, i + part.length)) ranges.push([i, i + part.length]);
    }
    ranges.sort((x, y) => x[0] - y[0]);
    let html = '', at = 0;
    for (const [x, y] of ranges) {
        if (y <= at) continue;
        const start = Math.max(x, at);
        html += esc(slice.slice(at, start)) + `<mark>${esc(slice.slice(start, y))}</mark>`;
        at = y;
    }
    html += esc(slice.slice(at));
    return `${from > 0 ? '…' : ''}${html}${to < text.length ? '…' : ''}`;
}

// The messages of one chat that hold the most of the words, newest first. The
// server matches a chat when its words are anywhere in it, so a single message
// may hold only some of them; then the closest ones are shown.
function findLines(data, parts) {
    const start = data[0] && !('mes' in data[0]) ? 1 : 0;      // the first line of a chat file is its header
    let best = 1, lines = [];
    for (let i = data.length - 1; i >= start; i--) {
        const msg = data[i];
        const text = plainText(msg?.mes);
        const low = text.toLowerCase();
        const n = parts.filter((p) => low.includes(p)).length;
        if (!n || n < best) continue;
        if (n > best) { best = n; lines = []; }
        lines.push({ id: i - start, name: msg.name, date: msg.send_date, text });
    }
    return lines;
}

function foundHtml(c) {
    const f = view.found;
    if (!f || f.query !== view.chatQuery.trim()) return emptyHtml(T.searching);
    if (f.error) return retryHtml(T.failed, 'retry-search');
    if (!f.files.length) return emptyHtml(T.noHits);
    const parts = queryParts(f.query);
    const groups = f.files.slice(0, f.shown).map((chat) => {
        const title = chatTitle(chat.file_name);
        const m = toMoment(chat.last_mes);
        const meta = [m ? dayLabel(m) : '', chat.message_count ? `${chat.message_count} ${T.mes}` : ''].filter(Boolean).join(' · ');
        const lines = f.lines.get(chat.file_name);
        let body;
        if (lines === null) body = retryHtml(T.readError, 'retry-lines');
        else if (!lines) body = `<span class="sc-meta sc-hit-wait">${T.searching}</span>`;
        else if (!lines.length) body = `<span class="sc-meta sc-hit-wait">${T.inTitle}</span>`;
        else {
            body = lines.slice(0, HITS_SHOWN).map((line) => {
                const day = dayLabel(toMoment(line.date));
                return `<button type="button" class="sc-hit" data-act="jump" data-mes="${line.id}">
                    <span class="sc-meta">${esc([line.name, day].filter(Boolean).join(' · '))}</span>
                    <span class="sc-hit-t">${markedSnippet(line.text, parts)}</span>
                </button>`;
            }).join('') + (lines.length > HITS_SHOWN ? `<span class="sc-meta sc-hit-more">${T.hitsMore(lines.length - HITS_SHOWN)}</span>` : '');
        }
        return `<div class="sc-crow sc-hitgroup" data-file="${esc(chat.file_name)}">
            <button type="button" class="sc-crow-main" data-act="open-chat">
                <span class="sc-crow-t"><span class="${title.auto ? 'sc-auto' : ''}">${esc(title.text)}</span></span>
                ${meta ? `<span class="sc-meta">${esc(meta)}</span>` : ''}
            </button>
            ${body}
        </div>`;
    }).join('');
    const more = f.files.length > f.shown ? `<button type="button" class="sc-btn sc-more-found" data-act="more-found">${T.moreChats} · ${f.files.length - f.shown}</button>` : '';
    return `<div class="sc-sec"><span>${T.found} · ${f.files.length}</span></div>${groups}${more}`;
}

// redraw only the results, so the search box keeps its focus and keyboard
function drawChats() {
    const box = homeEl?.isConnected && view.mode === 'page' ? homeEl.querySelector('.sc-chats') : null;
    const c = characterBy(view.avatar);
    if (box && c) box.innerHTML = chatsBody(c);
}

async function runChatSearch() {
    const avatar = view.avatar, query = view.chatQuery.trim();
    stopChatSearch();
    const seq = searchSeq;
    if (query.length < 2) { view.found = null; drawChats(); return; }
    if (!homeEl?.isConnected || view.mode !== 'page' || !characterBy(avatar)) return;
    const controller = new AbortController();
    searchRequest = controller;
    try {
        const res = await fetch('/api/chats/search', {
            method: 'POST', headers: ctx().getRequestHeaders(),
            body: JSON.stringify({ query, avatar_url: avatar }),
            signal: controller.signal,
        });
        const data = await res.json();
        if (controller.signal.aborted || seq !== searchSeq) return;
        if (!res.ok || !Array.isArray(data)) throw new Error(data?.error || 'search failed');
        const time = (x) => toMoment(x.last_mes)?.valueOf() ?? 0;
        const files = data.filter((x) => x && x.file_name)
            .map((x) => ({ ...x, file_name: `${stripExt(x.file_name)}.jsonl` }))
            .sort((a, b) => time(b) - time(a));
        view.found = { query, files, lines: new Map(), shown: FOUND_STEP, error: false };
    } catch (e) {
        if (controller.signal.aborted || seq !== searchSeq) return;
        console.error('[Shadow Cherry] chat search failed', e);
        view.found = { query, files: [], lines: new Map(), shown: 0, error: true };
    }
    drawChats();
    loadLines(seq);
}

// read the chats on screen whose lines are not known yet, two at a time
async function loadLines(seq) {
    const f = view.found, c = characterBy(view.avatar);
    const controller = searchRequest;
    const live = () => seq === searchSeq && !controller?.signal.aborted
        && !!controller && homeEl?.isConnected && view.mode === 'page' && view.avatar === c?.avatar && view.found === f;
    if (!f || !c || f.loading || !live()) return;
    const parts = queryParts(f.query);
    f.loading = true;
    try {
        while (live()) {
            // Re-read shown after each batch: repeated "more" clicks share one loader.
            const want = f.files.slice(0, f.shown).filter((x) => !f.lines.has(x.file_name)).slice(0, 2);
            if (!want.length) break;
            await Promise.all(want.map(async (chat) => {
                let lines = null;
                try {
                    const res = await fetch('/api/chats/get', {
                        method: 'POST', headers: ctx().getRequestHeaders(),
                        body: JSON.stringify({ ch_name: c.name, file_name: stripExt(chat.file_name), avatar_url: c.avatar }),
                        signal: controller.signal,
                    });
                    const data = await res.json();
                    if (!res.ok || !Array.isArray(data)) throw new Error('could not read chat');
                    lines = findLines(data, parts);
                } catch (e) { if (!controller.signal.aborted) console.warn('[Shadow Cherry] could not read a chat', e); }
                if (live()) f.lines.set(chat.file_name, lines);
            }));
            if (!live()) return;
            drawChats();
        }
    } finally { f.loading = false; }
}

// open the chat and scroll to the message
async function jumpTo(avatar, file, mesId) {
    await openCharacterChatFile(avatar, file);
    const want = stripExt(file);
    for (let i = 0; i < 30 && ctx().getCurrentChatId() !== want; i++) await new Promise((r) => setTimeout(r, 100));
    if (ctx().getCurrentChatId() !== want) return;
    await new Promise((r) => setTimeout(r, 250));     // let the messages render
    try { await ctx().executeSlashCommandsWithOptions(`/chat-jump ${Number(mesId)}`, { showOutput: false }); }
    catch (e) { console.warn('[Shadow Cherry] chat-jump failed', e); }
}

/* ── render & mount ───────────────────────────────────── */
let homeEl = null;
let homeShown = false;
let homeWorkFrame = 0, homeWorkIdle = null, homeWorkTimer = null, homeWorkEpoch = 0;
let countWatch = null;
const countQueue = new Set();
const countJobs = new Map();
const COUNT_CONCURRENCY = 2;

function stopHomeWork({ abort = false } = {}) {
    homeWorkEpoch++;
    if (homeWorkFrame) cancelAnimationFrame(homeWorkFrame);
    if (homeWorkIdle !== null) window.cancelIdleCallback?.(homeWorkIdle);
    if (homeWorkTimer !== null) clearTimeout(homeWorkTimer);
    homeWorkFrame = 0; homeWorkIdle = null; homeWorkTimer = null;
    countWatch?.disconnect(); countWatch = null;
    for (const avatar of countQueue) if (!countJobs.has(avatar)) pendingCounts.delete(avatar);
    countQueue.clear();
    if (abort) {
        for (const job of countJobs.values()) job.abort();
        for (const job of snipRequests.values()) job.abort();
    }
}
// Let the home paint before measuring tags, reading chat previews or counting
// chats. These details must not compete with a character switch on a phone.
function scheduleHomeWork() {
    stopHomeWork();
    const el = homeEl, epoch = homeWorkEpoch;
    const live = () => epoch === homeWorkEpoch && el === homeEl && el?.isConnected;
    if (!live()) return;
    homeWorkFrame = requestAnimationFrame(() => {
        if (!live()) return;
        homeWorkFrame = requestAnimationFrame(() => {
            homeWorkFrame = 0;
            const run = () => {
                homeWorkIdle = null; homeWorkTimer = null;
                if (!live()) return;
                setupTagScroller();
                if (view.mode !== 'page') loadCounts();
                if (view.mode === 'shelf' && !narrowed()) loadLastSnip();
            };
            if (!live()) return;
            if (typeof window.requestIdleCallback === 'function') homeWorkIdle = window.requestIdleCallback(run, { timeout: 1200 });
            else homeWorkTimer = setTimeout(run, 50);
        });
    });
}

const FOOT = '<div class="sc-foot" aria-hidden="true">✦</div>';

function render() {
    if (!homeEl || !homeEl.isConnected) return;
    stopHomeWork({ abort: view.mode === 'page' });
    cleanupTagScroller();
    if (view.mode === 'page' && !characterBy(view.avatar)) view.mode = 'shelf';
    if (view.mode !== 'page') stopPageWork();
    homeEl.dataset.mode = view.mode;
    homeEl.innerHTML = (view.mode === 'page' ? pageHtml() : view.mode === 'all' ? allHtml() : shelfHtml()) + FOOT;
    scheduleHomeWork();
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
    if (cont) cont.hidden = narrowed();
    scheduleHomeWork();
}

// One queue for every view, not four new requests on each redraw. Intersection
// observers also respect the horizontal row's clipping, unlike a DOM query.
function queueCount(avatar) {
    if (chatCounts.has(avatar) || (pendingCounts.has(avatar) && !countJobs.get(avatar)?.signal.aborted) || !hasChats(characterBy(avatar))) return;
    countQueue.add(avatar); pendingCounts.add(avatar);
    pumpCounts();
}
function pumpCounts() {
    if (!homeEl?.isConnected || view.mode === 'page') return;
    while (countJobs.size < COUNT_CONCURRENCY && countQueue.size) {
        let avatar;
        for (const candidate of countQueue) if (!countJobs.has(candidate)) { avatar = candidate; break; }
        if (avatar === undefined) break;
        countQueue.delete(avatar);
        if (chatCounts.has(avatar)) { pendingCounts.delete(avatar); continue; }
        const controller = new AbortController();
        pendingCounts.add(avatar);
        countJobs.set(avatar, controller);
        void (async () => {
            try {
                const res = await fetch('/api/characters/chats', {
                    method: 'POST', headers: ctx().getRequestHeaders(),
                    body: JSON.stringify({ avatar_url: avatar, simple: true }),
                    signal: controller.signal,
                });
                if (!res.ok) throw new Error('chat count failed');
                const data = await res.json();
                if (!Array.isArray(data)) throw new Error('invalid chat count');
                if (!controller.signal.aborted) {
                    chatCounts.set(avatar, data.length);
                    const c = characterBy(avatar);
                    if (c && homeEl?.isConnected) homeEl.querySelectorAll(`[data-meta-for="${CSS.escape(avatar)}"]`).forEach((metaEl) => { metaEl.textContent = metaText(c); });
                }
            } catch { /* retry on a later visit, rather than caching an error as zero */ }
            finally {
                countJobs.delete(avatar); pendingCounts.delete(avatar);
                pumpCounts();
            }
        })();
    }
}
function loadCounts() {
    countWatch?.disconnect(); countWatch = null;
    if (!homeEl?.isConnected) return;
    const el = homeEl;
    const nodes = [...el.querySelectorAll('[data-meta-for]')];
    if (typeof IntersectionObserver !== 'function') {
        for (const node of nodes) queueCount(node.dataset.metaFor);
        return;
    }
    const observer = new IntersectionObserver((entries) => {
        if (el !== homeEl || !el.isConnected || view.mode === 'page') return;
        for (const entry of entries) if (entry.isIntersecting && entry.target.isConnected && el.contains(entry.target)) {
            observer.unobserve(entry.target);
            queueCount(entry.target.dataset.metaFor);
        }
    }, { root: document.getElementById('chat'), rootMargin: '80px' });
    countWatch = observer;
    nodes.forEach((node) => observer.observe(node));
}

// a character's chats, newest first
async function fetchChats(avatar, { signal } = {}) {
    const res = await fetch('/api/characters/chats', {
        method: 'POST', headers: ctx().getRequestHeaders(),
        body: JSON.stringify({ avatar_url: avatar }),
        signal,
    });
    const data = await res.json();
    if (!res.ok || !Array.isArray(data)) throw new Error('could not load chats');
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
    stopPageWork();
    const controller = new AbortController();
    pageRequest = controller;
    view.chats = null; view.listError = false;
    view.chatQuery = ''; view.found = null;
    render();
    const live = () => pageRequest === controller && !controller.signal.aborted
        && homeEl?.isConnected && view.mode === 'page' && view.avatar === avatar;
    try {
        const list = await fetchChats(avatar, { signal: controller.signal });
        if (!live()) return;
        chatCounts.set(avatar, list.length);
        view.chats = list;
    } catch (e) {
        if (!live()) return;
        console.error('[Shadow Cherry] could not load chats', e);
        view.listError = true;
    } finally {
        if (live()) render();
        if (pageRequest === controller) pageRequest = null;
    }
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
        stopPageWork();
        stopHomeWork({ abort: true });
        cleanupTagScroller();
        if (homeEl?.isConnected) homeEl.remove();
        return;
    }
    if (homeEl?.isConnected && homeEl.parentElement === chatEl) return;
    homeEl = document.createElement('div');
    homeEl.id = 'sc-home';
    chatEl.prepend(homeEl);
    Object.assign(view, { mode: 'shelf', prev: 'shelf', avatar: null, query: '', archive: false, openMenu: null, chats: null });
    // Animate the first visit only; returning from a chat should be immediate.
    const el = homeEl;
    if (!homeShown && !document.body.classList.contains('no_animation')
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.classList.add('sc-enter');
        setTimeout(() => el.classList.remove('sc-enter'), 900);
    }
    homeShown = true;
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
        if (!list) throw new Error('could not confirm deletion');
        if (list.some((x) => x.file_name === file)) throw new Error('the chat is still there');
        dropFav(avatar, file);
        invalidateSnip(avatar);
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

    const tagEl = e.target.closest('[data-tag]');
    if (tagEl) { pickTag(tagEl.dataset.tag, !!tagEl.dataset.go); return; }

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
        case 'tags-prev': scrollTags(-1); break;
        case 'tags-next': scrollTags(1); break;
        case 'archive-view': view.archive = !view.archive; view.query = ''; view.tags = []; render(); break;
        case 'clear-tags': view.tags = []; syncTagRow(); renderBody(); break;
        case 'all': view.mode = 'all'; render(); document.getElementById('chat').scrollTop = 0; break;
        case 'back': view.mode = view.mode === 'page' ? view.prev : 'shelf'; view.prev = 'shelf'; view.avatar = null; view.openMenu = null; view.chats = null; view.chatQuery = ''; view.found = null; searchSeq++; render(); document.getElementById('chat').scrollTop = 0; break;
        case 'retry-list': loadChats(avatar); break;
        case 'retry-search': runChatSearch(); break;
        case 'retry-lines':
            if (view.found?.lines.get(file) === null) {
                view.found.lines.delete(file);
                drawChats();
                loadLines(searchSeq);
            }
            break;
        case 'new-chat': newChat(avatar); break;
        case 'pin': toggleIn(s.pinned, avatar); save(); render(); break;
        case 'archive': toggleIn(s.archived, avatar); save(); render(); break;
        case 'open-chat': openCharacterChatFile(avatar, file); break;
        case 'menu': { const i = Number(actEl.dataset.i); view.openMenu = view.openMenu === i ? null : i; render(); break; }
        case 'rename': view.openMenu = null; render(); renameChat(avatar, file); break;
        case 'fav': { const list = (s.favChats[avatar] ||= []); toggleIn(list, file); if (!list.length) delete s.favChats[avatar]; save(); view.openMenu = null; render(); break; }
        case 'download': view.openMenu = null; render(); downloadChat(avatar, file); break;
        case 'delete': view.openMenu = null; render(); deleteChat(avatar, file); break;
        case 'jump': jumpTo(avatar, file, actEl.dataset.mes); break;
        case 'more-found': if (view.found) { view.found.shown += FOUND_STEP; drawChats(); loadLines(searchSeq); } break;
        case 'draw': openTarot(); break;
    }
}

// a tag on the shelf narrows it (several tags: characters with all of them);
// a tag on a character's page goes back to the shelf showing that one tag
function pickTag(id, go) {
    if (go) {
        view.mode = 'shelf'; view.prev = 'shelf'; view.avatar = null; view.openMenu = null; view.chats = null;
        view.chatQuery = ''; view.found = null; searchSeq++;
        view.archive = false; view.query = ''; view.tags = [id];
        render();
        document.getElementById('chat').scrollTop = 0;
        return;
    }
    const i = view.tags.indexOf(id);
    if (i >= 0) view.tags.splice(i, 1); else view.tags.push(id);
    syncTagRow();
    renderBody();
}
// the row stays in place (and keeps where it was scrolled to); only the pressed state changes
function syncTagRow() {
    homeEl?.querySelectorAll('.sc-tagrow:not(.sc-ptags) [data-tag]').forEach((b) => b.setAttribute('aria-pressed', String(view.tags.includes(b.dataset.tag))));
}

function onInput(e) {
    if (e.target?.id === 'sc-q') {
        view.query = e.target.value;
        renderBody();
    } else if (e.target?.id === 'sc-cq') {
        stopChatSearch();
        view.chatQuery = e.target.value;
        view.openMenu = null;
        // the list comes back at once when the box is cleared; a search waits for a pause in typing
        view.found = null; drawChats();
        if (chatQueryActive()) searchTimer = setTimeout(runChatSearch, 400);
    }
}

// a picture that does not load gives way to the character's initial
function onImageError(e) {
    const frame = e.target instanceof HTMLImageElement ? e.target.closest('#sc-home .sc-cameo, #sc-typing .sc-cameo') : null;
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
    chatCounts.delete(from); invalidateSnip(from);
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
    chatCounts.delete(avatar); invalidateSnip(avatar);
    save();
}

/* ── draw a card ──────────────────────────────────────── */
// A random character, face down first, then turned over as one of the major arcana.
// The arcana is chance too: it is a mood for the evening, not a reading.
const TAROT_BACK = `<svg viewBox="0 0 100 160" aria-hidden="true">
    <rect x="4" y="4" width="92" height="152" rx="5"/><rect x="9" y="9" width="82" height="142" rx="2.5" stroke-width=".6"/>
    <circle cx="50" cy="80" r="23"/><circle cx="50" cy="80" r="29" stroke-width=".5" stroke-dasharray="1 3"/>
    <path d="M55 64A16 16 0 1 0 55 96A20 20 0 0 1 55 64Z" class="f"/>
    <path d="M50 30L51.2 37.8L59 39L51.2 40.2L50 48L48.8 40.2L41 39L48.8 37.8Z" class="f"/>
    <path d="M50 112L51.2 119.8L59 121L51.2 122.2L50 130L48.8 122.2L41 121L48.8 119.8Z" class="f"/>
    <path d="M50 14V22M50 138V146M14 80H22M78 80H86" stroke-width=".7"/>
    <path d="M15 15L21 15M15 15L15 21M85 15L79 15M85 15L85 21M15 145L21 145M15 145L15 139M85 145L79 145M85 145L85 139" stroke-width=".7"/>
</svg>`;
let tarotEl = null, tarotLast = null, tarotPick = null, tarotFocus = null;
let tarotDealTimer = null;
let cleanupTarotViewport = () => {};

// A phone's visible area can shrink or move independently of the layout
// viewport (browser bars, keyboard, zoom). Keep the overlay inside that area.
function watchTarotViewport(el) {
    const viewport = window.visualViewport;
    const update = () => {
        el.style.setProperty('--sc-t-viewport-height', `${viewport?.height || window.innerHeight}px`);
        el.style.setProperty('--sc-t-viewport-width', `${viewport?.width || window.innerWidth}px`);
        el.style.setProperty('--sc-t-viewport-top', `${viewport?.offsetTop || 0}px`);
        el.style.setProperty('--sc-t-viewport-left', `${viewport?.offsetLeft || 0}px`);
    };
    update();
    window.addEventListener('resize', update, { passive: true });
    viewport?.addEventListener('resize', update, { passive: true });
    viewport?.addEventListener('scroll', update, { passive: true });
    return () => {
        window.removeEventListener('resize', update);
        viewport?.removeEventListener('resize', update);
        viewport?.removeEventListener('scroll', update);
    };
}

function tarotPool() {
    const s = getSettings();
    const all = ctx().characters.filter((c) => c && !s.archived.includes(c.avatar));
    return all.length > 1 ? all.filter((c) => c.avatar !== tarotLast) : all;
}

function tarotFront(c, n) {
    const [arc] = T.arcana[n];
    const full = c.avatar && c.avatar !== 'none' ? `/characters/${encodeURIComponent(c.avatar)}` : '';
    const thumb = full ? ctx().getThumbnailUrl('avatar', c.avatar) : '';
    return `<span class="sc-t-num">${NUMERALS[n]}</span>
        <span class="sc-t-win">${full ? `<img src="${esc(full)}" data-thumb="${esc(thumb)}" alt="">` : `<span class="sc-ini">${esc((c.name || '?').trim().charAt(0).toUpperCase())}</span>`}</span>
        <span class="sc-t-name">${esc(c.name)}</span>
        <span class="sc-t-arc">${esc(arc)}</span>`;
}

function dealTarot() {
    const pool = tarotPool();
    if (!pool.length || !tarotEl) return;
    const c = pool[Math.floor(Math.random() * pool.length)];
    const n = Math.floor(Math.random() * T.arcana.length);
    tarotPick = c.avatar; tarotLast = c.avatar;
    tarotEl.querySelector('.sc-t-front').innerHTML = tarotFront(c, n);
    const img = tarotEl.querySelector('.sc-t-win img');
    // the full picture first, then the thumbnail, then the initial
    img?.addEventListener('error', () => {
        if (img.dataset.thumb) { img.src = img.dataset.thumb; img.dataset.thumb = ''; return; }
        img.insertAdjacentHTML('afterend', `<span class="sc-ini">${esc((c.name || '?').trim().charAt(0).toUpperCase())}</span>`);
        img.remove();
    });
    tarotEl.querySelector('.sc-t-read').innerHTML = `<b>${esc(T.arcana[n][0])}</b> — ${esc(T.arcana[n][1])}`;
    tarotEl.querySelector('[data-t="open"]').textContent = hasChats(c) ? T.openChat : T.startChat;
}

function flipTarot(up) {
    tarotEl?.classList.toggle('sc-t-up', up);
}

function openTarot() {
    if (tarotEl) return;
    if (!tarotPool().length) return;
    tarotFocus = document.activeElement;
    tarotEl = document.createElement('div');
    tarotEl.id = 'sc-tarot';
    tarotEl.setAttribute('role', 'dialog');
    tarotEl.setAttribute('aria-modal', 'true');
    tarotEl.setAttribute('aria-label', T.draw);
    tarotEl.innerHTML = `
        <div class="sc-t-stage">
            <div class="sc-t-card">
                <div class="sc-t-face sc-t-back">${TAROT_BACK}</div>
                <div class="sc-t-face sc-t-front"></div>
            </div>
        </div>
        <p class="sc-t-read" aria-live="polite"></p>
        <div class="sc-t-acts">
            <button type="button" class="sc-btn sc-fill" data-t="open"></button>
            <button type="button" class="sc-btn" data-t="again">${T.drawAgain}</button>
            <button type="button" class="sc-btn sc-t-x" data-t="close" aria-label="${T.closeT}">✕</button>
        </div>`;
    document.body.appendChild(tarotEl);
    cleanupTarotViewport = watchTarotViewport(tarotEl);
    dealTarot();
    const el = tarotEl;
    requestAnimationFrame(() => { if (tarotEl === el) el.classList.add('sc-t-in'); });
    tarotDealTimer = setTimeout(() => {
        tarotDealTimer = null;
        if (tarotEl !== el) return;
        flipTarot(true); el.querySelector('[data-t="open"]')?.focus({ preventScroll: true });
    }, 650);

    tarotEl.addEventListener('click', (e) => {
        if (tarotEl !== el) return; // the fading-out dialog no longer owns actions
        const b = e.target.closest('[data-t]');
        if (!b) { if (e.target === tarotEl) closeTarot(); return; }
        if (b.dataset.t === 'close') closeTarot();
        else if (b.dataset.t === 'again') {
            if (!tarotEl.classList.contains('sc-t-up')) return;
            flipTarot(false);
            tarotDealTimer = setTimeout(() => {
                tarotDealTimer = null;
                if (tarotEl !== el) return;
                dealTarot(); flipTarot(true);
            }, 520);
        } else if (b.dataset.t === 'open') {
            const c = characterBy(tarotPick);
            closeTarot();
            if (!c) return;
            if (hasChats(c)) openCharacterChatFile(c.avatar, c.chat);
            else newChat(c.avatar);
        }
    });
    tarotEl.addEventListener('keydown', (e) => {
        if (tarotEl !== el) return;
        if (e.key === 'Escape') { e.preventDefault(); closeTarot(); }
        if (e.key === 'Tab') {      // keep the keyboard inside the dialog
            const items = [...tarotEl.querySelectorAll('button')];
            const i = items.indexOf(document.activeElement);
            const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i + 1) % items.length;
            e.preventDefault(); items[next].focus();
        }
    });
}

function closeTarot() {
    const el = tarotEl;
    if (!el) return;
    clearTimeout(tarotDealTimer); tarotDealTimer = null;
    cleanupTarotViewport();
    cleanupTarotViewport = () => {};
    tarotEl = null;
    el.classList.remove('sc-t-in');
    setTimeout(() => el.remove(), 300);
    try { tarotFocus?.focus?.({ preventScroll: true }); } catch { /* the button may be gone */ }
}

/* ── the moth waits with you ──────────────────────────── */
// From the moment a message is sent until the first word of the reply arrives
// (the thinking included), the stop button is a moth that slowly flaps its wings.
// The flag lives on <body>; the drawing is in style.css.
function waiting(on) {
    if (on) document.body.dataset.scWait = '1';
    else delete document.body.dataset.scWait;
}

/* ── "is typing" ───────────────────────────────────────── */
// Under the last message, from "sent" until the reply appears: the character's
// cameo breathing light and a bubble with three twinkling stars. It goes away
// when the reply's message shows up (its thinking included) or its first word
// arrives, and when the generation ends or stops.
let typingEl = null;

function typingCharacter(opts) {
    const { characters, characterId } = ctx();
    // a group sends each member's turn with force_chid; a one-on-one chat is the open character
    const forced = opts?.force_chid;
    const id = forced !== undefined && forced !== null && forced !== '' && Number.isInteger(Number(forced)) ? Number(forced) : Number(characterId);
    return characters?.[id] || null;
}

function showTyping(opts) {
    hideTyping();
    if (!getSettings().typing) return;
    const chatEl = document.getElementById('chat');
    const c = typingCharacter(opts);
    if (!chatEl || !c || homeEl?.isConnected) return;
    const atBottom = chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight < 120;
    typingEl = document.createElement('div');
    typingEl.id = 'sc-typing';
    typingEl.setAttribute('role', 'status');
    typingEl.setAttribute('aria-label', T.typing(c.name));
    typingEl.innerHTML = `${cameo(c, 'sc-typing-cameo')}
        <span class="sc-typing-stars" aria-hidden="true"><span>✦</span><span>✧</span><span>✦</span></span>`;
    chatEl.appendChild(typingEl);
    if (atBottom) requestAnimationFrame(() => { chatEl.scrollTop = chatEl.scrollHeight; });
}

function hideTyping() {
    typingEl?.remove();
    typingEl = null;
}

// keeps the indicator last while the chat grows, and drops it once the reply's message is there
function onChatGrow(records) {
    if (!typingEl?.isConnected) return;
    const added = records.flatMap((r) => [...r.addedNodes]).filter((n) => n instanceof HTMLElement && n.classList.contains('mes'));
    if (!added.length) return;
    if (added.some((n) => n.getAttribute('is_user') === 'false' && n.getAttribute('is_system') !== 'true')) { hideTyping(); return; }
    typingEl.parentElement.appendChild(typingEl);
}

/* ── one reply being waited for ───────────────────────── */
// The moth and the "is typing" cameo start when SillyTavern announces a generation
// and stop on its events. But it can still call the generation off without an event
// (no API connection, server unreachable, a backend that cannot stream), so two
// more things end the wait: <body data-generating> going away, and that flag not
// having appeared a few seconds after the announcement.
const START_GRACE = 8000;
const LATE_START = 60000;
let turn = null;          // { opts, typing, at } until the reply begins to arrive or the turn is called off
let turnTimer = null;
const isGenerating = () => document.body.dataset.generating === 'true';

function turnBegan(type, opts) {
    if (ctx().onlineStatus === 'no_connection') return;      // nothing will be generated
    turn = { opts, typing: type !== 'impersonate', at: Date.now() };   // impersonation writes your own message
    waiting(true);
    if (turn.typing) showTyping(opts);
    clearTimeout(turnTimer);
    turnTimer = setTimeout(() => { if (!isGenerating()) { waiting(false); hideTyping(); } }, START_GRACE);
}

function turnOver() {
    turn = null;
    clearTimeout(turnTimer);
    waiting(false);
    hideTyping();
}

function onGeneratingFlag() {
    if (!isGenerating()) { turnOver(); return; }
    // a slow server: the generation started after the grace period had ended the wait
    if (!turn || document.body.dataset.scWait) return;
    if (Date.now() - turn.at > LATE_START) { turn = null; return; }      // too late to be the same turn
    waiting(true);
    if (turn.typing) showTyping(turn.opts);
}

/* ── message box hint ─────────────────────────────────── */
// SillyTavern writes "Type a message, or /? for help" into the empty box whenever
// the API connects, taking it from the box's connected_text attribute; the hint
// replaces that text. "Not connected to API!" stays, it is a real warning.
let hintShown = null;
function applyHint() {
    const box = document.getElementById('send_textarea');
    if (!box) return;
    if (box.dataset.scOrig === undefined) box.dataset.scOrig = box.getAttribute('connected_text') || '';
    const s = getSettings();
    const text = typeof s.hint === 'string' ? s.hint : T.hint;
    box.setAttribute('connected_text', text);
    if (box.placeholder === box.dataset.scOrig || box.placeholder === hintShown) box.placeholder = text;
    hintShown = text;
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
        let closing = false;
        const run = async () => {
            if (closing) return;
            closing = true;
            try {
                captureCurrentSnip();
                const m = await st();
                if (m?.closeCurrentChat) await m.closeCurrentChat();
                else await ctx().executeSlashCommandsWithOptions?.('/closechat');
            } catch (e) {
                console.error('[Shadow Cherry] close chat failed', e);
                toast('error', T.failed);
            } finally { closing = false; }
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
    const hidden = !s.closeButton || ctx().getCurrentChatId() === undefined;
    if (btn.hidden !== hidden) btn.hidden = hidden;
}

function loadFonts() {
    if (document.getElementById('sc-fonts')) return;
    const link = document.createElement('link');
    link.id = 'sc-fonts'; link.rel = 'stylesheet'; link.media = 'print';
    link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Italiana&family=Special+Elite&display=swap';
    link.onload = () => { link.media = 'all'; };
    document.head.appendChild(link);
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
                    <label class="checkbox_label" for="sc-dropcap-on">
                        <input id="sc-dropcap-on" type="checkbox">
                        <span>${T.panelDropCap}</span>
                    </label>
                    <label class="checkbox_label" for="sc-typing-on">
                        <input id="sc-typing-on" type="checkbox">
                        <span>${T.panelTyping}</span>
                    </label>
                    <label class="checkbox_label" for="sc-tags-on">
                        <input id="sc-tags-on" type="checkbox">
                        <span>${T.panelTags}</span>
                    </label>
                    <label class="sc-field" for="sc-hint">
                        <span>${T.panelHint}</span>
                        <input id="sc-hint" class="text_pole" type="text" placeholder="${T.hintEmpty}" autocomplete="off">
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
    const capBox = document.getElementById('sc-dropcap-on');
    capBox.checked = !!s.dropCap;
    capBox.addEventListener('change', () => { s.dropCap = capBox.checked; save(); applyDropCap(); });
    const typingBox = document.getElementById('sc-typing-on');
    typingBox.checked = !!s.typing;
    typingBox.addEventListener('change', () => { s.typing = typingBox.checked; save(); if (!s.typing) hideTyping(); });
    const tagsBox = document.getElementById('sc-tags-on');
    tagsBox.checked = !!s.tags;
    tagsBox.addEventListener('change', () => { s.tags = tagsBox.checked; save(); if (!s.tags) view.tags = []; render(); });
    const hintBox = document.getElementById('sc-hint');
    hintBox.value = typeof s.hint === 'string' ? s.hint : T.hint;
    hintBox.addEventListener('input', () => { s.hint = hintBox.value; save(); applyHint(); });
}

// the drop cap is drawn by style.css; this switches it on and off
function applyDropCap() {
    document.body.classList.toggle('sc-dropcap', !!getSettings().dropCap);
    if (getSettings().dropCap) markAllCaps();
}

// The cap is sized from its own font's letter heights. Italiana has Latin letters only,
// so a Russian (or any other) first letter would be drawn by the next font in line while
// still being measured by Italiana, and it slips a line down. Messages that start with
// such a letter are marked, and style.css gives their cap a font that has the letter.
const LATIN_LETTER = /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/;
function markCap(mes) {
    const p = mes.querySelector(':scope .mes_text > p:not(:empty)');
    let letter = '';
    if (p) {
        const text = document.createTreeWalker(p, 4); // SHOW_TEXT; stop at the first actual letter
        let node;
        while ((node = text.nextNode())) {
            const match = /[\p{L}\p{N}]/u.exec(node.nodeValue || '');
            if (match) { letter = match[0]; break; }
        }
    }
    const alt = !!letter && !LATIN_LETTER.test(letter);
    if (alt && mes.dataset.scCap !== 'alt') mes.dataset.scCap = 'alt';
    else if (!alt && mes.dataset.scCap) delete mes.dataset.scCap;
}
/* ── avatars zoomed by another extension ─────────────────── */
// AvatarAdjuster and the like resize the picture to the avatar box, zoom and move it,
// and clip the box with an inline overflow: hidden. The theme draws the avatar's frame
// on that same box, so whatever of the frame sits outside it vanished, and the picture's
// own rounding travelled with the zoom. While an avatar is handled like that, its frame
// is drawn by a separate layer next to it, and the box itself does the clipping.
const liftWatch = typeof ResizeObserver === 'function'
    ? new ResizeObserver((list) => list.forEach((e) => {
        const av = e.target.classList.contains('avatar') ? e.target : e.target.querySelector(':scope > .avatar.sc-av-lifted');
        if (av) queueLift(av);
    }))
    : null;
const liftQueue = new Map();             // avatar -> 1: input styles changed, 2: size/position changed
const liftInputs = new WeakMap();        // ignore our own --sc-av-* style mutations
const liftAfter = new Map();             // one shared timer for the end of slide-in animations
let liftFrame = 0, liftTimer = null;

function queueLift(av, sync = false) {
    if (!av) return;
    liftQueue.set(av, (liftQueue.get(av) || 0) | (sync ? 1 : 2));
    if (!liftFrame) liftFrame = requestAnimationFrame(flushLifts);
}
function flushLifts() {
    liftFrame = 0;
    const jobs = [...liftQueue];
    liftQueue.clear();
    const place = [];
    for (const [av, flags] of jobs) {
        if (!av.isConnected) { releaseLift(av); continue; }
        const changed = flags & 1 ? syncLift(av) : false;
        if (changed || (flags & 2)) place.push(av);
    }
    placeFrames(place);
}
function settleLift(av) {
    liftAfter.set(av, Date.now() + 700);
    if (liftTimer === null) liftTimer = setTimeout(settleLifts, 700);
}
function settleLifts() {
    liftTimer = null;
    const now = Date.now();
    let next = Infinity;
    for (const [av, at] of liftAfter) {
        if (at <= now) { liftAfter.delete(av); queueLift(av); }
        else next = Math.min(next, at);
    }
    if (liftAfter.size) liftTimer = setTimeout(settleLifts, Math.max(1, next - now));
}
function frameStyle(el, name, value) {
    if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value);
}
function liftStyleInput(av, img) {
    // Position and transforms can change without triggering ResizeObserver.
    // Only our clipping variables are excluded from the input signature.
    const style = Array.from(av.style).filter((name) => name !== '--sc-av-r' && name !== '--sc-av-clip')
        .map((name) => [name, av.style.getPropertyValue(name), av.style.getPropertyPriority(name)]);
    return JSON.stringify([style, img?.style.cssText || '']);
}
// Put the layer exactly over the avatar as it is seen on screen. Measured from the
// screen rather than from offsetLeft, so it holds whatever the chat style does to
// the avatar's box (moved, transformed, zoomed, a wrapper with display: contents).
// Read all avatars, prepare all layers, then measure them together. Alternating
// reads and writes per style record forced layout hundreds of times on long chats.
function placeFrames(avatars) {
    const boxes = [];
    for (const av of avatars) {
        const layer = liftInputs.get(av)?.layer;
        if (!layer?.isConnected || layer.parentElement !== av.parentElement || !av.classList.contains('sc-av-lifted')) continue;
        const width = av.offsetWidth || 1, height = av.offsetHeight || 1;
        const rect = av.getBoundingClientRect();
        if (!rect.width) continue;
        boxes.push({ av, layer, width, height, rect, clip: pictureClip(av) });
    }
    for (const { av, layer, width, height, clip } of boxes) {
        if (clip) frameStyle(av, '--sc-av-clip', clip);
        frameStyle(layer, 'transform', 'none');  // style.css scales the non-Ripple reticle
        frameStyle(layer, 'left', '0px');
        frameStyle(layer, 'top', '0px');
        frameStyle(layer, 'width', `${width}px`);
        frameStyle(layer, 'height', `${height}px`);
    }
    const measured = boxes.map((box) => ({ ...box, origin: box.layer.getBoundingClientRect() }));
    for (const { layer, width, rect: a, origin: o } of measured) {
        layer.style.removeProperty('transform');
        if (!o.width) continue;
        const k = o.width / width;              // page zoom inside this message, if any
        frameStyle(layer, 'left', `${(a.left - o.left) / k}px`);
        frameStyle(layer, 'top', `${(a.top - o.top) / k}px`);
        frameStyle(layer, 'width', `${a.width / k}px`);
        frameStyle(layer, 'height', `${a.height / k}px`);
    }
}
// The window the picture is seen through: the picture's own place and rounding in the
// box, measured before any zoom (offsets ignore transforms). The picture can be smaller
// than the box, so clipping the whole box would leave square corners showing.
function pictureClip(av) {
    const img = av.querySelector(':scope > img');
    if (!img || !img.offsetWidth) return;
    const inBox = img.offsetParent === av;
    const l = (inBox ? img.offsetLeft : img.offsetLeft - av.offsetLeft) + av.clientLeft;
    const t = (inBox ? img.offsetTop : img.offsetTop - av.offsetTop) + av.clientTop;
    const r = Math.max(0, av.offsetWidth - l - img.offsetWidth);
    const b = Math.max(0, av.offsetHeight - t - img.offsetHeight);
    const round = av.style.getPropertyValue('--sc-av-r') || '0px';
    return `inset(${t}px ${r}px ${b}px ${l}px round ${round})`;
}
function placeAllFrames() {
    document.querySelectorAll('#chat .mes .avatar.sc-av-lifted').forEach((av) => queueLift(av));
}
function releaseLift(av, host = liftInputs.get(av)?.host || av.parentElement) {
    liftQueue.delete(av);
    liftAfter.delete(av);
    if (!liftAfter.size && liftTimer !== null) { clearTimeout(liftTimer); liftTimer = null; }
    const layer = liftInputs.get(av)?.layer
        || (av.classList.contains('sc-av-lifted') ? host?.querySelector(':scope > .sc-av-frame') : null);
    layer?.remove();
    const shared = host?.querySelector(':scope > .sc-av-frame');
    if (!shared) host?.classList.remove('sc-av-host');
    av.classList.remove('sc-av-lifted');
    av.style.removeProperty('--sc-av-r');
    av.style.removeProperty('--sc-av-clip');
    delete av.dataset.scAvR;
    liftWatch?.unobserve(av);
    if (host && !shared) liftWatch?.unobserve(host);
    liftInputs.delete(av);
}
function syncLift(av) {
    const host = av.parentElement;
    if (!host) return false;
    const img = av.querySelector(':scope > img');
    const overflow = av.style.getPropertyValue('overflow');
    const input = liftStyleInput(av, img);
    const prev = liftInputs.get(av);
    if (prev && (prev.host !== host || prev.img !== img)) releaseLift(av, prev.host);
    let layer = prev?.host === host && prev.img === img && prev.layer?.parentElement === host ? prev.layer : null;
    const active = !!img && (overflow === 'hidden' || !!img.style.getPropertyValue('width'));
    if (prev?.host === host && prev.img === img && prev.input === input
        && (active ? layer && av.classList.contains('sc-av-lifted') : !layer && !av.classList.contains('sc-av-lifted'))) return false;
    // zoomed (the box is clipped) or just reframed (the picture is resized to the box)
    if (active) {
        // the picture's own rounding would be zoomed and moved with it and leave a bare
        // corner in the window; the box takes that rounding over (style.css)
        if (img && !av.dataset.scAvR) {
            av.dataset.scAvR = '1';
            const own = getComputedStyle(av).borderRadius;
            const pic = getComputedStyle(img).borderRadius;
            const zero = (v) => !v || /^0(px|%)?( 0(px|%)?)*$/.test(v);
            av.style.setProperty('--sc-av-r', !zero(pic) ? pic : !zero(own) ? own : '0px');
        }
        if (!layer) {
            if (getComputedStyle(host).position === 'static') host.classList.add('sc-av-host');
            layer = document.createElement('i');
            layer.className = 'sc-av-frame';
            layer.setAttribute('aria-hidden', 'true');
            av.after(layer);
            if (!av.dataset.scLiftEv) {           // a chat style may slide the avatar with a transition
                av.dataset.scLiftEv = '1';
                av.addEventListener('transitionend', () => queueLift(av));
                av.addEventListener('animationend', () => queueLift(av));
            }
            liftWatch?.observe(av);
            liftWatch?.observe(host);
        }
        if (!av.classList.contains('sc-av-lifted')) av.classList.add('sc-av-lifted');
        liftInputs.set(av, { host, img, input, layer });
        settleLift(av);
        return true;
    } else if (layer || av.classList.contains('sc-av-lifted')) {
        releaseLift(av);
    }
    liftInputs.set(av, { host, img, input, layer: null });
    return false;
}
function avatarsWithin(node) {
    if (node.nodeType !== 1) return [];
    return node.matches('.avatar') ? [node] : node.querySelectorAll('.avatar');
}
function onAvatarStyle(records) {
    for (const r of records) {
        if (r.type === 'attributes') {
            const t = r.target;
            if (t.classList?.contains('avatar')) queueLift(t, true);
            else if (t.tagName === 'IMG' && t.parentElement?.classList.contains('avatar')) queueLift(t.parentElement, true);
        } else {
            for (const n of r.removedNodes) for (const av of avatarsWithin(n)) {
                if (!av.isConnected && liftInputs.has(av)) releaseLift(av);
            }
            // Another renderer may remove just the frame while retaining the avatar.
            if ([...r.removedNodes].some((n) => n.nodeType === 1 && n.classList?.contains('sc-av-frame'))) {
                const av = r.target.querySelector?.(':scope > .avatar.sc-av-lifted');
                if (av?.isConnected) queueLift(av, true);
            }
            for (const n of r.addedNodes) for (const av of avatarsWithin(n)) queueLift(av, true);
            // An image can be replaced without replacing its avatar container.
            if (r.target.classList?.contains('avatar')) queueLift(r.target, true);
        }
    }
}
function onAvatarLoad(e) {
    const av = e.target.tagName === 'IMG' ? e.target.parentElement : null;
    if (av?.classList.contains('avatar')) queueLift(av);
}

function markAllCaps() {
    document.querySelectorAll('#chat .mes').forEach(markCap);
}
// messages appear, stream in, get edited and swiped: recheck only the ones that changed
const capQueue = new Set();
let capFrame = 0;
function onChatText(records) {
    if (!getSettings().dropCap) return;
    for (const r of records) {
        const el = r.target.nodeType === 1 ? r.target : r.target.parentElement;
        const mes = el?.closest?.('.mes_text')?.closest('.mes');
        if (mes) capQueue.add(mes);
        else for (const n of r.addedNodes) if (n.nodeType === 1) {
            if (n.matches('.mes_text')) { const m = n.closest('.mes'); if (m) capQueue.add(m); }
            else (n.matches('.mes') ? [n] : n.querySelectorAll('.mes')).forEach((m) => capQueue.add(m));
        }
    }
    if (capQueue.size && !capFrame) capFrame = requestAnimationFrame(() => {
        capFrame = 0;
        if (getSettings().dropCap) capQueue.forEach((m) => { if (m.isConnected) markCap(m); });
        capQueue.clear();
    });
}

/* ── start ────────────────────────────────────────────── */
function init() {
    getSettings();
    buildPanel();
    applyDropCap();
    applyHint();

    const chatEl = document.getElementById('chat');
    if (chatEl) {
        new MutationObserver((records) => { updateCloseButton(); mount(); onChatGrow(records); }).observe(chatEl, { childList: true });
        new MutationObserver(onChatText).observe(chatEl, { childList: true, subtree: true, characterData: true });
        new MutationObserver(onAvatarStyle).observe(chatEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
        chatEl.querySelectorAll('.mes .avatar').forEach((av) => queueLift(av, true));
        window.addEventListener('resize', placeAllFrames, { passive: true });
        chatEl.addEventListener('click', onClick);
        chatEl.addEventListener('input', onInput);
        chatEl.addEventListener('error', onImageError, true);
        chatEl.addEventListener('load', onAvatarLoad, true);
    }
    const { eventSource, eventTypes: E } = ctx();
    const on = (type, fn) => { if (type) eventSource?.on?.(type, fn); };     // older versions lack some events
    const redraw = () => { if (homeEl?.isConnected) render(); else mount(); };
    // the character whose chat is open: its count is what changes while the home is away
    const current = () => ctx().characters?.[ctx().characterId]?.avatar;

    on(E.CHAT_CHANGED, () => { turnOver(); closeTarot(); captureCurrentSnip(); chatCounts.delete(current()); updateCloseButton(); mount(); });
    for (const type of [E.MESSAGE_SENT, E.MESSAGE_RECEIVED, E.MESSAGE_EDITED, E.MESSAGE_UPDATED, E.MESSAGE_SWIPED, E.MESSAGE_DELETED]) on(type, captureCurrentSnip);
    // the moth and the cameo: from "sent" to the first word of the reply; quiet background generations do not count
    on(E.GENERATION_AFTER_COMMANDS, (type, opts, dryRun) => { if (!dryRun && type !== 'quiet') turnBegan(type, opts); });
    on(E.STREAM_TOKEN_RECEIVED, (text) => { if (String(text ?? '').trim()) turnOver(); });
    for (const type of [E.MESSAGE_RECEIVED, E.GENERATION_ENDED, E.GENERATION_STOPPED]) on(type, turnOver);
    new MutationObserver(onGeneratingFlag).observe(document.body, { attributes: true, attributeFilter: ['data-generating'] });
    on(E.CHAT_DELETED, (name) => {
        const a = current();
        if (a) { chatCounts.delete(a); dropFav(a, `${name}.jsonl`); invalidateSnip(a); }
        else for (const avatar of lastSnips.keys()) invalidateSnip(avatar);
        redraw();
    });
    on(E.CHAT_RENAMED, (d) => { if (!renaming && d?.avatarId && !d.groupId) moveFav(d.avatarId, d.oldFileName, d.newFileName); });
    on(E.CHARACTER_EDITED, redraw);
    on(E.CHARACTER_RENAMED, moveCharacter);
    on(E.CHARACTER_DELETED, (d) => { dropCharacter(d?.character?.avatar); redraw(); });
    // the character list was read again (a new card, an import): show it without touching the search box
    on(E.CHARACTER_PAGE_LOADED, () => renderBody({ onlyIfChanged: true }));
    mount();
    updateCloseButton();
    loadFonts();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
