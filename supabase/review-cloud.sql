create extension if not exists pgcrypto with schema extensions;

create table if not exists public.review_workspaces (
  id text primary key,
  name text not null,
  access_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.review_posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.review_workspaces(id) on delete cascade,
  client_id text not null,
  platform text not null check (platform in ('xhs','douyin')),
  published_at date not null,
  title text not null check (char_length(title) between 1 and 120),
  source_topic text not null default '',
  content_format text not null default '',
  experiment_variable text not null default '',
  comment_insights text not null default '',
  impressions bigint not null default 0 check (impressions >= 0),
  views bigint not null default 0 check (views >= 0),
  completion numeric(6,2) not null default 0 check (completion between 0 and 100),
  hook5 numeric(6,2) not null default 0 check (hook5 between 0 and 100),
  likes bigint not null default 0 check (likes >= 0),
  comments bigint not null default 0 check (comments >= 0),
  saves bigint not null default 0 check (saves >= 0),
  shares bigint not null default 0 check (shares >= 0),
  follows bigint not null default 0 check (follows >= 0),
  avg_watch numeric(8,2) not null default 0 check (avg_watch >= 0),
  created_by text not null default '团队成员',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, client_id)
);

create index if not exists review_posts_workspace_date_idx
  on public.review_posts (workspace_id, published_at desc, created_at desc);

create or replace function public.set_review_post_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists review_posts_set_updated_at on public.review_posts;
create trigger review_posts_set_updated_at
  before update on public.review_posts
  for each row execute function public.set_review_post_updated_at();

create or replace function public.review_workspace_access(target_workspace text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.review_workspaces workspace
    where workspace.id = target_workspace
      and workspace.access_hash = extensions.crypt(
        coalesce((current_setting('request.headers', true)::jsonb ->> 'x-workspace-key'), ''),
        workspace.access_hash
      )
  );
$$;

revoke all on public.review_workspaces from public, anon, authenticated;
grant select, insert, update, delete on public.review_posts to anon, authenticated;
revoke execute on function public.review_workspace_access(text) from public;
grant execute on function public.review_workspace_access(text) to anon, authenticated;

alter table public.review_posts enable row level security;

drop policy if exists review_posts_team_select on public.review_posts;
create policy review_posts_team_select on public.review_posts
  for select to anon, authenticated
  using ((select public.review_workspace_access(workspace_id)));

drop policy if exists review_posts_team_insert on public.review_posts;
create policy review_posts_team_insert on public.review_posts
  for insert to anon, authenticated
  with check ((select public.review_workspace_access(workspace_id)));

drop policy if exists review_posts_team_update on public.review_posts;
create policy review_posts_team_update on public.review_posts
  for update to anon, authenticated
  using ((select public.review_workspace_access(workspace_id)))
  with check ((select public.review_workspace_access(workspace_id)));

drop policy if exists review_posts_team_delete on public.review_posts;
create policy review_posts_team_delete on public.review_posts
  for delete to anon, authenticated
  using ((select public.review_workspace_access(workspace_id)));

-- 首次运行时，把下面的“请替换团队密码”改成只分享给协作者的密码。
insert into public.review_workspaces (id, name, access_hash)
values ('wmq-team', 'wmq自媒体复盘团队', extensions.crypt('请替换团队密码', extensions.gen_salt('bf')))
on conflict (id) do nothing;
