-- Local development data only. Never run this seed against production.
insert into public.jobs (
  canonical_fingerprint, title, company, location, country, workplace_type,
  employment_type, description, posted_at, status
)
values
  ('mock:northbeam-ml-berlin', 'Machine Learning Engineer', 'Northbeam Labs', 'Berlin', 'Germany', 'hybrid', 'full_time', 'Build and evaluate production NLP systems with Python and PyTorch.', now() - interval '26 minutes', 'ACTIVE'),
  ('mock:morrow-applied-ai-munich', 'Applied AI Engineer', 'Morrow Intelligence', 'Munich', 'Germany', 'remote', 'full_time', 'Develop retrieval-augmented generation systems and measurable AI products.', now() - interval '1 hour', 'ACTIVE'),
  ('mock:aperture-junior-nlp-hamburg', 'Junior NLP Engineer', 'Aperture Cloud', 'Hamburg', 'Germany', 'onsite', 'full_time', 'Support transformer model development, evaluation, and data workflows.', now() - interval '2 hours', 'ACTIVE')
on conflict (canonical_fingerprint) do nothing;

