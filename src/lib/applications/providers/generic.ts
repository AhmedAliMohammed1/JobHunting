import { parseSafeExternalUrl } from "@/src/lib/security/urls";
import type { ApplicationProvider } from "./base";

export const genericApplicationProvider: ApplicationProvider = {
  id: "generic-safe",
  supports(url) { return url.protocol === "https:"; },
  async analyze(task) {
    const url = parseSafeExternalUrl(task.applicationUrl);
    return url ? { state: "WAITING_FOR_USER", message: "Generic forms require extension-assisted review." } : { state: "BLOCKED", message: "Unsafe application URL." };
  },
  async submit(task) {
    if (!task.dryRun) return { state: "UNSUPPORTED", message: "Generic automatic submission is intentionally unsupported." };
    return { state: "READY", message: "Dry run completed without submitting." };
  },
};
