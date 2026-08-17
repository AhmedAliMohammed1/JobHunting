import { z } from "zod";
import { runTask } from "./runner.js";

const env = z.object({ WORKER_POLL_URL: z.string().url(), WORKER_SECRET: z.string().min(24), WORKER_POLL_MS: z.coerce.number().int().min(1000).default(5000) }).parse(process.env);

async function poll() {
  const response = await fetch(env.WORKER_POLL_URL, { headers: { Authorization: `Bearer ${env.WORKER_SECRET}` }, signal: AbortSignal.timeout(15_000) });
  if (response.status === 204) return;
  if (!response.ok) throw new Error(`Queue returned ${response.status}`);
  const task = await response.json();
  const result = await runTask(task);
  await fetch(`${env.WORKER_POLL_URL}/${encodeURIComponent(result.taskId)}`, { method: "POST", headers: { Authorization: `Bearer ${env.WORKER_SECRET}`, "Content-Type": "application/json" }, body: JSON.stringify(result), signal: AbortSignal.timeout(15_000) });
}

async function main() {
  for (;;) {
    try { await poll(); } catch (error) { console.error(JSON.stringify({ level: "error", event: "worker_poll_failed", error: error instanceof Error ? error.name : "UnknownError" })); }
    await new Promise((resolve) => setTimeout(resolve, env.WORKER_POLL_MS));
  }
}

void main();
