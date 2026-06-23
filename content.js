(function () {
    'use strict';

	const VERSION_ID = "1.0";

    function showToast(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.backgroundColor = '#333';
        toast.style.color = '#fff';
        toast.style.padding = '10px 20px';
        toast.style.borderRadius = '8px';
        toast.style.zIndex = '9999';
        toast.style.opacity = '0.9';
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 2000);
    }

    function handleClick(event) {
        const annotation = event.currentTarget.querySelector('annotation');
        if (!annotation) {
            showToast('No annotation found.');
            return;
        }

        const text = annotation.textContent.trim();
        if (text === '') {
            showToast('Annotation is empty.');
            return;
        }

        navigator.clipboard.writeText(text)
            .then(() => showToast('Copied annotation to clipboard!'))
            .catch(() => showToast('Failed to copy annotation.'));
    }

    const attachedElements = new WeakSet();

    function updateListeners() {
        document.querySelectorAll('.katex').forEach(el => {
            if (attachedElements.has(el)) return;
            attachedElements.add(el);
            el.style.cursor = 'pointer';
            el.addEventListener('click', handleClick);
        });
    }

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

    const observer = new MutationObserver(() => updateListeners());
    observer.observe(document.body, { childList: true, subtree: true });
	console.log(`CopyTeX v${VERSION_ID} is loaded.`);

})();