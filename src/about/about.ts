interface AboutPanel {
  open: () => void;
  close: () => void;
}

export function createAboutPanel(): AboutPanel {
  const el = document.getElementById('about-panel')!;

  el.innerHTML = `
    <div class="about-backdrop"></div>
    <div class="about-card">
      <h2 class="about-title">Photography Portfolio</h2>
      <p class="about-text">
        A photography portfolio built with <strong>HTML-in-Canvas</strong>, an experimental web API
        that lets you place live HTML inside a canvas and render it through custom WebGL2 shaders.
      </p>
      <p class="about-text">
        Every viewing mode is a real portfolio experience — the kind photographers use to present
        their work — enhanced by HiC in ways that are impossible with CSS and JavaScript alone.
      </p>
      <div class="about-links">
        <a href="https://github.com/WICG/html-in-canvas" target="_blank" rel="noopener">
          HiC Spec ↗
        </a>
      </div>
      <button class="about-close">Close</button>
    </div>
  `;

  const backdrop = el.querySelector('.about-backdrop')!;
  const closeBtn = el.querySelector('.about-close')!;

  function close() {
    el.classList.remove('panel-visible');
    el.classList.add('panel-hidden');
  }

  backdrop.addEventListener('click', close);
  closeBtn.addEventListener('click', close);

  return {
    open() {
      el.classList.remove('panel-hidden');
      el.classList.add('panel-visible');
    },
    close,
  };
}
