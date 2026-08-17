import type { WorkerTask } from "./types.js";

export function assertSafeTask(task: WorkerTask): URL {
  const url = new URL(task.url);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Only credential-free HTTPS application URLs are accepted.");
  if (!task.allowlistedDomains.includes(url.hostname)) throw new Error("Application domain is not allowlisted.");
  if (task.fields.some((field) => field.sensitive && field.value)) throw new Error("Sensitive answers require in-product user approval and are not accepted by the worker payload.");
  return url;
}
