insert into storage.buckets (id, name, public)
values ('dextery.dev', 'dextery.dev', true)
on conflict (id) do update
set public = excluded.public;

create table if not exists public.photo_graph_nodes (
  id bigint primary key,
  scale double precision not null,
  colour text not null,
  storage_path text,
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

create sequence if not exists public.photo_graph_node_id_seq;

select setval(
  'public.photo_graph_node_id_seq',
  greatest(coalesce((select max(id) from public.photo_graph_nodes), 0), 1),
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

revoke all on function public.reserve_photo_graph_node_ids(integer) from public;
revoke all on function public.replace_photo_graph_neighbor_snapshot(bigint[], jsonb, jsonb) from public;
grant execute on function public.reserve_photo_graph_node_ids(integer) to service_role;
grant execute on function public.replace_photo_graph_neighbor_snapshot(bigint[], jsonb, jsonb) to service_role;

alter table public.photo_graph_nodes enable row level security;
alter table public.photo_graph_edges enable row level security;
alter table public.photo_graph_neighbors enable row level security;
alter table public.photo_graph_settings enable row level security;

notify pgrst, 'reload schema';
