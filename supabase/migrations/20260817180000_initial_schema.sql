begin;

create extension if not exists pgcrypto;
create extension if not exists vector with schema extensions;

create type public.job_freshness_status as enum ('ACTIVE', 'LIKELY_ACTIVE', 'EXPIRED', 'REMOVED', 'UNKNOWN');
create type public.application_state as enum (
  'DISCOVERED', 'MATCHED', 'ELIGIBLE', 'QUEUED', 'ANALYZING', 'PREPARING',
  'WAITING_FOR_USER', 'READY', 'SUBMITTING', 'SUBMITTED', 'CONFIRMED',
  'FAILED', 'BLOCKED', 'CAPTCHA_REQUIRED', 'OTP_REQUIRED', 'LOGIN_REQUIRED',
  'UNSUPPORTED', 'EXPIRED'
);
create type public.application_risk as enum ('LOW', 'MEDIUM', 'HIGH');

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  onboarding_completed_at timestamptz,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.candidate_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  current_title text,
  location text,
  summary text,
  skills jsonb not null default '[]',
  programming_languages text[] not null default '{}',
  frameworks text[] not null default '{}',
  tools text[] not null default '{}',
  certifications text[] not null default '{}',
  languages jsonb not null default '[]',
  years_experience numeric(5,2),
  preferred_roles text[] not null default '{}',
  preferred_countries text[] not null default '{}',
  preferred_locations text[] not null default '{}',
  employment_types text[] not null default '{}',
  workplace_types text[] not null default '{}',
  manual_fields text[] not null default '{}',
  source_cv_document_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.candidate_embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_profile_id uuid not null references public.candidate_profiles(id) on delete cascade,
  content_hash text not null,
  embedding extensions.vector(1536) not null,
  model text not null,
  created_at timestamptz not null default now(),
  unique (candidate_profile_id, content_hash, model)
);

create table public.cv_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null check (mime_type in ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  sha256 text not null,
  parse_status text not null default 'PENDING' check (parse_status in ('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED')),
  parsed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sha256)
);

alter table public.candidate_profiles
  add constraint candidate_profiles_source_cv_fk
  foreign key (source_cv_document_id) references public.cv_documents(id) on delete set null;

create table public.cv_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cv_document_id uuid not null references public.cv_documents(id) on delete cascade,
  name text not null,
  target_roles text[] not null default '{}',
  is_default boolean not null default false,
  tailoring_rules jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create unique index cv_versions_one_default_idx on public.cv_versions(user_id) where is_default;

create table public.education_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  institution text not null,
  degree text,
  field text,
  location text,
  start_date date,
  end_date date,
  grade text,
  description text,
  source text not null default 'user' check (source in ('user', 'cv')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employment_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  position text not null,
  location text,
  start_date date,
  end_date date,
  responsibilities text[] not null default '{}',
  technologies text[] not null default '{}',
  achievements text[] not null default '{}',
  source text not null default 'user' check (source in ('user', 'cv')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.application_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  preferred_name text,
  email text,
  phone text,
  address jsonb not null default '{}',
  links jsonb not null default '{}',
  work_authorization jsonb not null default '{}',
  visa_sponsorship jsonb not null default '{}',
  relocation_preference text,
  availability text,
  notice_period text,
  salary_expectation jsonb not null default '{}',
  voluntary_sensitive_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.application_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  normalized_question text not null,
  answer text not null,
  category text not null,
  sensitive boolean not null default false,
  approved_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_question)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  canonical_fingerprint text not null unique,
  title text not null check (length(trim(title)) > 0),
  company text not null check (length(trim(company)) > 0),
  company_logo_url text,
  location text,
  country text,
  workplace_type text not null default 'unknown' check (workplace_type in ('remote', 'hybrid', 'onsite', 'unknown')),
  employment_type text,
  seniority text,
  salary_min numeric,
  salary_max numeric,
  salary_currency char(3),
  salary_text text,
  description text,
  description_fingerprint text,
  posted_at timestamptz,
  first_discovered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_verified_at timestamptz,
  status public.job_freshness_status not null default 'UNKNOWN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (salary_min is null or salary_min >= 0),
  check (salary_max is null or salary_max >= 0),
  check (salary_min is null or salary_max is null or salary_max >= salary_min)
);

create table public.job_sources (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  provider text not null,
  external_id text,
  source_url text not null,
  application_url text,
  source_type text not null,
  source_delay_hours integer,
  last_seen_at timestamptz not null default now(),
  last_verified_at timestamptz,
  raw_checksum text,
  created_at timestamptz not null default now(),
  unique (provider, source_url)
);

create table public.job_skills (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  skill text not null,
  requirement_level text not null default 'unknown' check (requirement_level in ('required', 'preferred', 'unknown')),
  created_at timestamptz not null default now(),
  unique (job_id, skill)
);

create table public.job_embeddings (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  content_hash text not null,
  embedding extensions.vector(1536) not null,
  model text not null,
  created_at timestamptz not null default now(),
  unique (job_id, content_hash, model)
);

