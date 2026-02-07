-- Exam Portal Schema (Supabase / Postgres)
-- Includes status + audit fields

create extension if not exists "uuid-ossp";

-- Users profile (linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('student','staff','admin')),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  created_by uuid null,
  updated_at timestamptz null,
  updated_by uuid null
);

-- Session/Year (e.g. 2026, 2027)
create table if not exists public.sessions (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  created_by uuid null,
  updated_at timestamptz null,
  updated_by uuid null
);

-- Classes (e.g. 10th, B.Sc, etc.)
create table if not exists public.classes (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references public.sessions(id) on delete set null,
  name text not null,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  created_by uuid null,
  updated_at timestamptz null,
  updated_by uuid null,
  unique (session_id, name)
);

-- Exams
create table if not exists public.exams (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid references public.classes(id) on delete set null,
  exam_name text not null,
  exam_date timestamptz not null,
  is_upcoming boolean not null default true,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  created_by uuid null,
  updated_at timestamptz null,
  updated_by uuid null
);

-- Students (for self-registration)
create table if not exists public.students (
  id uuid primary key default uuid_generate_v4(),
  registration_no text not null unique,
  roll_no text not null unique,
  full_name text not null,
  father_name text null,
  mother_name text null,
  address text null,
  class_id uuid references public.classes(id) on delete set null,
  dob date null,
  mobile text null,
  email text null,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  created_by uuid null,
  updated_at timestamptz null,
  updated_by uuid null
);

-- Results
create table if not exists public.results (
  id uuid primary key default uuid_generate_v4(),
  exam_id uuid references public.exams(id) on delete cascade,
  roll_no text not null,
  registration_no text null,
  student_name text not null,
  dob date null,
  mobile text null,
  marks numeric(6,2) null,
  status_text text not null default 'pass' check (status_text in ('pass','fail','absent')),
  result_status text not null default 'published' check (result_status in ('draft','published')),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  created_by uuid null,
  updated_at timestamptz null,
  updated_by uuid null,
  unique (exam_id, roll_no)
);

-- Banners (store two images)
create table if not exists public.banners (
  id uuid primary key default uuid_generate_v4(),
  title text null,
  image_url text not null,
  order_no int not null default 1,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  created_by uuid null,
  updated_at timestamptz null,
  updated_by uuid null
);

-- Optional: store generated PDFs
create table if not exists public.files (
  id uuid primary key default uuid_generate_v4(),
  file_type text not null check (file_type in ('result_pdf','exam_pdf','result_excel')),
  file_url text not null,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  created_by uuid null
);

-- Indexes for search
create index if not exists results_roll_no_idx on public.results (roll_no);
create index if not exists results_registration_no_idx on public.results (registration_no);
create index if not exists results_exam_id_idx on public.results (exam_id);
create index if not exists exams_date_idx on public.exams (exam_date);

-- RLS
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.classes enable row level security;
alter table public.exams enable row level security;
alter table public.results enable row level security;
alter table public.banners enable row level security;
alter table public.files enable row level security;
alter table public.students enable row level security;

-- Policies (baseline: public read for public pages)
-- Public can read exams, banners, results (published only)
create policy "public_read_exams" on public.exams
  for select using (status = 'active');

create policy "public_read_classes" on public.classes
  for select using (status = 'active');

create policy "public_read_banners" on public.banners
  for select using (status = 'active');

create policy "public_read_results" on public.results
  for select using (result_status = 'published' and status = 'active');

create policy "public_read_students" on public.students
  for select using (status = 'active');

create policy "public_insert_students" on public.students
  for insert with check (true);

-- Authenticated users can read their own profile
create policy "read_own_profile" on public.profiles
  for select using (auth.uid() = id);

-- Admin/Staff write (placeholder: allow authenticated; tighten later)
create policy "staff_admin_write" on public.sessions
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "staff_admin_write_classes" on public.classes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "staff_admin_write_exams" on public.exams
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "staff_admin_write_results" on public.results
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "staff_admin_write_banners" on public.banners
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "staff_admin_write_files" on public.files
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "staff_admin_write_students" on public.students
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
