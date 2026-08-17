import { getServerEnv } from "@/src/config/env";
import type { JobProvider } from "@/src/types/jobs";
import { mockJobProvider } from "./mock";
import { remotiveProvider } from "./remotive";

export function configuredJobProviders(): JobProvider[] {
  const env = getServerEnv();
  if (env.JOB_PROVIDER_MODE === "mock") return [mockJobProvider];
  return env.ENABLE_REMOTIVE === "true" ? [remotiveProvider] : [];
}
