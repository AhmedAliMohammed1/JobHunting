import type { ApplicationTask } from "@/src/lib/applications/providers/base";

export interface QueueTask { task: ApplicationTask; attempts: number; availableAt: string }
export interface TaskQueue {
  enqueue(task: ApplicationTask): Promise<void>;
  claim(): Promise<QueueTask | null>;
  complete(taskId: string): Promise<void>;
  fail(taskId: string, retryAt?: string): Promise<void>;
}

export class InMemoryTaskQueue implements TaskQueue {
  private tasks: QueueTask[] = [];
  async enqueue(task: ApplicationTask) { this.tasks.push({ task, attempts: 0, availableAt: new Date().toISOString() }); }
  async claim() { return this.tasks.find((item) => new Date(item.availableAt) <= new Date()) ?? null; }
  async complete(taskId: string) { this.tasks = this.tasks.filter((item) => item.task.id !== taskId); }
  async fail(taskId: string, retryAt = new Date(Date.now() + 60_000).toISOString()) {
    const item = this.tasks.find((entry) => entry.task.id === taskId);
    if (item) { item.attempts += 1; item.availableAt = retryAt; }
  }
}
