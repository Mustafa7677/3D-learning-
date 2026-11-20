-- INSIDE TECH — learning analytics and authored lessons (PostgreSQL 16+).

-- The latest session of a learner in a lesson: what happened (events) and
-- the simulation journal (recording) for replay. One row per learner and lesson.
create table lesson_sessions (
  learner_id uuid not null references learners (id) on delete cascade,
  lesson_id  text not null check (lesson_id ~ '^[a-z0-9-]{1,64}$'),
  kind       text not null check (length(kind) between 1 and 32),
  events     jsonb not null default '[]'::jsonb,
  recording  jsonb,
  updated_at timestamptz not null,
  primary key (learner_id, lesson_id)
);

-- Lessons made in the Lesson Creator and saved on the server, so teachers can assign them.
create table authored_lessons (
  id         text primary key check (id ~ '^custom-[a-z0-9-]{1,56}$'),
  author_id  uuid not null references learners (id) on delete cascade,
  title      text not null check (length(title) between 1 and 120),
  spec       jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index authored_lessons_author_idx on authored_lessons (author_id);
