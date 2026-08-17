# Browser extension

`extension/` is a Manifest V3 review assistant. The content script inventories fields and flags sensitive labels/CAPTCHA. The popup reports what was found. `autoSubmit` is initialized to false.

For release, restrict host permissions to explicitly supported ATS domains, add signed requests to the JobHunter API, render every proposed value with its source/confidence, require user confirmation for sensitive fields, and publish a narrow privacy policy. The extension must not collect passwords, bypass controls, or click Submit without the same server safety gates.

Load unpacked for development from `chrome://extensions` after enabling Developer mode. Use only on pages you are authorized to test.
