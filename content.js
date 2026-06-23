const KATEX_SELECTOR = '.katex';
const TEX_SELECTOR = '.katex-mathml annotation[encoding="application/x-tex"]';

let toast = null;

function showToast(message, isError = false) {
  if (toast) {
    clearTimeout(toast._timeout);
    toast.remove();
  }

  toast = document.createElement('div');
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    padding: '10px 16px',
    borderRadius: '8px',
    background: isError ? '#c0392b' : '#1a1a2e',
    color: '#fff',
    fontSize: '14px',
    fontFamily: 'sans-serif',
    zIndex: '2147483647',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    transition: 'opacity 0.3s ease',
    opacity: '1',
    pointerEvents: 'none',
  });

  document.body.appendChild(toast);

  toast._timeout = setTimeout(() => {
    if (toast) {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast) {
          toast.remove();
          toast = null;
        }
      }, 300);
    }
  }, 2000);
}

function highlightKatex(el) {
  el.style.outline = '2px solid #6c63ff';
  el.style.borderRadius = '3px';
  el.style.cursor = 'copy';
  el.style.transition = 'outline 0.15s ease';
}

function unhighlightKatex(el) {
  el.style.outline = '';
  el.style.cursor = '';
}

document.addEventListener('mouseover', (event) => {
  if (!(event.target instanceof Element)) return;
  const katex = event.target.closest(KATEX_SELECTOR);
  if (katex) highlightKatex(katex);
});

document.addEventListener('mouseout', (event) => {
  if (!(event.target instanceof Element)) return;
  const katex = event.target.closest(KATEX_SELECTOR);
  if (katex) unhighlightKatex(katex);
});

document.addEventListener('click', async (event) => {
  if (!(event.target instanceof Element)) return;

  const katex = event.target.closest(KATEX_SELECTOR);
  if (!katex) return;

  const annotation = katex.querySelector(TEX_SELECTOR);
  if (!annotation) {
    showToast('Could not find TeX source.', true);
    return;
  }

  const tex = annotation.textContent.trim();
  if (!tex) {
    showToast('TeX source is empty.', true);
    return;
  }

  try {
    await navigator.clipboard.writeText(tex);
    showToast('Copied: ' + tex);
  } catch {
    showToast('Clipboard access denied.', true);
  }
});
