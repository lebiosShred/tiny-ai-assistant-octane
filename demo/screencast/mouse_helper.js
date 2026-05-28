// This script is injected into the browser context by Playwright.
// It creates a visual representation of the mouse cursor and click ripples.
(function() {
  if (window.name === 'playwright-mouse-helper') return;
  window.name = 'playwright-mouse-helper';

  // Ensure DOM is ready or wait for it
  const init = () => {
    if (document.getElementById('playwright-cursor-visual')) return;

    const cursor = document.createElement('div');
    cursor.id = 'playwright-cursor-visual';
    cursor.style.position = 'fixed';
    cursor.style.top = '0';
    cursor.style.left = '0';
    cursor.style.width = '24px';
    cursor.style.height = '24px';
    cursor.style.pointerEvents = 'none';
    cursor.style.zIndex = '10000000';
    cursor.style.transform = 'translate3d(-100px, -100px, 0)';
    cursor.style.transition = 'transform 0.05s ease-out';
    cursor.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: translate(-3px, -2px); filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.35));">
        <path d="M5.5 3.2V20.8L10.5 15.8H18L5.5 3.2Z" fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
    `;
    document.body.appendChild(cursor);

    document.addEventListener('mousemove', (e) => {
      cursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    }, true);

    document.addEventListener('mousedown', (e) => {
      const ripple = document.createElement('div');
      ripple.style.position = 'fixed';
      ripple.style.left = `${e.clientX - 15}px`;
      ripple.style.top = `${e.clientY - 15}px`;
      ripple.style.width = '30px';
      ripple.style.height = '30px';
      ripple.style.borderRadius = '50%';
      ripple.style.border = '2px solid #4daeeb';
      ripple.style.backgroundColor = 'rgba(77, 174, 235, 0.3)';
      ripple.style.pointerEvents = 'none';
      ripple.style.zIndex = '9999999';
      ripple.style.transform = 'scale(0.1)';
      ripple.style.opacity = '1';
      ripple.style.transition = 'transform 0.25s ease-out, opacity 0.25s ease-out';
      document.body.appendChild(ripple);

      // Force reflow and animate
      requestAnimationFrame(() => {
        ripple.style.transform = 'scale(1)';
        ripple.style.opacity = '0';
      });

      setTimeout(() => {
        ripple.remove();
      }, 300);
    }, true);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
