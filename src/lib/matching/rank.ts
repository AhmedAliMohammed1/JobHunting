import type { CandidateProfile } from "@/src/types/candidate";
import type { NormalizedJob } from "@/src/types/jobs";
import { scoreJobMatch } from "./engine";

export function rankJobs(profile: CandidateProfile, jobs: NormalizedJob[]) {
  return jobs
    .map((job) => ({ job, match: scoreJobMatch(profile, job) }))
    .sort((left, right) => right.match.score - left.match.score || left.job.id.localeCompare(right.job.id));
}
