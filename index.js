/*  ✦  Shadow Cherry  ✦
    影色のさくらんぼ · fog, ash & porcelain rose
    a SillyTavern extension by ewwn1h

    Atmosphere for the Shadow Cherry theme: drifting fog and dust.
    The theme itself lives in the Moonlit Echoes preset.
*/

const MODULE = 'shadowCherry';
const DEFAULTS = Object.freeze({
    fog: true,
    fogDensity: 45,
    fogFront: false,
    dust: true,
    dustAmount: 35,
});

/* ── settings ─────────────────────────────────────────── */
const ctx = () => SillyTavern.getContext();

// one settings object for the whole session: fill in missing defaults in place,
// never replace it, so the panel and the effects always read the same values
function getSettings() {
    const all = ctx().extensionSettings;
    const s = (all[MODULE] ||= {});
    for (const [key, value] of Object.entries(DEFAULTS)) {
        if (!(key in s)) s[key] = value;
    }
    return s;
}

function save() {
    ctx().saveSettingsDebounced();
}

/* ── language: Russian if SillyTavern is in Russian, English otherwise ── */
const RU = (() => {
    try { return (localStorage.getItem('language') || '').toLowerCase().startsWith('ru'); }
    catch { return false; }
})();
const T = RU ? {
    fog: 'Туман',
    density: 'Плотность',
    fogFront: 'Поверх чата',
    dust: 'Пылинки',
    amount: 'Количество',
    still: 'Включено «меньше анимаций»: туман и пылинки замерли на месте.',
} : {
    fog: 'Fog',
    density: 'Density',
    fogFront: 'Over the chat',
    dust: 'Dust',
    amount: 'Amount',
    still: '“Reduced motion” is on: the fog and dust stay still.',
};

/* ── reduced motion: the OS setting or SillyTavern's own toggle ── */
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
function reducedMotion() {
    return motionQuery.matches || Boolean(ctx().powerUserSettings?.reduced_motion);
}

/* ── atmosphere layer: sits between the background and the chat ── */
function getLayer() {
    let layer = document.getElementById('sc-atmo');
    if (!layer) {
        layer = document.createElement('div');
        layer.id = 'sc-atmo';
        layer.setAttribute('aria-hidden', 'true');
        layer.innerHTML = '<div class="sc-fog sc-fog-far"></div><div class="sc-fog sc-fog-near"></div>';
        const bg = document.getElementById('bg1');
        if (bg && bg.parentNode) bg.after(layer);
        else document.body.prepend(layer);
    }
    return layer;
}

function getDustCanvas() {
    let canvas = document.getElementById('sc-dust-canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'sc-dust-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        document.body.appendChild(canvas);
    }
    return canvas;
}

/* ── dust: a few soft specks drifting upward, ~30 fps, paused when hidden ── */
class Dust {
    constructor(canvas) {
        this.canvas = canvas;
        this.g = canvas.getContext('2d');
        this.specks = [];
        this.raf = 0;
        this.last = 0;
        this.count = 0;
        this.resize = this.resize.bind(this);
        this.loop = this.loop.bind(this);
        let t = 0;
        window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(this.resize, 200); });
    }

    resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.w = window.innerWidth;
        this.h = window.innerHeight;
        this.canvas.width = Math.round(this.w * dpr);
        this.canvas.height = Math.round(this.h * dpr);
        this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.setAmount(this.amount ?? 0);
    }

    setAmount(amount) {
        this.amount = amount;
        const max = window.innerWidth < 800 ? 30 : 60;
        this.count = Math.round((amount / 100) * max);
        while (this.specks.length < this.count) this.specks.push(this.spawn(true));
        this.specks.length = this.count;
        if (!this.raf) this.draw();
    }

    spawn(anywhere) {
        const near = Math.random() < 0.25;
        return {
            x: Math.random() * (this.w || window.innerWidth),
            y: anywhere ? Math.random() * (this.h || window.innerHeight) : (this.h || window.innerHeight) + 6,
            r: near ? 1.2 + Math.random() * 1.1 : 0.5 + Math.random() * 0.8,
            vy: -(near ? 9 : 4) - Math.random() * 6,       // px per second, upward
            sway: 6 + Math.random() * 14,
            phase: Math.random() * Math.PI * 2,
            speed: 0.15 + Math.random() * 0.35,
            a: near ? 0.35 + Math.random() * 0.3 : 0.15 + Math.random() * 0.25,
            pink: Math.random() < 0.4,
        };
    }

    step(dt) {
        const s = dt / 1000;
        for (let i = 0; i < this.specks.length; i++) {
            const p = this.specks[i];
            p.phase += p.speed * s;
            p.y += p.vy * s;
            if (p.y < -8) this.specks[i] = this.spawn(false);
        }
    }

    draw() {
        const g = this.g;
        g.clearRect(0, 0, this.w || 0, this.h || 0);
        for (const p of this.specks) {
            const x = p.x + Math.sin(p.phase) * p.sway;
            const c = p.pink ? '249, 220, 236' : '231, 227, 224';
            g.fillStyle = `rgba(${c}, ${p.a * 0.18})`;
            g.beginPath(); g.arc(x, p.y, p.r * 3, 0, Math.PI * 2); g.fill();
            g.fillStyle = `rgba(${c}, ${p.a})`;
            g.beginPath(); g.arc(x, p.y, p.r, 0, Math.PI * 2); g.fill();
        }
    }

    loop(t) {
        this.raf = requestAnimationFrame(this.loop);
        if (t - this.last < 33) return;
        const dt = this.last ? Math.min(t - this.last, 100) : 33;
        this.last = t;
        this.step(dt);
        this.draw();
    }

    start() {
        if (this.raf || document.hidden) return;
        this.last = 0;
        this.raf = requestAnimationFrame(this.loop);
    }

    stop() {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
    }
}

