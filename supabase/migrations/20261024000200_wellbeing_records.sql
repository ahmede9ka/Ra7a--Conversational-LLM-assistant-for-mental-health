-- User-owned wellbeing records. Keep user-authored content in one RLS-protected table;
-- application validation enforces a separate typed shape for each record type.
create table public.wellbeing_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_type text not null check (record_type in ('mood', 'reflection', 'activity', 'exercise', 'weekly_reflection')),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index wellbeing_records_owner_type_created_idx
  on public.wellbeing_records(user_id, record_type, created_at desc);

alter table public.wellbeing_records enable row level security;
revoke all on public.wellbeing_records from anon, authenticated;
grant select, insert, update, delete on public.wellbeing_records to authenticated;

create policy "Users read their own wellbeing records" on public.wellbeing_records
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create their own wellbeing records" on public.wellbeing_records
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their own wellbeing records" on public.wellbeing_records
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete their own wellbeing records" on public.wellbeing_records
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger wellbeing_records_touch_updated_at before update on public.wellbeing_records
  for each row execute function private.touch_updated_at();
