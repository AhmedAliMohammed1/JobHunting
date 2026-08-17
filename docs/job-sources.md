# Job sources

Providers implement the `JobProvider` contract and return normalized listings. Development fixtures are selected only when `JOB_PROVIDER_MODE=mock`; they are never combined with live data.

The included Remotive adapter uses the public remote-jobs endpoint. Public listings can be delayed by 24 hours, so the UI labels them cached/delayed and links to the source. The server caches results for six hours and retries conservatively. Review the provider's current terms and quota before enabling it.

Aggregation uses `Promise.allSettled`, exposes partial failure, normalizes HTML/text, assigns stable provider IDs, deduplicates canonical company/title/location/host keys, and classifies freshness. Additions should prefer official APIs, public ATS endpoints, and approved feeds. Never scrape pages whose terms or controls prohibit it.
