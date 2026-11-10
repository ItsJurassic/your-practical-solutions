-- Public site settings (holiday theme, etc.). Anyone may read; only store admins may write.
-- Admin check uses the existing private.is_kpi_admin() model (app_metadata role,
-- owner emails, and yps_chat_members owner/admin). No existing policies are changed.

create table if not exists public.site_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.site_settings is
  'Public site settings such as the live holiday theme. Readable by anyone; writable only by store admins.';

alter table public.site_settings enable row level security;

create policy site_settings_select_anyone
  on public.site_settings
  for select
  to anon, authenticated
  using (true);

create policy site_settings_insert_admin
  on public.site_settings
  for insert
  to authenticated
  with check (private.is_kpi_admin());

create policy site_settings_update_admin
  on public.site_settings
  for update
  to authenticated
  using (private.is_kpi_admin())
  with check (private.is_kpi_admin());

grant select on table public.site_settings to anon, authenticated;
grant insert, update on table public.site_settings to authenticated;

create or replace function private.touch_site_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if new.key = 'theme' and new.value not in (
    'default', 'christmas', 'halloween', 'valentines', 'new-years', 'fourth-of-july'
  ) then
    raise exception 'invalid theme' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch
  before insert or update on public.site_settings
  for each row execute function private.touch_site_settings();

insert into public.site_settings(key, value)
values ('theme', 'default')
on conflict (key) do nothing;

alter publication supabase_realtime add table public.site_settings;
