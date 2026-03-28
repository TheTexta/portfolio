import { imagePathForLegacyId } from "@/lib/photo-graph/config";
import {
  DEFAULT_PHOTO_GRAPH_EDGE_GENERATION_CONFIG,
  normalizePhotoGraphEdgeGenerationConfig,
} from "@/lib/photo-graph/edge-generation";
import type {
  GraphNode,
  PhotoGraphEdgeRow,
  PhotoGraphNodeRow,
  PhotoGraphEdgeGenerationConfig,
  PhotoGraphSettingRow,
} from "@/lib/photo-graph/types";
import { getServiceRoleSupabase } from "@/lib/server/supabase";
import {
  buildSupabaseStoragePublicUrl,
  getPhotoGraphStorageBucket,
} from "@/lib/supabase/config";

const PAGE_SIZE = 1_000;
const DEFAULT_EDGE_GENERATION_SETTING_KEY = "default_edge_generation";

type PhotoGraphNodeInsert = Omit<PhotoGraphNodeRow, "created_at">;
type PhotoGraphEdgeInsert = Omit<PhotoGraphEdgeRow, "created_at">;
type PhotoGraphSettingInsert = PhotoGraphSettingRow;

function compareNodeIds(leftId: string, rightId: string) {
  const leftNumber = Number(leftId);
  const rightNumber = Number(rightId);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }

  return leftId.localeCompare(rightId);
}

function assertNoSupabaseError<T extends { message?: string }>(
  error: T | null,
  message: string,
) {
  if (!error) {
    return;
  }

  throw new Error(`${message}: ${error.message ?? "Unknown Supabase error"}`);
}

function isMissingTableError(error: { message?: string } | null, tableName: string) {
  return Boolean(error?.message?.includes(tableName));
}

function toNodeId(value: number | string) {
  return String(value);
}

function normalizeStoragePath(node: GraphNode) {
  if (node.storagePath) {
    return node.storagePath;
  }

  if (node.url) {
    return null;
  }

  return imagePathForLegacyId(node.id);
}

function normalizeExternalUrl(node: GraphNode, storagePath: string | null) {
  if (!node.url) {
    return null;
  }

  if (storagePath && node.url === buildSupabaseStoragePublicUrl(storagePath)) {
    return null;
  }

  return node.url;
}

function toNodeRow(node: GraphNode): PhotoGraphNodeInsert {
  const dimensions = node.dimensions;
  const feature = node.feature;
  const storagePath = normalizeStoragePath(node);

  return {
    id: Number(node.id),
    scale: node.scale,
    colour: node.colour,
    storage_path: storagePath,
    external_url: normalizeExternalUrl(node, storagePath),
    feature_rgb_r: feature?.rgb[0] ?? null,
    feature_rgb_g: feature?.rgb[1] ?? null,
    feature_rgb_b: feature?.rgb[2] ?? null,
    feature_lab_l: feature?.lab[0] ?? null,
    feature_lab_a: feature?.lab[1] ?? null,
    feature_lab_b: feature?.lab[2] ?? null,
    feature_hue: feature?.hue ?? null,
    feature_long_side: feature?.longSide ?? null,
    image_width: dimensions?.width ?? null,
    image_height: dimensions?.height ?? null,
    image_aspect_ratio: dimensions?.aspectRatio ?? null,
    updated_at: new Date().toISOString(),
  };
}

function resolveNodeUrl(row: PhotoGraphNodeRow) {
  if (row.storage_path) {
    return buildSupabaseStoragePublicUrl(
      row.storage_path,
      getPhotoGraphStorageBucket(),
    );
  }

  if (row.external_url) {
    return row.external_url;
  }

  return undefined;
}

