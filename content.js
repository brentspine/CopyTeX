(function () {
    'use strict';

    const VERSION_ID = "1.0";

    function domainMatches(pattern, hostname) {
        if (pattern.startsWith('*.')) {
            const base = pattern.slice(2);
            return hostname === base || hostname.endsWith('.' + base);
        }
        return hostname === pattern;
    }

    function shouldRun(cfg) {
        const { listMode = 'blacklist', blacklist = [], whitelist = [], features = {} } = cfg;
        if (features.katex === false) return false;
        if (listMode === 'whitelist') return whitelist.some(p => domainMatches(p, location.hostname));
        return !blacklist.some(p => domainMatches(p, location.hostname));
    }

    function showToast(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        Object.assign(toast.style, {
            position: 'fixed', bottom: '20px', left: '50%',
            transform: 'translateX(-50%)', backgroundColor: '#333',
            color: '#fff', padding: '10px 20px', borderRadius: '8px',
            zIndex: '9999', opacity: '0.9', pointerEvents: 'none'
        });
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }

    function handleClick(event) {
        const annotation = event.currentTarget.querySelector('annotation');
        if (!annotation) { showToast('No annotation found.'); return; }
        const text = annotation.textContent.trim();
        if (!text) { showToast('Annotation is empty.'); return; }
        navigator.clipboard.writeText(text)
            .then(() => showToast('Copied!'))
            .catch(() => showToast('Failed to copy.'));
    }

    const attached = new WeakSet();

    function updateListeners() {
        document.querySelectorAll('.katex').forEach(el => {
            if (attached.has(el)) return;
            attached.add(el);
            el.style.cursor = 'pointer';
            el.addEventListener('click', handleClick);
        });
    }

    chrome.storage.local.get('copytex', result => {
        const saved = result.copytex || {};
        const cfg = {
            features: { katex: true, ...(saved.features || {}) },
            listMode: saved.listMode || 'blacklist',
            blacklist: saved.blacklist || [],
            whitelist: saved.whitelist || []
        };

        if (!shouldRun(cfg)) return;

        document.addEventListener('copy', e => {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed) return;
            const frag = sel.getRangeAt(0).cloneContents();
            frag.querySelectorAll('.katex').forEach(k => {
                const latex = k.querySelector('annotation')?.textContent?.trim();
                if (latex) k.replaceWith(document.createTextNode(latex));
            });
            const div = document.createElement('div');
            div.appendChild(frag);
            e.clipboardData.setData('text/plain', div.textContent);
            e.clipboardData.setData('text/html', div.innerHTML);
            e.preventDefault();
        });

        const observer = new MutationObserver(updateListeners);
        observer.observe(document.body, { childList: true, subtree: true });
        updateListeners();
        console.log(`CopyTeX v${VERSION_ID} loaded on ${location.hostname}`);
    });

})();
