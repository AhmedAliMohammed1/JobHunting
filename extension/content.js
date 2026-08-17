const sensitive = /salary|visa|sponsor|disability|veteran|gender|race|ethnicity|date of birth|nationality/i;
const controls = [...document.querySelectorAll("input, select, textarea")].map((element, index) => {
  const id = element.id || `jobhunter-field-${index}`;
  const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent?.trim() || element.getAttribute("aria-label") || element.name || id;
  return { id, label, type: element.type || element.tagName.toLowerCase(), required: element.required, sensitive: sensitive.test(label) };
});
chrome.runtime.sendMessage({ type: "PAGE_ANALYSIS", payload: { url: location.href, controls, hasCaptcha: Boolean(document.querySelector("iframe[src*='captcha'], [class*='captcha']")) } });
