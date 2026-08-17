import { describe, expect, it } from "vitest";
import { mockJobProvider } from "@/src/lib/jobs/providers/mock";
import { jobSearchSchema } from "@/src/lib/validation/search";
import { normalizedJobInputSchema } from "@/src/lib/validation/product";

describe("job-provider contract", () => {
  it("returns normalized, labeled fixture results", async () => {
    const jobs = await mockJobProvider.search(jobSearchSchema.parse({ roles: ["engineer"], limit: 25 }));
    expect(jobs.length).toBeGreaterThan(0);
    for (const job of jobs) {
      expect(normalizedJobInputSchema.safeParse(job).success).toBe(true);
      expect(job.provider).toBe("mock");
      expect(job.employmentType).toBe("Full-time");
      expect(new URL(job.sourceUrl).protocol).toBe("https:");
    }
  });
});
