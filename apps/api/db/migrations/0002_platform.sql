-- INSIDE TECH — accounts, classes, assignments, billing (PostgreSQL 16+).

alter table learners
  add column email text,
  add column name text,
  add column role text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  add column plan text not null default 'free' check (plan in ('free', 'premium', 'classroom'));

create table classes (
  id         uuid primary key,
  teacher_id uuid not null references learners (id) on delete cascade,
  name       text not null check (length(name) between 1 and 80),
  code       text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now()
);
create index classes_teacher_idx on classes (teacher_id);

create table class_members (
  class_id   uuid not null references classes (id) on delete cascade,
  learner_id uuid not null references learners (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (class_id, learner_id)
);
create index class_members_learner_idx on class_members (learner_id);

create table assignments (
  id         uuid primary key,
  class_id   uuid not null references classes (id) on delete cascade,
  lesson_id  text not null check (lesson_id ~ '^[a-z0-9-]{1,64}$'),
  due_at     timestamptz,
  created_at timestamptz not null default now()
);
create index assignments_class_idx on assignments (class_id);

-- Processed payment-provider events, so webhook retries are idempotent.
create table billing_events (
  id          text primary key,
  learner_id  uuid references learners (id) on delete set null,
  type        text not null,
  received_at timestamptz not null default now()
);