function mapNodeRow(row: PhotoGraphNodeRow): GraphNode {
  const hasFeature =
    row.feature_rgb_r !== null &&
    row.feature_rgb_g !== null &&
    row.feature_rgb_b !== null &&
    row.feature_lab_l !== null &&
    row.feature_lab_a !== null &&
    row.feature_lab_b !== null &&
    row.feature_hue !== null &&
    row.feature_long_side !== null;

  const hasDimensions =
    row.image_width !== null &&
    row.image_height !== null &&
    row.image_aspect_ratio !== null;
  const feature = hasFeature
    ? {
        rgb: [
          row.feature_rgb_r as number,
          row.feature_rgb_g as number,
          row.feature_rgb_b as number,
        ] as [number, number, number],
        lab: [
          row.feature_lab_l as number,
          row.feature_lab_a as number,
          row.feature_lab_b as number,
        ] as [number, number, number],
        hue: row.feature_hue as number,
        longSide: row.feature_long_side as number,
      }
    : undefined;
  const dimensions = hasDimensions
    ? {
        width: row.image_width as number,
        height: row.image_height as number,
        aspectRatio: row.image_aspect_ratio as number,
      }
    : undefined;

  return {
    id: toNodeId(row.id),
    scale: row.scale,
    colour: row.colour,
    correlations: {},
    storagePath: row.storage_path ?? undefined,
    url: resolveNodeUrl(row),
    feature,
    dimensions,
  };
}

function graphNodesToEdgeRows(nodes: GraphNode[]): PhotoGraphEdgeInsert[] {
  const edgeByKey = new Map<string, PhotoGraphEdgeInsert>();

  for (const node of nodes) {
    for (const [targetId, correlation] of Object.entries(node.correlations)) {
      if (!Number.isFinite(correlation) || correlation <= 0) {
        continue;
      }

      if (node.id === targetId) {
        continue;
      }

      const [leftId, rightId] =
        compareNodeIds(node.id, targetId) < 0
          ? [node.id, targetId]
          : [targetId, node.id];
      const key = `${leftId}:${rightId}`;
      const existing = edgeByKey.get(key);

      if (existing) {
        existing.correlation = Math.max(existing.correlation, correlation);
        continue;
      }

      edgeByKey.set(key, {
        left_node_id: Number(leftId),
        right_node_id: Number(rightId),
        correlation,
        updated_at: new Date().toISOString(),
      });
    }
  }

  return [...edgeByKey.values()].sort((left, right) => {
    if (left.left_node_id !== right.left_node_id) {
      return left.left_node_id - right.left_node_id;
    }

    return left.right_node_id - right.right_node_id;
  });
}

async function selectAllRows<T>(
  queryPage: (
    from: number,
    to: number,
  ) => Promise<{
    data: T[] | null;
    error: { message?: string } | null;
  }>,
) {
  const rows: T[] = [];
  let from = 0;

  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await queryPage(from, to);
    assertNoSupabaseError(error, "Failed to read photo graph rows");

    const page = data ?? [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      return rows;
    }

    from += PAGE_SIZE;
  }
}

async function upsertNodeRows(rows: PhotoGraphNodeInsert[]) {
  if (!rows.length) {
    return;
  }

  const supabase = getServiceRoleSupabase();

  for (let from = 0; from < rows.length; from += PAGE_SIZE) {
    const batch = rows.slice(from, from + PAGE_SIZE);
    const { error } = await supabase
      .from("photo_graph_nodes")
      .upsert(batch, { onConflict: "id" });

    assertNoSupabaseError(error, "Failed to upsert photo graph nodes");
  }
}

async function insertEdgeRows(rows: PhotoGraphEdgeInsert[]) {
  if (!rows.length) {
    return;
  }

  const supabase = getServiceRoleSupabase();

  for (let from = 0; from < rows.length; from += PAGE_SIZE) {
    const batch = rows.slice(from, from + PAGE_SIZE);
    const { error } = await supabase
      .from("photo_graph_edges")
      .upsert(batch, { onConflict: "left_node_id,right_node_id" });

    assertNoSupabaseError(error, "Failed to upsert photo graph edges");
  }
}

