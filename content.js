// A tab may receive this script both from the manifest and an explicit injection.
(() => {
  if (globalThis.__youtubeTabLockRecommendations) return;
  globalThis.__youtubeTabLockRecommendations = true;

  const style = document.createElement('style');
  style.textContent = `
    /* Desktop home feed and watch-page recommendations. */
    ytd-browse[page-subtype="home"] ytd-rich-grid-renderer,
    ytd-watch-next-secondary-results-renderer,
    ytd-watch-flexy #related,
    /* Suggestions over the player and at the end of a video. */
    .ytp-endscreen-content,
    .ytp-ce-element,
    .ytp-cards-teaser,
    .ytp-cards-button,
    /* Mobile YouTube home and watch recommendations. */
    ytm-browse[page-subtype="home"] ytm-rich-grid-renderer,
    ytm-browse[page-subtype="home"] ytm-section-list-renderer,
    ytm-watch-next-secondary-results-renderer,
    ytm-single-column-watch-next-results-renderer > ytm-item-section-renderer {
      display: none !important;
    }
  `;

  function setLocked(locked) {
    if (locked) {
      if (!style.isConnected) document.documentElement.appendChild(style);
    } else {
      style.remove();
    }
  }

  let receivedUpdate = false;
  chrome.runtime.onMessage.addListener(message => {
    if (message.type === 'lock-state') {
      receivedUpdate = true;
      setLocked(message.locked);
    }
  });
  chrome.runtime.sendMessage({ type: 'status' })
    .then(state => { if (!receivedUpdate && !state.error) setLocked(state.locked); })
    .catch(() => {});
})();
