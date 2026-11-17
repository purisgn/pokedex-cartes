-- Collections synchronisées, rangées sous l'empreinte SHA-256 d'un code secret propre à chaque collectionneur.
-- La table n'est jamais exposée : on n'y accède que par les deux fonctions, en fournissant le code.
create table if not exists public.collections (
  code_hash text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.collections enable row level security;
revoke all on public.collections from anon, authenticated;

create or replace function public.get_collection(code text) returns jsonb
language sql security definer set search_path = public, extensions as $$
  select jsonb_build_object('data', data, 'updated_at', updated_at)
  from collections
  where length(code) >= 20 and code_hash = encode(digest(code, 'sha256'), 'hex')
$$;

create or replace function public.save_collection(code text, payload jsonb) returns timestamptz
language plpgsql security definer set search_path = public, extensions as $$
declare t timestamptz;
begin
  if length(code) < 20 then raise exception 'code trop court'; end if;
  if pg_column_size(payload) > 1000000 then raise exception 'collection trop grande'; end if;
  insert into collections (code_hash, data, updated_at)
  values (encode(digest(code, 'sha256'), 'hex'), payload, now())
  on conflict (code_hash) do update set data = excluded.data, updated_at = now()
  returning updated_at into t;
  return t;
end $$;

revoke all on function public.get_collection(text), public.save_collection(text, jsonb) from public;
grant execute on function public.get_collection(text), public.save_collection(text, jsonb) to anon, authenticated;
