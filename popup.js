'use strict';

const DEFAULTS = {
    features: { katex: true, mathjax: true },
    listMode: 'blacklist',
    blacklist: [],
    whitelist: []
};

let cfg = structuredClone(DEFAULTS);

function load() {
    return new Promise(r => chrome.storage.local.get('copytex', d => {
        if (d.copytex) {
            cfg = {
                ...DEFAULTS,
                ...d.copytex,
                features: { ...DEFAULTS.features, ...(d.copytex.features || {}) }
            };
        }
        r();
    }));
}

function save() {
    return new Promise(r => chrome.storage.local.set({ copytex: cfg }, r));
}

function activeList() {
    return cfg.listMode === 'blacklist' ? cfg.blacklist : cfg.whitelist;
}

function setActiveList(list) {
    if (cfg.listMode === 'blacklist') cfg.blacklist = list;
    else cfg.whitelist = list;
}

function renderMode() {
    const isBL = cfg.listMode === 'blacklist';
    document.getElementById('mode-pill').classList.toggle('whitelist', !isBL);
    document.getElementById('opt-blacklist').classList.toggle('active', isBL);
    document.getElementById('opt-whitelist').classList.toggle('active', !isBL);
    document.getElementById('mode-desc').textContent = isBL
        ? 'Extension runs everywhere except the listed domains.'
        : 'Extension runs only on the listed domains.';
    document.getElementById('list-title').textContent = isBL ? 'Blocked on:' : 'Enabled on:';
}

function renderList() {
    const list = activeList();
    const container = document.getElementById('domain-list');
    const empty = document.getElementById('empty-state');

    container.innerHTML = '';

    if (!list.length) {
        container.style.display = 'none';
        empty.textContent = cfg.listMode === 'blacklist'
            ? 'No blocked sites - extension runs everywhere.'
            : 'No sites added - extension is disabled everywhere.';
        empty.style.display = 'block';
        return;
    }

    container.style.display = 'block';
    empty.style.display = 'none';

    list.forEach((domain, i) => {
        const item = document.createElement('div');
        item.className = 'domain-item';

        const name = document.createElement('span');
        name.className = 'domain-name';
        name.textContent = domain;

        const btn = document.createElement('button');
        btn.className = 'remove-btn';
        btn.title = 'Remove';
        btn.textContent = '×';
        btn.addEventListener('click', async () => {
            setActiveList(activeList().filter((_, j) => j !== i));
            await save();
            renderList();
        });

        item.appendChild(name);
        item.appendChild(btn);
        container.appendChild(item);
    });
}

function isValidDomain(val) {
    const s = val.replace(/^\*\./, '');
    return /^[a-zA-Z0-9]([a-zA-Z0-9\-.]*[a-zA-Z0-9])?$/.test(s) && s.includes('.');
}

function initAddForm() {
    const addBtn   = document.getElementById('add-btn');
    const addForm  = document.getElementById('add-form');
    const cancelBtn = document.getElementById('cancel-add');
    const input    = document.getElementById('domain-input');
    const subQ     = document.getElementById('subdomain-q');
    const preview  = document.getElementById('domain-preview');
    const btnSub   = document.getElementById('btn-subdomains');
    const btnExact = document.getElementById('btn-exact');

    function showSubdomainQ(domain) {
        const base = domain.replace(/^\*\./, '');
        preview.textContent = base;
        btnSub.textContent = `*.${base}`;
        btnExact.textContent = base;
        subQ.style.display = 'block';
    }

    function hideForm() {
        addForm.style.display = 'none';
        addBtn.style.display = 'block';
        input.value = '';
        subQ.style.display = 'none';
    }

    async function addDomain(pattern) {
        const list = activeList();
        if (!list.includes(pattern)) {
            list.push(pattern);
            setActiveList(list);
            await save();
            renderList();
        }
        hideForm();
    }

    addBtn.addEventListener('click', () => {
        addForm.style.display = 'block';
        addBtn.style.display = 'none';
        input.focus();
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            if (!tabs[0]?.url) return;
            try {
                const host = new URL(tabs[0].url).hostname;
                if (host) { input.value = host; showSubdomainQ(host); }
            } catch {}
        });
    });

    cancelBtn.addEventListener('click', hideForm);

    input.addEventListener('keydown', e => { if (e.key === 'Escape') hideForm(); });

    input.addEventListener('input', () => {
        const val = input.value.trim();
        if (val && isValidDomain(val)) showSubdomainQ(val);
        else subQ.style.display = 'none';
    });

    btnSub.addEventListener('click', () => {
        const base = input.value.trim().replace(/^\*\./, '');
        if (base) addDomain(`*.${base}`);
    });

    btnExact.addEventListener('click', () => {
        const base = input.value.trim().replace(/^\*\./, '');
        if (base) addDomain(base);
    });
}

