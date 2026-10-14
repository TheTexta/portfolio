-- This instance grants function execution to browser roles by default.
-- Explicit revokes are required in addition to revoking PUBLIC.
revoke all on function public.begin_photo_graph_upload(uuid, uuid, jsonb, bigint) from public, anon, authenticated;
revoke all on function public.photo_graph_upload_revision() from public, anon, authenticated;
revoke all on function public.commit_photo_graph_upload(uuid, text, jsonb, bigint[], jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.reserve_photo_graph_node_ids(integer) from public, anon, authenticated;
revoke all on function public.replace_photo_graph_neighbor_snapshot(bigint[], jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.begin_photo_graph_upload(uuid, uuid, jsonb, bigint) to service_role;
grant execute on function public.photo_graph_upload_revision() to service_role;
grant execute on function public.commit_photo_graph_upload(uuid, text, jsonb, bigint[], jsonb, jsonb, jsonb) to service_role;
grant execute on function public.reserve_photo_graph_node_ids(integer) to service_role;
grant execute on function public.replace_photo_graph_neighbor_snapshot(bigint[], jsonb, jsonb) to service_role;
notify pgrst, 'reload schema';
