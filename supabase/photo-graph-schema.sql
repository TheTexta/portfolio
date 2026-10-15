insert into storage.buckets (id, name, public)
values ('dextery.dev', 'dextery.dev', true)
on conflict (id) do update
set public = excluded.public;

create table if not exists public.photo_graph_nodes (
  id bigint primary key,
  scale double precision not null,
  colour text not null,
  storage_path text,
  storage_provider text not null default 'supabase',
  external_url text,
  feature_rgb_r double precision,
  feature_rgb_g double precision,
  feature_rgb_b double precision,
  feature_lab_l double precision,
  feature_lab_a double precision,
  feature_lab_b double precision,
  feature_hue double precision,
  feature_long_side integer,
  feature_color_v1 jsonb,
  image_width integer,
  image_height integer,
  image_aspect_ratio double precision,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.photo_graph_nodes
  add column if not exists feature_color_v1 jsonb;

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

create sequence if not exists public.photo_graph_node_id_seq;

select setval(
  'public.photo_graph_node_id_seq',
  greatest(
    coalesce((select max(id) from public.photo_graph_nodes), 0),
    (select last_value from public.photo_graph_node_id_seq),
    1
  ),
  true
);

alter table public.photo_graph_nodes
  alter column id set default nextval('public.photo_graph_node_id_seq');

alter sequence public.photo_graph_node_id_seq
  owned by public.photo_graph_nodes.id;

create table if not exists public.photo_graph_edges (
  left_node_id bigint not null references public.photo_graph_nodes(id) on delete cascade,
  right_node_id bigint not null references public.photo_graph_nodes(id) on delete cascade,
  correlation double precision not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (left_node_id, right_node_id),
  constraint photo_graph_edges_order_check check (left_node_id < right_node_id),
  constraint photo_graph_edges_correlation_check check (
    correlation >= 0 and correlation <= 1
  )
);

create index if not exists photo_graph_edges_right_node_id_idx
  on public.photo_graph_edges (right_node_id);

create table if not exists public.photo_graph_neighbors (
  source_node_id bigint not null references public.photo_graph_nodes(id) on delete cascade,
  target_node_id bigint not null references public.photo_graph_nodes(id) on delete cascade,
  model text not null,
  feature_version integer not null,
  distance double precision not null,
  correlation double precision not null,
  rank integer not null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (source_node_id, target_node_id, model, feature_version),
  constraint photo_graph_neighbors_distinct_check check (source_node_id <> target_node_id),
  constraint photo_graph_neighbors_distance_check check (distance >= 0),
  constraint photo_graph_neighbors_correlation_check check (
    correlation >= 0 and correlation <= 1
  ),
  constraint photo_graph_neighbors_rank_check check (rank > 0),
  unique (source_node_id, model, feature_version, rank)
);

create index if not exists photo_graph_neighbors_target_node_id_idx
  on public.photo_graph_neighbors (target_node_id);

create table if not exists public.photo_graph_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.reserve_photo_graph_node_ids(requested_count integer)
returns bigint[]
language plpgsql
security definer
set search_path = public
as $$
declare
  reserved_ids bigint[];
begin
  if requested_count < 1 or requested_count > 100 then
    raise exception 'requested_count must be between 1 and 100';
  end if;

  select array_agg(nextval('public.photo_graph_node_id_seq'))
  into reserved_ids
  from generate_series(1, requested_count);

  return reserved_ids;
end;
$$;

create or replace function public.replace_photo_graph_neighbor_snapshot(
  source_ids bigint[],
  neighbor_rows jsonb,
  generation_config jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  edge_count integer;
begin
  delete from public.photo_graph_neighbors
  where source_node_id = any(source_ids);

  insert into public.photo_graph_neighbors (
    source_node_id,
    target_node_id,
    model,
    feature_version,
    distance,
    correlation,
    rank,
    updated_at
  )
  select
    row.source_node_id,
    row.target_node_id,
    row.model,
    row.feature_version,
    row.distance,
    row.correlation,
    row.rank,
    timezone('utc', now())
  from jsonb_to_recordset(coalesce(neighbor_rows, '[]'::jsonb)) as row(
    source_node_id bigint,
    target_node_id bigint,
    model text,
    feature_version integer,
    distance double precision,
    correlation double precision,
    rank integer
  )
  where row.source_node_id = any(source_ids);

  delete from public.photo_graph_edges
  where left_node_id >= 0;

  insert into public.photo_graph_edges (
    left_node_id,
    right_node_id,
    correlation,
    updated_at
  )
  select
    least(source_node_id, target_node_id),
    greatest(source_node_id, target_node_id),
    max(correlation),
    timezone('utc', now())
  from public.photo_graph_neighbors
  group by
    least(source_node_id, target_node_id),
    greatest(source_node_id, target_node_id);

  get diagnostics edge_count = row_count;

  insert into public.photo_graph_settings (key, value, updated_at)
  values ('default_edge_generation', generation_config, timezone('utc', now()))
  on conflict (key) do update
  set value = excluded.value, updated_at = excluded.updated_at;

  return edge_count;
end;
$$;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on table public.photo_graph_nodes to postgres, anon, authenticated, service_role;
grant all on table public.photo_graph_edges to postgres, anon, authenticated, service_role;
grant all on table public.photo_graph_neighbors to postgres, anon, authenticated, service_role;
grant all on table public.photo_graph_settings to postgres, anon, authenticated, service_role;
grant usage, select on sequence public.photo_graph_node_id_seq to service_role;

revoke all on function public.reserve_photo_graph_node_ids(integer) from public, anon, authenticated;
revoke all on function public.replace_photo_graph_neighbor_snapshot(bigint[], jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.reserve_photo_graph_node_ids(integer) to service_role;
grant execute on function public.replace_photo_graph_neighbor_snapshot(bigint[], jsonb, jsonb) to service_role;

alter table public.photo_graph_nodes enable row level security;
alter table public.photo_graph_edges enable row level security;
alter table public.photo_graph_neighbors enable row level security;
alter table public.photo_graph_settings enable row level security;

-- Durable reservations survive Storage failures and ambiguous HTTP responses.
create table if not exists public.photo_graph_uploads (
  id uuid primary key,
  admin_id uuid not null,
  payload jsonb not null,
  node_ids bigint[] not null,
  result jsonb,
  created_at timestamptz not null default now()
);
alter table public.photo_graph_uploads enable row level security;
revoke all on table public.photo_graph_uploads from public, anon, authenticated;
grant all on table public.photo_graph_uploads to service_role;

create or replace function public.begin_photo_graph_upload(
  upload_id uuid, admin_id uuid, upload_payload jsonb, id_floor bigint
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  existing public.photo_graph_uploads;
  reserved_ids bigint[];
  upload_count integer;
begin
  lock table public.photo_graph_uploads in share row exclusive mode;
  select * into existing from public.photo_graph_uploads where id = upload_id;
  if found then
    if existing.admin_id <> begin_photo_graph_upload.admin_id or existing.payload <> upload_payload then
      raise exception 'Upload key already belongs to another request';
    end if;
    return jsonb_build_object('nodeIds', existing.node_ids, 'result', existing.result);
  end if;
  upload_count := jsonb_array_length(upload_payload);
  if upload_count < 1 or upload_count > 100 then
    raise exception 'Upload count must be between 1 and 100';
  end if;
  perform setval('public.photo_graph_node_id_seq', greatest(
    (select last_value from public.photo_graph_node_id_seq), id_floor, 1
  ), true);
  reserved_ids := public.reserve_photo_graph_node_ids(upload_count);
  insert into public.photo_graph_uploads (id, admin_id, payload, node_ids)
  values (upload_id, admin_id, upload_payload, reserved_ids);
  return jsonb_build_object('nodeIds', reserved_ids, 'result', null);
end;
$$;

-- Capture before loading/generating a graph; reject a stale generation at commit.
create or replace function public.photo_graph_upload_revision()
returns text
language sql security definer set search_path = public
as $$
  select md5(concat(
    (select jsonb_agg(to_jsonb(n) order by id)::text from public.photo_graph_nodes n),
    (select jsonb_agg(to_jsonb(e) order by left_node_id, right_node_id)::text from public.photo_graph_edges e),
    (select jsonb_agg(to_jsonb(n) order by source_node_id, target_node_id, model, feature_version)::text from public.photo_graph_neighbors n),
    (select value::text from public.photo_graph_settings where key = 'default_edge_generation')
  ));
$$;

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

revoke all on function public.begin_photo_graph_upload(uuid, uuid, jsonb, bigint) from public, anon, authenticated;
revoke all on function public.photo_graph_upload_revision() from public, anon, authenticated;
revoke all on function public.commit_photo_graph_upload(uuid, text, jsonb, bigint[], jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.begin_photo_graph_upload(uuid, uuid, jsonb, bigint) to service_role;
grant execute on function public.photo_graph_upload_revision() to service_role;
grant execute on function public.commit_photo_graph_upload(uuid, text, jsonb, bigint[], jsonb, jsonb, jsonb) to service_role;

-- Preserve an R2 deletion target in the same transaction that removes its node.
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
