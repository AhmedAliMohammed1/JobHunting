alter table public.cv_documents
  add column if not exists extracted_text text,
  add column if not exists parse_error text;

comment on column public.cv_documents.extracted_text is 'Machine-readable CV text extracted by the authenticated parse-cv Edge Function; limited before downstream AI use.';
comment on column public.cv_documents.parse_error is 'Sanitized parser error shown to the owning user when parse_status is FAILED.';
