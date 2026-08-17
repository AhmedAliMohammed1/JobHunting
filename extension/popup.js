document.querySelector("#inspect").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const data = await chrome.storage.session.get(`analysis:${tab.id}`);
  const analysis = data[`analysis:${tab.id}`];
  document.querySelector("#status").textContent = analysis ? `${analysis.controls.length} fields found${analysis.hasCaptcha ? "; CAPTCHA requires you" : ""}.` : "Open a secure application page first.";
});
