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
        if (features.katex === false && features.mathjax === false) return false;
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

    function recordStat(type, chars) {
        chrome.storage.local.get('copytex_stats', result => {
            const s = result.copytex_stats || { totalCount: 0, totalChars: 0, byType: {}, bySite: {} };
            s.totalCount = (s.totalCount || 0) + 1;
            s.totalChars = (s.totalChars || 0) + chars;
            s.byType[type] = (s.byType[type] || 0) + 1;
            const host = location.hostname;
            if (!s.bySite[host]) s.bySite[host] = { count: 0, chars: 0 };
            s.bySite[host].count++;
            s.bySite[host].chars += chars;
            chrome.storage.local.set({ copytex_stats: s });
        });
    }

    function handleClick(event) {
        const annotation = event.currentTarget.querySelector('annotation');
        if (!annotation) { showToast('No annotation found.'); return; }
        const text = annotation.textContent.trim();
        if (!text) { showToast('Annotation is empty.'); return; }
        navigator.clipboard.writeText(text)
            .then(() => { showToast('Copied!'); recordStat('katex', text.length); })
            .catch(() => showToast('Failed to copy.'));
    }

    function getMathJaxLatex(container) {
        return container.querySelector('mjx-math[data-latex]')?.dataset?.latex?.trim() || null;
    }

    function getMathJaxSelectedLatex(el) {
        const own = el.getAttribute('data-latex');
        if (own) return own.trim() || null;
        const ancestor = el.closest('[data-latex]');
        if (ancestor) return ancestor.getAttribute('data-latex').trim() || null;
        const child = el.querySelector('[data-latex]');
        if (child) return child.getAttribute('data-latex').trim() || null;
        return null;
    }

    function handleMathJaxClick(event) {
        if (event.target !== event.currentTarget) return;
        const latex = getMathJaxLatex(event.currentTarget);
        if (!latex) { showToast('No LaTeX found.'); return; }
        navigator.clipboard.writeText(latex)
            .then(() => { showToast('Copied!'); recordStat('mathjax', latex.length); })
            .catch(() => showToast('Failed to copy.'));
    }

    const attached = new WeakSet();

    function updateListeners(cfg) {
        if (cfg.features.katex !== false) {
            document.querySelectorAll('.katex').forEach(el => {
                if (attached.has(el)) return;
                attached.add(el);
                el.style.cursor = 'pointer';
                el.addEventListener('click', handleClick);
            });
        }

        if (cfg.features.mathjax !== false) {
            document.querySelectorAll('mjx-container').forEach(el => {
                if (attached.has(el)) return;
                if (!getMathJaxLatex(el)) return;
                attached.add(el);
                el.style.cursor = 'pointer';
                el.addEventListener('click', handleMathJaxClick);
            });
        }
    }

    chrome.storage.local.get('copytex', result => {
        const saved = result.copytex || {};
        const cfg = {
            features: { katex: true, mathjax: true, ...(saved.features || {}) },
            listMode: saved.listMode || 'blacklist',
            blacklist: saved.blacklist || [],
            whitelist: saved.whitelist || []
        };

        if (!shouldRun(cfg)) return;

        document.addEventListener('copy', e => {
            const sel = window.getSelection();
            let katexChars = 0, mathjaxChars = 0;
            let clipText = null, clipHtml = null;

            if (sel && !sel.isCollapsed) {
                const frag = sel.getRangeAt(0).cloneContents();
                if (cfg.features.katex !== false) {
                    frag.querySelectorAll('.katex').forEach(k => {
                        const latex = k.querySelector('annotation')?.textContent?.trim();
                        if (latex) { k.replaceWith(document.createTextNode(latex)); katexChars += latex.length; }
                    });
                }
                if (cfg.features.mathjax !== false) {
                    frag.querySelectorAll('mjx-container').forEach(c => {
                        const latex = c.querySelector('mjx-math[data-latex]')?.dataset?.latex?.trim();
                        if (latex) { c.replaceWith(document.createTextNode(latex)); mathjaxChars += latex.length; }
                    });
                }
                if (katexChars + mathjaxChars > 0) {
                    const div = document.createElement('div');
                    div.appendChild(frag);
                    clipText = div.textContent;
                    clipHtml = div.innerHTML;
                }
            }

            // MathJax: handle sub-element selection via mjx-selected (MathJax internal selection)
            // that wasn't captured above via the browser selection fragment
            if (cfg.features.mathjax !== false && mathjaxChars === 0) {
                const seen = new Set();
                const parts = [];
                document.querySelectorAll('.mjx-selected').forEach(el => {
                    const latex = getMathJaxSelectedLatex(el);
                    if (latex && !seen.has(latex)) {
                        seen.add(latex);
                        parts.push(latex);
                        mathjaxChars += latex.length;
                    }
                });
                if (parts.length > 0) {
                    const joined = parts.join(' ');
                    clipText = clipText ? clipText + ' ' + joined : joined;
                    clipHtml = clipHtml ? clipHtml + ' ' + joined : joined;
                }
            }

            if (clipText !== null) {
                e.clipboardData.setData('text/plain', clipText);
                e.clipboardData.setData('text/html', clipHtml);
                e.preventDefault();
            }

            if (katexChars > 0) recordStat('katex', katexChars);
            if (mathjaxChars > 0) recordStat('mathjax', mathjaxChars);
        });

        const observer = new MutationObserver(() => updateListeners(cfg));
        observer.observe(document.body, { childList: true, subtree: true });
        updateListeners(cfg);
    });

})();