let dust;

function applyAtmosphere() {
    const s = getSettings();
    const layer = getLayer();
    const still = reducedMotion();

    const canvas = getDustCanvas();

    layer.classList.toggle('sc-fog-on', s.fog);
    layer.classList.toggle('sc-fog-front', s.fogFront);
    layer.classList.toggle('sc-still', still);
    layer.style.setProperty('--sc-fog-density', String(s.fogDensity / 100));
    canvas.classList.toggle('sc-dust-on', s.dust);

    if (!dust) {
        dust = new Dust(canvas);
        dust.resize();
    }
    dust.setAmount(s.dust ? s.dustAmount : 0);
    if (s.dust && !still) dust.start();
    else dust.stop();

    const note = document.getElementById('sc-still-note');
    if (note) note.hidden = !still || !(s.fog || s.dust);
}

/* ── settings panel ───────────────────────────────────── */
function panelHtml() {
    return `
    <div id="sc-settings" class="sc-settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b><span class="sc-star">✦</span> Shadow Cherry</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <label class="checkbox_label" for="sc-fog">
                    <input id="sc-fog" type="checkbox">
                    <span>${T.fog}</span>
                </label>
                <div class="sc-range">
                    <label for="sc-fog-density">${T.density}</label>
                    <input id="sc-fog-density" type="range" min="0" max="100" step="5">
                    <output id="sc-fog-density-out" for="sc-fog-density"></output>
                </div>
                <label class="checkbox_label sc-sub" for="sc-fog-front">
                    <input id="sc-fog-front" type="checkbox">
                    <span>${T.fogFront}</span>
                </label>

                <label class="checkbox_label" for="sc-dust">
                    <input id="sc-dust" type="checkbox">
                    <span>${T.dust}</span>
                </label>
                <div class="sc-range">
                    <label for="sc-dust-amount">${T.amount}</label>
                    <input id="sc-dust-amount" type="range" min="0" max="100" step="5">
                    <output id="sc-dust-amount-out" for="sc-dust-amount"></output>
                </div>

                <small class="sc-note" id="sc-still-note" hidden>${T.still}</small>
            </div>
        </div>
    </div>`;
}

function buildPanel() {
    const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!host || document.getElementById('sc-settings')) return;
    host.insertAdjacentHTML('beforeend', panelHtml());

    const s = getSettings();
    const $id = (id) => document.getElementById(id);
    const bindCheck = (id, key, after) => {
        const el = $id(id);
        el.checked = Boolean(s[key]);
        el.addEventListener('change', () => { s[key] = el.checked; save(); after(); });
    };
    const bindRange = (id, key, after) => {
        const el = $id(id), out = $id(`${id}-out`);
        el.value = s[key];
        out.textContent = s[key];
        el.addEventListener('input', () => {
            s[key] = Number(el.value);
            out.textContent = el.value;
            save();
            after();
        });
    };

    bindCheck('sc-fog', 'fog', applyAtmosphere);
    bindCheck('sc-fog-front', 'fogFront', applyAtmosphere);
    bindCheck('sc-dust', 'dust', applyAtmosphere);
    bindRange('sc-fog-density', 'fogDensity', applyAtmosphere);
    bindRange('sc-dust-amount', 'dustAmount', applyAtmosphere);
}

/* ── start ────────────────────────────────────────────── */
function init() {
    getSettings();
    buildPanel();
    applyAtmosphere();

    document.addEventListener('visibilitychange', () => {
        if (!dust) return;
        if (document.hidden) dust.stop();
        else applyAtmosphere();
    });
    motionQuery.addEventListener?.('change', applyAtmosphere);
    // SillyTavern's own "Reduced motion" checkbox in User Settings
    document.addEventListener('change', (e) => {
        if (e.target && e.target.id === 'reduced_motion') setTimeout(applyAtmosphere, 0);
    });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