async function upsertSettingRows(rows: PhotoGraphSettingInsert[]) {
  if (!rows.length) {
    return;
  }

  const supabase = getServiceRoleSupabase();
  const { error } = await supabase
    .from("photo_graph_settings")
    .upsert(rows, { onConflict: "key" });

  assertNoSupabaseError(error, "Failed to upsert photo graph settings");
}

export async function loadPhotoGraphFromDatabase() {
  const supabase = getServiceRoleSupabase();
  const [nodeRows, edgeRows] = await Promise.all([
    selectAllRows<PhotoGraphNodeRow>(async (from, to) =>
      await supabase
        .from("photo_graph_nodes")
        .select("*")
        .order("id", { ascending: true })
        .range(from, to),
    ),
    selectAllRows<PhotoGraphEdgeRow>(async (from, to) =>
      await supabase
        .from("photo_graph_edges")
        .select("*")
        .order("left_node_id", { ascending: true })
        .order("right_node_id", { ascending: true })
        .range(from, to),
    ),
  ]);

  const nodes = nodeRows.map(mapNodeRow);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  for (const edge of edgeRows) {
    const leftId = toNodeId(edge.left_node_id);
    const rightId = toNodeId(edge.right_node_id);
    const left = nodeById.get(leftId);
    const right = nodeById.get(rightId);

    if (!left || !right) {
      continue;
    }

    left.correlations[rightId] = edge.correlation;
    right.correlations[leftId] = edge.correlation;
  }

  return nodes;
}

export async function upsertPhotoGraphNodes(nodes: GraphNode[]) {
  await upsertNodeRows(nodes.map(toNodeRow));
}

export async function loadPhotoGraphEdgeGenerationConfig() {
  const supabase = getServiceRoleSupabase();
  const { data, error } = await supabase
    .from("photo_graph_settings")
    .select("value")
    .eq("key", DEFAULT_EDGE_GENERATION_SETTING_KEY)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error, "photo_graph_settings")) {
      return DEFAULT_PHOTO_GRAPH_EDGE_GENERATION_CONFIG;
    }

    assertNoSupabaseError(error, "Failed to load photo graph edge defaults");
  }

  return normalizePhotoGraphEdgeGenerationConfig(data?.value);
}

export async function savePhotoGraphEdgeGenerationConfig(
  config: PhotoGraphEdgeGenerationConfig,
) {
  await upsertSettingRows([
    {
      key: DEFAULT_EDGE_GENERATION_SETTING_KEY,
      value: config,
      updated_at: new Date().toISOString(),
    },
  ]);
}

export async function replacePhotoGraphEdges(nodes: GraphNode[]) {
  const supabase = getServiceRoleSupabase();
  const { error } = await supabase
    .from("photo_graph_edges")
    .delete()
    .gte("left_node_id", 0);

  assertNoSupabaseError(error, "Failed to clear photo graph edges");
  await insertEdgeRows(graphNodesToEdgeRows(nodes));
}

export async function replacePhotoGraphGraph(nodes: GraphNode[]) {
  const supabase = getServiceRoleSupabase();

  const clearEdgesResult = await supabase
    .from("photo_graph_edges")
    .delete()
    .gte("left_node_id", 0);
  assertNoSupabaseError(
    clearEdgesResult.error,
    "Failed to clear photo graph edges",
  );

  const clearNodesResult = await supabase
    .from("photo_graph_nodes")
    .delete()
    .gte("id", 0);
  assertNoSupabaseError(
    clearNodesResult.error,
    "Failed to clear photo graph nodes",
  );

  await upsertNodeRows(nodes.map(toNodeRow));
  await insertEdgeRows(graphNodesToEdgeRows(nodes));
}

export async function deletePhotoGraphNodeRecord(nodeId: string) {
  const supabase = getServiceRoleSupabase();
  const parsedNodeId = Number(nodeId);
  const { error } = await supabase
    .from("photo_graph_nodes")
    .delete()
    .eq("id", parsedNodeId);

  assertNoSupabaseError(error, "Failed to delete photo graph node");
}