create table public.saved_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  priority smallint not null default 0 check (priority between 0 and 3),
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create table public.hidden_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  query jsonb not null,
  enabled boolean not null default true,
  schedule text not null default 'daily' check (schedule in ('immediate', 'hourly', 'daily')),
  minimum_match_score smallint not null default 75 check (minimum_match_score between 0 and 100),
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query jsonb not null,
  expanded_terms text[] not null default '{}',
  provider_count smallint not null default 0,
  result_count integer not null default 0,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create table public.search_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_id uuid not null references public.notifications(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  notification_type text not null,
  dedupe_key text not null,
  channel text not null check (channel in ('in-app', 'email')),
  status text not null check (status in ('pending', 'sent', 'failed', 'skipped')),
  provider_reference text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key, channel)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete restrict,
  cv_version_id uuid references public.cv_versions(id) on delete set null,
  state public.application_state not null default 'DISCOVERED',
  stage text not null default 'Planning' check (stage in ('Saved', 'Planning', 'Applying', 'Applied', 'Assessment', 'Interview', 'Offer', 'Rejected', 'Withdrawn')),
  mode text not null default 'manual' check (mode in ('manual', 'assisted', 'auto')),
  risk public.application_risk not null default 'LOW',
  application_url text,
  external_application_id text,
  idempotency_key text not null,
  confirmation_status text check (confirmation_status in ('SUBMITTED_CONFIRMED', 'SUBMITTED_UNVERIFIED', 'FAILED')),
  confirmation_reference text,
  applied_at timestamptz,
  interview_details jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  unique (user_id, job_id)
);

create table public.application_fields (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  label text not null,
  field_type text not null,
  required boolean not null default false,
  value_encrypted text,
  answer_source text check (answer_source in ('user-profile', 'cv', 'saved-answer', 'generated', 'user-entered')),
  confidence numeric(4,3) check (confidence is null or confidence between 0 and 1),
  sensitive boolean not null default false,
  unknown boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.application_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  event_type text not null,
  source text not null,
  from_state public.application_state,
  to_state public.application_state,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.application_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  storage_path text not null,
  document_type text not null,
  retention_until timestamptz,
  created_at timestamptz not null default now()
);

create table public.automation_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  simulation_completed_at timestamptz,
  paused_at timestamptz,
  minimum_match smallint not null default 85 check (minimum_match between 0 and 100),
  roles text[] not null default '{}',
  countries text[] not null default '{}',
  locations text[] not null default '{}',
  employment_types text[] not null default '{}',
  workplace_types text[] not null default '{}',
  company_whitelist text[] not null default '{}',
  company_blacklist text[] not null default '{}',
  daily_limit smallint not null default 10 check (daily_limit between 1 and 25),
  weekly_limit smallint not null default 50 check (weekly_limit between 1 and 100),
  company_daily_limit smallint not null default 2 check (company_daily_limit between 1 and 5),
  maximum_job_age_hours integer not null default 72 check (maximum_job_age_hours between 1 and 720),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (enabled = false or simulation_completed_at is not null)
);

create table public.automation_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.applications(id) on delete cascade,
  task_type text not null,
  status text not null check (status in ('queued', 'running', 'waiting', 'completed', 'failed', 'cancelled')),
  idempotency_key text not null unique,
  payload jsonb not null default '{}',
  attempts smallint not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.claim_automation_task()
returns setof public.automation_tasks
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidate as (
    select id
    from public.automation_tasks
    where status = 'queued' and available_at <= now()
    order by available_at, created_at
    for update skip locked
    limit 1
  )
  update public.automation_tasks as task
  set status = 'running', locked_at = now(), attempts = attempts + 1, updated_at = now()
  from candidate
  where task.id = candidate.id
  returning task.*;
end;
$$;

revoke all on function public.claim_automation_task() from public, anon, authenticated;
grant execute on function public.claim_automation_task() to service_role;

create table public.provider_health (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  environment text not null,
  ok boolean not null,
  latency_ms integer,
  jobs_returned integer,
  error_code text,
  rate_limited boolean not null default false,
  checked_at timestamptz not null default now(),
  unique (provider, environment, checked_at)
);

create table public.recommendation_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  signal text not null check (signal in ('interested', 'not_interested', 'saved', 'applied', 'too_senior', 'wrong_location', 'wrong_role', 'wrong_technology', 'useful', 'not_useful')),
  created_at timestamptz not null default now(),
  unique (user_id, job_id, signal)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  safe_metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index jobs_search_idx on public.jobs using gin (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(company, '') || ' ' || coalesce(location, '') || ' ' || coalesce(description, '')));