function loadStats() {
    return new Promise(r => chrome.storage.local.get('copytex_stats', d => r(d.copytex_stats || null)));
}

function fmtNum(n) { return (n || 0).toLocaleString(); }

function renderStats(stats) {
    const empty    = document.getElementById('stats-empty');
    const overview = document.getElementById('stats-overview');
    const byType   = document.getElementById('stats-by-type');
    const bySite   = document.getElementById('stats-by-site');

    if (!stats || !stats.totalCount) {
        empty.style.display = 'block';
        overview.style.display = 'none';
        byType.style.display = 'none';
        bySite.style.display = 'none';
        return;
    }

    empty.style.display = 'none';
    overview.style.display = 'flex';
    document.getElementById('stat-total-count').textContent = fmtNum(stats.totalCount);
    document.getElementById('stat-total-chars').textContent = fmtNum(stats.totalChars);

    const typeEntries = Object.entries(stats.byType || {}).sort((a, b) => b[1] - a[1]);
    if (typeEntries.length >= 2) {
        byType.innerHTML = '';
        byType.style.display = 'block';
        typeEntries.forEach(([type, count]) => {
            const row = document.createElement('div');
            row.className = 'stat-type-row';
            const name = document.createElement('span');
            name.className = 'stat-type-name';
            name.textContent = type;
            const val = document.createElement('span');
            val.className = 'stat-type-count';
            val.textContent = fmtNum(count);
            row.appendChild(name);
            row.appendChild(val);
            byType.appendChild(row);
        });
    } else {
        byType.style.display = 'none';
    }

    const sites = Object.entries(stats.bySite || {}).sort((a, b) => b[1].count - a[1].count);
    if (sites.length) {
        bySite.innerHTML = '';
        bySite.style.display = 'block';
        const title = document.createElement('div');
        title.className = 'stats-site-title';
        title.textContent = 'By site';
        bySite.appendChild(title);
        const list = document.createElement('div');
        list.className = 'stats-site-list';
        sites.forEach(([host, data]) => {
            const row = document.createElement('div');
            row.className = 'stats-site-row';
            const name = document.createElement('span');
            name.className = 'stats-site-name';
            name.textContent = host;
            const count = document.createElement('span');
            count.className = 'stats-site-count';
            count.textContent = fmtNum(data.count);
            const chars = document.createElement('span');
            chars.className = 'stats-site-chars';
            chars.textContent = fmtNum(data.chars) + ' ch';
            row.appendChild(name);
            row.appendChild(count);
            row.appendChild(chars);
            list.appendChild(row);
        });
        bySite.appendChild(list);
    } else {
        bySite.style.display = 'none';
    }
}

async function init() {
    await load();

    document.getElementById('feature-katex').checked = cfg.features.katex;
    document.getElementById('feature-mathjax').checked = cfg.features.mathjax;

    renderMode();
    renderList();
    initAddForm();

    renderStats(await loadStats());

    document.getElementById('feature-katex').addEventListener('change', async e => {
        cfg.features.katex = e.target.checked;
        await save();
    });

    document.getElementById('feature-mathjax').addEventListener('change', async e => {
        cfg.features.mathjax = e.target.checked;
        await save();
    });

    ['blacklist', 'whitelist'].forEach(mode => {
        document.getElementById(`opt-${mode}`).addEventListener('click', async () => {
            if (cfg.listMode === mode) return;
            cfg.listMode = mode;
            await save();
            renderMode();
            renderList();
        });
    });
}

init();
