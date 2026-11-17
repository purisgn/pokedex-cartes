-- Collections rattachées à un compte (e-mail + mot de passe) : chaque personne ne lit et n'écrit que la sienne.
create table if not exists public.user_collections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_collections enable row level security;

create policy "lire sa collection" on public.user_collections for select to authenticated using ((select auth.uid()) = user_id);
create policy "créer sa collection" on public.user_collections for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "modifier sa collection" on public.user_collections for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- La date d'enregistrement est toujours celle du serveur.
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger user_collections_touch before insert or update on public.user_collections
for each row execute function public.touch_updated_at();

grant select, insert, update on public.user_collections to authenticated;

-- L'ancien système à code est remplacé par les comptes.
drop function if exists public.get_collection(text);
drop function if exists public.save_collection(text, jsonb);
drop table if exists public.collections;
