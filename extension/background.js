chrome.runtime.onInstalled.addListener(() => chrome.storage.local.set({ autoSubmit: false }));
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "PAGE_ANALYSIS" && sender.tab?.id) chrome.storage.session.set({ [`analysis:${sender.tab.id}`]: message.payload });
  sendResponse({ ok: true });
});
