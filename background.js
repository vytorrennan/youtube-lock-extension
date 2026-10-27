const FIRST_ALLOW_RULE = 100;
const BLOCK_FILTERS = [
  '||youtube.com/watch?', '||youtube.com/shorts/',
  '||youtube.com/live/', '||youtube.com/embed/', '||youtu.be/'
];

function videoId(address) {
  try {
    const url = new URL(address);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.hostname === 'youtu.be') return url.pathname.split('/')[1] || null;
    if (!/(^|\.)youtube\.com$/.test(url.hostname)) return null;
    if (url.pathname === '/watch') return url.searchParams.get('v');
    const match = url.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/);
    return match ? match[1] : null;
  } catch { return null; }
}

// URL filters avoid Chrome's compiled regular-expression size limit.
function allowFilters(id) {
  const v = encodeURIComponent(id);
  return [
    `||youtube.com/watch?v=${v}^`,
    `||youtube.com/watch?*&v=${v}^`,
    `||youtube.com/shorts/${v}^`,
    `||youtube.com/live/${v}^`,
    `||youtube.com/embed/${v}^`,
    `||youtu.be/${v}^`
  ];
}

async function setBadge(locked) {
  await chrome.action.setBadgeText({ text: locked ? 'ON' : '' });
  if (locked) await chrome.action.setBadgeBackgroundColor({ color: '#c62828' });
}

async function lock() {
  const tabs = await chrome.tabs.query({});
  const allowed = {};
  const rules = BLOCK_FILTERS.map((urlFilter, index) => ({
    id: index + 1, priority: 1,
    action: { type: 'redirect', redirect: { extensionPath: '/blocked.html' } },
    condition: { urlFilter, resourceTypes: ['main_frame'] }
  }));
  for (const tab of tabs) {
    const id = videoId(tab.pendingUrl || tab.url || '');
    if (id && tab.id != null) {
      allowed[tab.id] = id;
      for (const urlFilter of allowFilters(id)) {
        rules.push({ id: FIRST_ALLOW_RULE + rules.length, priority: 2, action: { type: 'allow' }, condition: { urlFilter, tabIds: [tab.id], resourceTypes: ['main_frame'] } });
      }
    }
  }
  const old = await chrome.declarativeNetRequest.getSessionRules();
  await chrome.storage.session.set({ locked: true, allowed });
  try {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: old.map(rule => rule.id), addRules: rules });
  } catch (error) {
    await chrome.storage.session.set({ locked: false, allowed: {} });
    throw error;
  }
  await setBadge(true);
  return Object.keys(allowed).length;
}

async function unlock() {
  const old = await chrome.declarativeNetRequest.getSessionRules();
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: old.map(rule => rule.id) });
  await chrome.storage.session.set({ locked: false, allowed: {} });
  await setBadge(false);
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  (async () => {
    if (message.type === 'status') {
      const state = await chrome.storage.session.get(['locked', 'allowed']);
      return { locked: !!state.locked, count: Object.keys(state.allowed || {}).length };
    }
    if (message.type === 'lock') return { locked: true, count: await lock() };
    if (message.type === 'unlock') { await unlock(); return { locked: false, count: 0 }; }
    throw new Error('Unknown request');
  })().then(respond, error => respond({ error: error.message }));
  return true;
});

// YouTube often changes videos without a full page navigation.
chrome.webNavigation.onHistoryStateUpdated.addListener(async details => {
  if (details.frameId !== 0) return;
  const id = videoId(details.url);
  if (!id) return;
  const { locked, allowed = {} } = await chrome.storage.session.get(['locked', 'allowed']);
  if (locked && allowed[details.tabId] !== id) {
    try { await chrome.tabs.update(details.tabId, { url: chrome.runtime.getURL('blocked.html') }); } catch { /* Tab was closed. */ }
  }
});

chrome.tabs.onRemoved.addListener(async tabId => {
  const state = await chrome.storage.session.get(['locked', 'allowed']);
  if (!state.locked || !state.allowed || !(tabId in state.allowed)) return;
  delete state.allowed[tabId];
  await chrome.storage.session.set({ allowed: state.allowed });
});
