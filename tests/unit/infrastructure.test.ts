import { afterEach, describe, expect, it, vi } from "vitest";
import { isAuthorizedWorker } from "@/src/lib/auth/worker";
import { InMemoryTaskQueue } from "@/src/lib/queue/task-queue";
import { log, timed } from "@/src/lib/observability/logger";

describe("worker, queue, and observability infrastructure", () => {
  afterEach(() => { delete process.env.AUTOMATION_WORKER_SECRET; vi.restoreAllMocks(); });

  it("compares worker credentials without accepting missing or unequal values", () => {
    process.env.AUTOMATION_WORKER_SECRET = "a-secure-worker-secret";
    expect(isAuthorizedWorker(new Request("https://app.example", { headers: { authorization: "Bearer a-secure-worker-secret" } }))).toBe(true);
    expect(isAuthorizedWorker(new Request("https://app.example", { headers: { authorization: "Bearer wrong" } }))).toBe(false);
    expect(isAuthorizedWorker(new Request("https://app.example"))).toBe(false);
  });

  it("enqueues, claims, retries, and completes tasks", async () => {
    const queue = new InMemoryTaskQueue();
    const task = { id: "task", applicationUrl: "https://jobs.example/apply", dryRun: true, fields: [] };
    await queue.enqueue(task); expect((await queue.claim())?.task.id).toBe("task");
    await queue.fail("task", new Date(Date.now() - 1_000).toISOString()); expect((await queue.claim())?.attempts).toBe(1);
    await queue.complete("task"); expect(await queue.claim()).toBeNull();
  });

  it("redacts sensitive metadata and records successful and failed timings", async () => {
    const info = vi.spyOn(console, "log").mockImplementation(() => undefined); const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    log("info", "event", { userId: "user", password: "never-log" });
    expect(info.mock.calls[0]?.[0]).toContain("userId"); expect(info.mock.calls[0]?.[0]).not.toContain("never-log");
    await expect(timed("success", async () => 42)).resolves.toBe(42);
    await expect(timed("failure", async () => { throw new TypeError("bad"); })).rejects.toThrow("bad");
    expect(errors.mock.calls[0]?.[0]).toContain("TypeError");
  });
});
