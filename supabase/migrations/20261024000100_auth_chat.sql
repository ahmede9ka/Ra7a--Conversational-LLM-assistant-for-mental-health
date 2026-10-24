-- Private account data, constrained chat history, and server-only chat operations.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation' check (char_length(title) between 1 and 120),
  active_request_id uuid,
  active_request_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check ((active_request_id is null) = (active_request_at is null))
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 4000),
  request_id uuid,
  reply_to uuid,
  created_at timestamptz not null default now(),
  foreign key (conversation_id, user_id) references public.conversations(id, user_id) on delete cascade,
  unique (id, conversation_id, user_id),
  foreign key (reply_to, conversation_id, user_id) references public.messages(id, conversation_id, user_id) on delete cascade,
  check (
    (role = 'user' and request_id is not null and reply_to is null)
    or (role = 'assistant' and request_id is null and reply_to is not null)
  )
);

create unique index messages_user_request_id_idx on public.messages(user_id, request_id) where request_id is not null;
create unique index messages_one_reply_per_user_turn_idx on public.messages(reply_to) where reply_to is not null;
create index conversations_owner_updated_idx on public.conversations(user_id, updated_at desc);
create index messages_conversation_created_idx on public.messages(conversation_id, created_at desc);
create index messages_owner_created_idx on public.messages(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

revoke all on public.profiles, public.conversations, public.messages from anon, authenticated;
grant select, update (display_name) on public.profiles to authenticated;
grant select, insert, update (title), delete on public.conversations to authenticated;
grant select, insert, delete on public.messages to authenticated;

create policy "Users read their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Users update their own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Users read their own conversations" on public.conversations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create their own conversations" on public.conversations
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users rename their own conversations" on public.conversations
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete their own conversations" on public.conversations
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read messages in their conversations" on public.messages
  for select to authenticated using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );
create policy "Users insert only their own user messages" on public.messages
  for insert to authenticated with check (
    role = 'user'
    and request_id is not null
    and reply_to is null
    and (select auth.uid()) = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );
create policy "Users delete messages in their conversations" on public.messages
  for delete to authenticated using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );

create or replace function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.create_profile_for_new_user() from public, anon, authenticated;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function private.create_profile_for_new_user();

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;
create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger conversations_touch_updated_at before update on public.conversations
  for each row execute function private.touch_updated_at();

create or replace function private.touch_conversation_after_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id and user_id = new.user_id;
  return new;
end;
$$;
revoke all on function private.touch_conversation_after_message() from public, anon, authenticated;
create trigger messages_touch_conversation_updated_at after insert on public.messages
  for each row execute function private.touch_conversation_after_message();

-- Only one chat turn at a time per conversation; stale claims expire after two minutes.
create or replace function public.claim_conversation_turn(p_conversation_id uuid, p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then return false; end if;
  update public.conversations
  set active_request_id = p_request_id, active_request_at = now()
  where id = p_conversation_id and user_id = auth.uid()
    and (active_request_id is null or active_request_at < now() - interval '2 minutes');
  return found;
end;
$$;
revoke all on function public.claim_conversation_turn(uuid, uuid) from public, anon;
grant execute on function public.claim_conversation_turn(uuid, uuid) to authenticated;

create or replace function public.release_conversation_turn(p_conversation_id uuid, p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then return; end if;
  update public.conversations
  set active_request_id = null, active_request_at = null
  where id = p_conversation_id and user_id = auth.uid() and active_request_id = p_request_id;
end;
$$;
revoke all on function public.release_conversation_turn(uuid, uuid) from public, anon;
grant execute on function public.release_conversation_turn(uuid, uuid) to authenticated;

-- Fixed per-account quota; no client-controlled limit or window arguments.
create table private.chat_rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index chat_rate_limit_events_owner_created_idx on private.chat_rate_limit_events(user_id, created_at desc);
alter table private.chat_rate_limit_events enable row level security;
revoke all on private.chat_rate_limit_events from public, anon, authenticated;

create or replace function public.consume_chat_rate_limit()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 90421));
  delete from private.chat_rate_limit_events
  where user_id = v_user_id and created_at < now() - interval '2 hours';
  select count(*) into v_count from private.chat_rate_limit_events
  where user_id = v_user_id and created_at >= now() - interval '1 hour';
  if v_count >= 20 then return false; end if;
  insert into private.chat_rate_limit_events(user_id) values (v_user_id);
  return true;
end;
$$;
revoke all on function public.consume_chat_rate_limit() from public, anon;
grant execute on function public.consume_chat_rate_limit() to authenticated;

-- The service-role operation is deliberately narrow: authenticated clients cannot forge assistant turns.
create or replace function public.persist_assistant_reply(
  p_conversation_id uuid,
  p_user_id uuid,
  p_request_id uuid,
  p_content text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_message_id uuid;
  v_reply_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_content, ''))) not between 1 and 4000 then
    raise exception 'invalid reply';
  end if;
  if not exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id and c.user_id = p_user_id and c.active_request_id = p_request_id
  ) then
    raise exception 'conversation ownership or request claim check failed' using errcode = '42501';
  end if;
  select m.id into v_user_message_id from public.messages m
  where m.conversation_id = p_conversation_id and m.user_id = p_user_id
    and m.role = 'user' and m.request_id = p_request_id;
  if v_user_message_id is null then raise exception 'user turn not found'; end if;

  insert into public.messages (conversation_id, user_id, role, content, reply_to)
  values (p_conversation_id, p_user_id, 'assistant', btrim(p_content), v_user_message_id)
  on conflict (reply_to) where reply_to is not null do nothing
  returning id into v_reply_id;

  if v_reply_id is null then
    select m.id into v_reply_id from public.messages m where m.reply_to = v_user_message_id;
  end if;
  return v_reply_id;
end;
$$;
revoke all on function public.persist_assistant_reply(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.persist_assistant_reply(uuid, uuid, uuid, text) to service_role;
