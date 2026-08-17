import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(10).optional(),
  SUPABASE_SECRET_KEY: z.string().min(10).optional(),
  AI_PROVIDER: z.enum(["mock", "openai-compatible", "not-configured"]).default("mock"),
  AI_API_KEY: z.string().min(1).optional(),
  AI_BASE_URL: z.string().url().optional(),
  AI_MODEL: z.string().optional(),
  EMBEDDING_MODEL: z.string().optional(),
  CRON_SECRET: z.string().min(24).optional(),
  AUTOMATION_WORKER_URL: z.string().url().optional(),
  AUTOMATION_WORKER_SECRET: z.string().min(24).optional(),
  ENABLE_ARBEITNOW: z.enum(["true", "false"]).default("true"),
  ENABLE_REMOTE_OK: z.enum(["true", "false"]).default("true"),
  ENABLE_REMOTIVE: z.enum(["true", "false"]).default("false"),
  ADZUNA_APP_ID: z.string().min(1).optional(),
  ADZUNA_APP_KEY: z.string().min(1).optional(),
  ADZUNA_COUNTRIES: z.string().default("de,gb,us"),
  JOOBLE_API_KEY: z.string().min(1).optional(),
  JOB_PROVIDER_MODE: z.enum(["mock", "live"]).default("mock"),
  REMOTIVE_CACHE_TTL_SECONDS: z.coerce.number().int().min(900).default(21600),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid server configuration: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  }
  return parsed.data;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function effectiveJobProviderMode(env = getServerEnv()): "mock" | "live" {
  return env.NODE_ENV === "production" ? "live" : env.JOB_PROVIDER_MODE;
}
