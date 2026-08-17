import { timingSafeEqual } from "node:crypto";

export function isAuthorizedWorker(request: Request): boolean {
  const expected = process.env.AUTOMATION_WORKER_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}
