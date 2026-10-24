begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

-- Fixed fixtures are created as the migration/test owner; requests below run as real JWT roles.
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000101', 'authenticated', 'authenticated', 'rls-a@example.test', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000102', 'authenticated', 'authenticated', 'rls-b@example.test', '{}', now(), now());

insert into public.conversations (id, user_id, title) values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 'A conversation'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000102', 'B conversation');
insert into public.messages (id, conversation_id, user_id, role, content, request_id) values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 'user', 'Private A message', '00000000-0000-0000-0000-000000000401');
insert into public.wellbeing_records (id, user_id, record_type, data) values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000101', 'mood', '{"rating":4,"emotions":[],"stress":null,"note":"A private check-in","context":[]}'),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000102', 'mood', '{"rating":2,"emotions":[],"stress":null,"note":"B private check-in","context":[]}');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}', true);
set local role authenticated;

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'RLS is enabled for profiles');
select ok((select relrowsecurity from pg_class where oid = 'public.conversations'::regclass), 'RLS is enabled for conversations');
select ok((select relrowsecurity from pg_class where oid = 'public.messages'::regclass), 'RLS is enabled for messages');
select ok((select relrowsecurity from pg_class where oid = 'public.wellbeing_records'::regclass), 'RLS is enabled for wellbeing records');
select is((select count(*)::integer from public.profiles), 1, 'User A reads only their own profile');
select is((select count(*)::integer from public.conversations), 1, 'User A sees only their own conversation');
select is((select count(*)::integer from public.messages), 1, 'User A sees only messages in their conversation');
select is((select count(*)::integer from public.messages where conversation_id = '00000000-0000-0000-0000-000000000202'), 0, 'User A cannot read User B messages');
select is((select count(*)::integer from public.wellbeing_records), 1, 'User A reads only their own wellbeing record');
select lives_ok($$insert into public.wellbeing_records (user_id, record_type, data) values ('00000000-0000-0000-0000-000000000101', 'mood', '{"rating":3,"emotions":[],"stress":null,"note":"Another A check-in","context":[]}')$$, 'User A can save their own wellbeing record');
select is((select count(*)::integer from public.wellbeing_records), 2, 'User A sees their own saved records');
select is((with changed as (update public.wellbeing_records set data = '{"rating":5,"emotions":[],"stress":null,"note":"Corrected check-in","context":[]}' where id = '00000000-0000-0000-0000-000000000501' returning data->>'note') select count(*)::integer from changed), 1, 'User A can correct their own wellbeing record');
select throws_ok($$insert into public.wellbeing_records (user_id, record_type, data) values ('00000000-0000-0000-0000-000000000102', 'mood', '{"rating":1}')$$, '42501', null, 'User A cannot create a wellbeing record for User B');
select throws_ok(
  $$insert into public.messages (conversation_id, user_id, role, content, request_id) values ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000101', 'user', 'Cross-owner attempt', '00000000-0000-0000-0000-000000000402')$$,
  '42501', null, 'User A cannot attach a message to User B conversation'
);
select throws_ok(
  $$insert into public.messages (conversation_id, user_id, role, content, reply_to) values ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 'assistant', 'Forged reply', '00000000-0000-0000-0000-000000000301')$$,
  '42501', null, 'Authenticated clients cannot forge assistant messages'
);
select throws_ok(
  $$update public.conversations set user_id = '00000000-0000-0000-0000-000000000102' where id = '00000000-0000-0000-0000-000000000201'$$,
  '42501', null, 'User A cannot change conversation ownership'
);
select throws_ok(
  $$update public.messages set content = 'tampered' where id = '00000000-0000-0000-0000-000000000301'$$,
  '42501', null, 'Users cannot modify immutable chat messages'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000102","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::integer from public.conversations), 1, 'User B sees only their own conversation');
select is((select count(*)::integer from public.profiles), 1, 'User B reads only their own profile');
select is((select count(*)::integer from public.messages), 0, 'User B cannot read User A messages');
select is((select count(*)::integer from public.wellbeing_records), 1, 'User B reads only their own wellbeing record');
select is((with changed as (update public.wellbeing_records set data = '{"rating":1}' where id = '00000000-0000-0000-0000-000000000501' returning 1) select count(*)::integer from changed), 0, 'User B cannot update User A wellbeing record');
select is((with removed as (delete from public.wellbeing_records where id = '00000000-0000-0000-0000-000000000501' returning 1) select count(*)::integer from removed), 0, 'User B cannot delete User A wellbeing record');
select is((with removed as (delete from public.conversations where id = '00000000-0000-0000-0000-000000000201' returning 1) select count(*)::integer from removed), 0, 'User B cannot delete User A conversation');
select is((with removed as (delete from public.messages where id = '00000000-0000-0000-0000-000000000301' returning 1) select count(*)::integer from removed), 0, 'User B cannot delete User A message');
select throws_ok(
  $$insert into public.conversations (user_id, title) values ('00000000-0000-0000-0000-000000000101', 'Impersonation')$$,
  '42501', null, 'User B cannot create a conversation for User A'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$select * from public.messages$$, '42501', null, 'Anonymous users cannot query private messages');

select * from finish();
rollback;
