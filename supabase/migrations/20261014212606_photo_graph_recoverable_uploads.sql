-- Additive upload recovery only; existing graph rows and Storage objects are untouched.
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
      jsonb_build_object('created_at', now(), 'updated_at', now()) || item) populated
  on conflict (id) do update set
    scale = excluded.scale,
    updated_at = excluded.updated_at;

  edge_count := public.replace_photo_graph_neighbor_snapshot(source_ids, neighbor_rows, generation_config);
  final_result := upload_result || jsonb_build_object('edgeCount', edge_count);
  update public.photo_graph_uploads set result = final_result where id = upload_id;
  return final_result;
end;
$$;

revoke all on function public.begin_photo_graph_upload(uuid, uuid, jsonb, bigint) from public;
revoke all on function public.photo_graph_upload_revision() from public;
revoke all on function public.commit_photo_graph_upload(uuid, text, jsonb, bigint[], jsonb, jsonb, jsonb) from public;
grant execute on function public.begin_photo_graph_upload(uuid, uuid, jsonb, bigint) to service_role;
grant execute on function public.photo_graph_upload_revision() to service_role;
grant execute on function public.commit_photo_graph_upload(uuid, text, jsonb, bigint[], jsonb, jsonb, jsonb) to service_role;
notify pgrst, 'reload schema';
