create extension if not exists pgcrypto;

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  client_name text not null check (length(btrim(client_name)) between 1 and 120),
  hashed_key varchar(64) not null unique check (hashed_key ~ '^[0-9a-f]{64}$'),
  key_prefix varchar(16) not null default 'devman_live_sk_'
    check (key_prefix = 'devman_live_sk_'),
  role_scope text not null check (role_scope in ('read_only', 'agent', 'admin')),
  rate_limit integer not null default 60 check (rate_limit between 1 and 10000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists api_keys_active_created_idx on public.api_keys (is_active, created_at desc);

create table if not exists public.api_key_rate_windows (
  api_key_id uuid not null references public.api_keys(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (api_key_id, window_start)
);

alter table public.api_keys enable row level security;
alter table public.api_key_rate_windows enable row level security;

revoke all on public.api_keys from anon, authenticated;
revoke all on public.api_key_rate_windows from anon, authenticated;

create or replace function public.consume_api_key_request(p_api_key_id uuid, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_window timestamptz := date_trunc('minute', now());
  current_count integer;
begin
  insert into public.api_key_rate_windows (api_key_id, window_start, request_count)
  values (p_api_key_id, current_window, 1)
  on conflict (api_key_id, window_start)
  do update set request_count = public.api_key_rate_windows.request_count + 1
  returning request_count into current_count;

  delete from public.api_key_rate_windows
  where window_start < now() - interval '2 days';

  return current_count <= greatest(1, least(p_limit, 10000));
end;
$$;

revoke all on function public.consume_api_key_request(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_api_key_request(uuid, integer) to service_role;

create or replace function public.set_api_keys_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger api_keys_updated_at
before update on public.api_keys
for each row execute function public.set_api_keys_updated_at();