create index jobs_title_idx on public.jobs (lower(title));
create index jobs_company_idx on public.jobs (lower(company));
create index jobs_country_idx on public.jobs (country);
create index jobs_location_idx on public.jobs (location);
create index jobs_posted_at_idx on public.jobs (posted_at desc);
create index jobs_first_discovered_idx on public.jobs (first_discovered_at desc);
create index jobs_status_idx on public.jobs (status);
create index job_sources_provider_idx on public.job_sources (provider, last_seen_at desc);
create index candidate_embeddings_vector_idx on public.candidate_embeddings using hnsw (embedding extensions.vector_cosine_ops);
create index job_embeddings_vector_idx on public.job_embeddings using hnsw (embedding extensions.vector_cosine_ops);
create index applications_user_stage_idx on public.applications (user_id, stage, updated_at desc);
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;
create index automation_tasks_claim_idx on public.automation_tasks (status, available_at) where status = 'queued';
create index search_cache_expiry_idx on public.search_cache (expires_at);

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger candidate_profiles_updated_at before update on public.candidate_profiles for each row execute function public.set_updated_at();
create trigger cv_documents_updated_at before update on public.cv_documents for each row execute function public.set_updated_at();
create trigger cv_versions_updated_at before update on public.cv_versions for each row execute function public.set_updated_at();
create trigger education_entries_updated_at before update on public.education_entries for each row execute function public.set_updated_at();
create trigger employment_entries_updated_at before update on public.employment_entries for each row execute function public.set_updated_at();
create trigger application_data_updated_at before update on public.application_data for each row execute function public.set_updated_at();
create trigger application_answers_updated_at before update on public.application_answers for each row execute function public.set_updated_at();
create trigger jobs_updated_at before update on public.jobs for each row execute function public.set_updated_at();
create trigger saved_jobs_updated_at before update on public.saved_jobs for each row execute function public.set_updated_at();
create trigger saved_searches_updated_at before update on public.saved_searches for each row execute function public.set_updated_at();
create trigger applications_updated_at before update on public.applications for each row execute function public.set_updated_at();
create trigger application_fields_updated_at before update on public.application_fields for each row execute function public.set_updated_at();
create trigger automation_settings_updated_at before update on public.automation_settings for each row execute function public.set_updated_at();
create trigger automation_tasks_updated_at before update on public.automation_tasks for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  insert into public.candidate_profiles (user_id) values (new.id);
  insert into public.automation_settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.candidate_profiles enable row level security;
alter table public.candidate_embeddings enable row level security;
alter table public.cv_documents enable row level security;
alter table public.cv_versions enable row level security;
alter table public.education_entries enable row level security;
alter table public.employment_entries enable row level security;
alter table public.application_data enable row level security;
alter table public.application_answers enable row level security;
alter table public.jobs enable row level security;
alter table public.job_sources enable row level security;
alter table public.job_skills enable row level security;
alter table public.job_embeddings enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.hidden_jobs enable row level security;
alter table public.saved_searches enable row level security;
alter table public.search_history enable row level security;
alter table public.search_cache enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.applications enable row level security;
alter table public.application_fields enable row level security;
alter table public.application_events enable row level security;
alter table public.application_documents enable row level security;
alter table public.automation_settings enable row level security;
alter table public.automation_tasks enable row level security;
alter table public.provider_health enable row level security;
alter table public.recommendation_feedback enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_owner on public.profiles for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy candidate_profiles_owner on public.candidate_profiles for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy candidate_embeddings_owner on public.candidate_embeddings for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cv_documents_owner on public.cv_documents for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cv_versions_owner on public.cv_versions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy education_entries_owner on public.education_entries for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy employment_entries_owner on public.employment_entries for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy application_data_owner on public.application_data for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy application_answers_owner on public.application_answers for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy saved_jobs_owner on public.saved_jobs for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy hidden_jobs_owner on public.hidden_jobs for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy saved_searches_owner on public.saved_searches for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy search_history_owner on public.search_history for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_owner on public.notifications for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notification_deliveries_owner on public.notification_deliveries for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy applications_owner on public.applications for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy application_fields_owner on public.application_fields for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy application_events_owner on public.application_events for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy application_documents_owner on public.application_documents for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy automation_settings_owner on public.automation_settings for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy automation_tasks_owner on public.automation_tasks for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy recommendation_feedback_owner on public.recommendation_feedback for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy audit_logs_owner_select on public.audit_logs for select to authenticated using (user_id = (select auth.uid()));

create policy jobs_authenticated_read on public.jobs for select to authenticated using (true);
create policy job_sources_authenticated_read on public.job_sources for select to authenticated using (true);
create policy job_skills_authenticated_read on public.job_skills for select to authenticated using (true);
create policy job_embeddings_authenticated_read on public.job_embeddings for select to authenticated using (true);
create policy provider_health_authenticated_read on public.provider_health for select to authenticated using (true);

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant execute on function public.set_updated_at() to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('cvs', 'cvs', false, 10485760, array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('application-artifacts', 'application-artifacts', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy storage_insert_own_folder on storage.objects for insert to authenticated
  with check (bucket_id in ('cvs', 'application-artifacts') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy storage_select_own_folder on storage.objects for select to authenticated
  using (bucket_id in ('cvs', 'application-artifacts') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy storage_update_own_folder on storage.objects for update to authenticated
  using (bucket_id in ('cvs', 'application-artifacts') and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('cvs', 'application-artifacts') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy storage_delete_own_folder on storage.objects for delete to authenticated
  using (bucket_id in ('cvs', 'application-artifacts') and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
