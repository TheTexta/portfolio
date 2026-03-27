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
  image_width integer,
  image_height integer,
  image_aspect_ratio double precision,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

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

alter table public.photo_graph_nodes enable row level security;
alter table public.photo_graph_edges enable row level security;
