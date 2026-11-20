-- INSIDE TECH — initial schema (PostgreSQL 16+).
-- Applied when the PostgreSQL ProgressRepository replaces the in-memory one.

create table learners (
  id           uuid primary key,
  -- Null for anonymous learners; set once OAuth/OIDC sign-in links an identity.
  auth_subject text unique,
  created_at   timestamptz not null default now()
);

create table lesson_progress (
  learner_id   uuid        not null references learners (id) on delete cascade,
  lesson_id    text        not null check (lesson_id ~ '^[a-z0-9-]{1,64}$'),
  step_index   integer     not null check (step_index >= 0),
  completed    jsonb       not null default '{}'::jsonb,
  started_at   timestamptz not null,
  updated_at   timestamptz not null,
  completed_at timestamptz,
  primary key (learner_id, lesson_id)
);

-- Replays of simulation sessions (sim-core Recording), for teacher review and analytics.
create table session_recordings (
  id             uuid primary key,
  learner_id     uuid        not null references learners (id) on delete cascade,
  lesson_id      text        not null,
  plugin_id      text        not null,
  plugin_version text        not null,
  seed           bigint      not null,
  recording      jsonb       not null,
  created_at     timestamptz not null default now()
);

create index session_recordings_learner_lesson_idx on session_recordings (learner_id, lesson_id, created_at desc);
