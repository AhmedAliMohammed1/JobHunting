# Job sources

Providers implement the `JobProvider` contract and return normalized listings. Development fixtures are selected only when `JOB_PROVIDER_MODE=mock` outside production; production enforces live mode and never returns fixtures.

The primary production adapter uses Arbeitnow's public job-board API. The feed aggregates current listings from public ATS sources including Greenhouse, SmartRecruiters, Join.com, Teamtailor, Recruitee, and Comeet. Results are cached for one hour, attributed to Arbeitnow, and always link to the supplied source URL. The API is enabled with `ENABLE_ARBEITNOW=true`.

The optional Remotive adapter uses its public remote-jobs endpoint. Public listings can be delayed by 24 hours, so the UI labels them cached/delayed and links to Remotive. The server caches results for six hours and retries conservatively. Review Remotive's current display terms before setting `ENABLE_REMOTIVE=true`.

Aggregation uses `Promise.allSettled`, exposes partial failure, normalizes HTML/text, assigns stable provider IDs, deduplicates canonical company/title/location keys across sources, and classifies freshness. Additions should prefer official APIs, public ATS endpoints, and approved feeds. Never scrape pages whose terms or controls prohibit it.

Natural-language requests are interpreted deterministically before provider search, so roles, technologies, country, location, workplace type, employment type, experience, and date constraints still work when an LLM is unavailable. A configured AI provider may add conservative role expansions, but validated explicit filters remain authoritative. Authenticated searches are ranked against the candidate profile and can apply a minimum CV-match threshold.
