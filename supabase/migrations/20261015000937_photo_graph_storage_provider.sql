-- Additive provider identity; existing node IDs, paths and Supabase objects stay intact.
alter table public.photo_graph_nodes
  add column if not exists storage_provider text not null default 'supabase';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.photo_graph_nodes'::regclass
      and conname = 'photo_graph_nodes_storage_provider_check'
  ) then
    alter table public.photo_graph_nodes
      add constraint photo_graph_nodes_storage_provider_check
      check (storage_provider in ('supabase', 'r2'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.photo_graph_nodes'::regclass
      and conname = 'photo_graph_nodes_r2_path_check'
  ) then
    alter table public.photo_graph_nodes
      add constraint photo_graph_nodes_r2_path_check
      check (
        storage_provider <> 'r2'
        or (storage_path is not null and storage_path ~ '^photography-images/[0-9]+[.](png|jpg|webp)$')
      );
  end if;
end;
$$;

-- jsonb_populate_record(null::photo_graph_nodes, ...) supplies every physical
-- column explicitly, so a table DEFAULT does not fill legacy node_rows JSON.
-- Preserve the existing RPC transaction and access policy while giving old
-- payloads their original Supabase meaning. New R2 rows set the field in JSON.
create or replace function public.commit_photo_graph_upload(
  upload_id uuid, expected_revision text, node_rows jsonb,
  source_ids bigint[], neighbor_rows jsonb, generation_config jsonb,
  upload_result jsonb
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  existing public.photo_graph_uploads;
  edge_count integer;
  final_result jsonb;
begin
  select * into existing from public.photo_graph_uploads where id = upload_id for update;
  if not found then raise exception 'Upload reservation not found'; end if;
  if existing.result is not null then return existing.result; end if;
  lock table public.photo_graph_nodes, public.photo_graph_edges,
    public.photo_graph_neighbors, public.photo_graph_settings in share row exclusive mode;
  if public.photo_graph_upload_revision() <> expected_revision then
    raise exception 'Photo graph changed; retry registration' using errcode = '40001';
  end if;

  insert into public.photo_graph_nodes
  select populated.* from jsonb_array_elements(node_rows) item,
    lateral jsonb_populate_record(null::public.photo_graph_nodes,
      jsonb_build_object('created_at', now(), 'updated_at', now(), 'storage_provider', 'supabase') || item) populated
  on conflict (id) do update set
    scale = excluded.scale,
    updated_at = excluded.updated_at;

  edge_count := public.replace_photo_graph_neighbor_snapshot(source_ids, neighbor_rows, generation_config);
  final_result := upload_result || jsonb_build_object('edgeCount', edge_count);
  update public.photo_graph_uploads set result = final_result where id = upload_id;
  return final_result;
end;
$$;

revoke all on function public.commit_photo_graph_upload(uuid, text, jsonb, bigint[], jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.commit_photo_graph_upload(uuid, text, jsonb, bigint[], jsonb, jsonb, jsonb)
  to service_role;

-- A queued provider-qualified cleanup target survives a post-delete R2 failure.
create table if not exists public.photo_graph_media_cleanup_jobs (
  id bigint generated always as identity primary key,
  node_id bigint not null,
  storage_provider text not null check (storage_provider = 'r2'),
  storage_path text not null check (storage_path ~ '^photography-images/[0-9]+[.](png|jpg|webp)$'),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (node_id, storage_provider, storage_path)
);
alter table public.photo_graph_media_cleanup_jobs enable row level security;
revoke all on table public.photo_graph_media_cleanup_jobs from public, anon, authenticated;
grant select, insert, update, delete on table public.photo_graph_media_cleanup_jobs to service_role;
create index if not exists photo_graph_media_cleanup_pending_idx
  on public.photo_graph_media_cleanup_jobs (id) where completed_at is null;

create or replace function public.queue_photo_graph_r2_deletion(p_node_id bigint)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  source_path text;
  provider text;
  job_id bigint;
begin
  select storage_path, storage_provider into source_path, provider
    from public.photo_graph_nodes where id = p_node_id for update;
  if not found or provider <> 'r2' or source_path is null then
    raise exception 'R2 Photo Graph node not found';
  end if;
  insert into public.photo_graph_media_cleanup_jobs (node_id, storage_provider, storage_path)
    values (p_node_id, provider, source_path) returning id into job_id;
  delete from public.photo_graph_nodes where id = p_node_id;
  return job_id;
end;
$$;
revoke all on function public.queue_photo_graph_r2_deletion(bigint) from public, anon, authenticated;
grant execute on function public.queue_photo_graph_r2_deletion(bigint) to service_role;

notify pgrst, 'reload schema';
