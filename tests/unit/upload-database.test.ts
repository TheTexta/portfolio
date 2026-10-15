import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PGlite();
const uploadId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const adminId = "11111111-1111-4111-8111-111111111111";
const payload = [{ storagePath: "photography-images/_pending/a.png" }];
let nodeId: number;

beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
    create schema storage; create table storage.buckets (id text primary key, name text, public boolean);`);
  await db.exec(
    await readFile(
      new URL("../../supabase/photo-graph-schema.sql", import.meta.url),
      "utf8",
    ),
  );
  const reservation = await begin();
  nodeId = reservation.nodeIds[0];
});
afterAll(async () => {
  await db.close();
});

async function begin(value = payload, actor = adminId) {
  const { rows } = await db.query<{
    result: { nodeIds: number[]; result: unknown };
  }>("select public.begin_photo_graph_upload($1, $2, $3::jsonb, 60) result", [
    uploadId,
    actor,
    JSON.stringify(value),
  ]);
  return rows[0].result;
}
async function revision() {
  return (
    await db.query<{ revision: string }>(
      "select public.photo_graph_upload_revision() revision",
    )
  ).rows[0].revision;
}
async function commit(expected: string, neighbors: unknown[] = []) {
  return db.query<{ result: { createdIds: string[]; edgeCount: number } }>(
    "select public.commit_photo_graph_upload($1,$2,$3::jsonb,$4::bigint[],$5::jsonb,$6::jsonb,$7::jsonb) result",
    [
      uploadId,
      expected,
      JSON.stringify([
        {
          id: nodeId,
          scale: 1,
          colour: "#808080",
          storage_path: `${nodeId}.png`,
          updated_at: new Date().toISOString(),
        },
      ]),
      [nodeId],
      JSON.stringify(neighbors),
      JSON.stringify({
        model: "mean-lab-cie76",
        neighborsPerNode: 2,
        maxDistance: 1,
      }),
      JSON.stringify({ ok: true, createdIds: [String(nodeId)], nodeCount: 1 }),
    ],
  );
}

describe.sequential("atomic upload registration", () => {
  it("reserves stable IDs and rejects key reuse with different data or admins", async () => {
    expect(nodeId).toBeGreaterThan(60);
    expect((await begin()).nodeIds).toEqual([nodeId]);
    await expect(begin([{ storagePath: "other.png" }])).rejects.toThrow(
      /another request/,
    );
    await expect(
      begin(payload, "22222222-2222-4222-8222-222222222222"),
    ).rejects.toThrow(/another request/);
  });
  it("rolls back nodes and journal completion if neighbor persistence fails", async () => {
    await expect(
      commit(await revision(), [
        {
          source_node_id: nodeId,
          target_node_id: 999,
          model: "mean-lab-cie76",
          feature_version: 1,
          distance: 0.1,
          correlation: 0.9,
          rank: 1,
        },
      ]),
    ).rejects.toThrow(/foreign key/);
    expect((await db.query("select * from photo_graph_nodes")).rows).toEqual(
      [],
    );
    expect((await begin()).result).toBeNull();
  });
  it("rejects a stale generation without persisting any nodes", async () => {
    const before = await revision();
    await db.exec(
      "insert into photo_graph_settings (key,value) values ('default_edge_generation','{}')",
    );
    await expect(commit(before)).rejects.toThrow(/changed/);
    expect((await db.query("select * from photo_graph_nodes")).rows).toEqual(
      [],
    );
  });
  it("commits once and returns the same result after a lost response", async () => {
    const first = (await commit(await revision())).rows[0].result;
    expect(first.createdIds).toEqual([String(nodeId)]);
    expect(
      (await commit("stale-but-already-committed")).rows[0].result,
    ).toEqual(first);
    expect((await begin()).result).toEqual(first);
    expect(
      (await db.query("select * from photo_graph_nodes")).rows,
    ).toHaveLength(1);
  });
  it("does not grant browser roles access to the journal or privileged RPCs", async () => {
    for (const role of ["anon", "authenticated"]) {
      const result = await db.query<{
        table_access: boolean;
        rpc_access: boolean;
      }>(
        "select has_table_privilege($1, 'public.photo_graph_uploads', 'SELECT') table_access, has_function_privilege($1, 'public.begin_photo_graph_upload(uuid,uuid,jsonb,bigint)', 'EXECUTE') rpc_access",
        [role],
      );
      expect(result.rows[0]).toEqual({
        table_access: false,
        rpc_access: false,
      });
      for (const signature of [
        "public.photo_graph_upload_revision()",
        "public.commit_photo_graph_upload(uuid,text,jsonb,bigint[],jsonb,jsonb,jsonb)",
        "public.reserve_photo_graph_node_ids(integer)",
        "public.replace_photo_graph_neighbor_snapshot(bigint[],jsonb,jsonb)",
      ]) {
        const permissions = await db.query<{ allowed: boolean }>(
          "select has_function_privilege($1,$2,'EXECUTE') allowed",
          [role, signature],
        );
        expect(permissions.rows[0].allowed).toBe(false);
      }
    }
  });
  it("replays the deployed migrations without changing graph data", async () => {
    const before = await revision();
    for (const file of [
      "20261014212606_photo_graph_recoverable_uploads.sql",
      "20261014212629_restrict_photo_graph_upload_rpc_permissions.sql",
      "20261015000937_photo_graph_storage_provider.sql",
    ]) {
      await db.exec(
        await readFile(
          new URL(`../../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    }
    expect(await revision()).toBe(before);
    const permission = await db.query<{ allowed: boolean }>(
      "select has_function_privilege('anon','public.begin_photo_graph_upload(uuid,uuid,jsonb,bigint)','EXECUTE') allowed",
    );
    expect(permission.rows[0].allowed).toBe(false);
  });
  it("persists nodes, directed neighbors, merged edges and defaults together", async () => {
    const secondId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const reserved = await db.query<{ result: { nodeIds: number[] } }>(
      "select begin_photo_graph_upload($1,$2,$3::jsonb,60) result",
      [
        secondId,
        adminId,
        JSON.stringify([{ storagePath: "another-pending.png" }]),
      ],
    );
    const addedId = reserved.rows[0].result.nodeIds[0];
    const neighbors = [
      {
        source_node_id: nodeId,
        target_node_id: addedId,
        model: "mean-lab-cie76",
        feature_version: 1,
        distance: 0.1,
        correlation: 0.9,
        rank: 1,
      },
      {
        source_node_id: addedId,
        target_node_id: nodeId,
        model: "mean-lab-cie76",
        feature_version: 1,
        distance: 0.1,
        correlation: 0.9,
        rank: 1,
      },
    ];
    await db.query(
      "select commit_photo_graph_upload($1,$2,$3::jsonb,$4::bigint[],$5::jsonb,$6::jsonb,$7::jsonb)",
      [
        secondId,
        await revision(),
        JSON.stringify([{ id: addedId, scale: 1, colour: "#808080" }]),
        [nodeId, addedId],
        JSON.stringify(neighbors),
        JSON.stringify({ model: "mean-lab-cie76" }),
        JSON.stringify({ ok: true, createdIds: [String(addedId)] }),
      ],
    );
    expect(
      (await db.query("select * from photo_graph_nodes")).rows,
    ).toHaveLength(2);
    expect(
      (await db.query("select * from photo_graph_neighbors")).rows,
    ).toHaveLength(2);
    expect(
      (await db.query("select * from photo_graph_edges")).rows,
    ).toHaveLength(1);
    const config = await db.query<{ value: unknown }>(
      "select value from photo_graph_settings where key = 'default_edge_generation'",
    );
    expect(config.rows[0].value).toEqual({ model: "mean-lab-cie76" });
  });
  it("keeps the explicit R2 provider in a committed upload without changing legacy nodes", async () => {
    const thirdId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const r2Payload = [
      {
        storagePath: "staging/private.png",
        storageProvider: "r2",
      },
    ];
    const reserved = await db.query<{ result: { nodeIds: number[] } }>(
      "select begin_photo_graph_upload($1,$2,$3::jsonb,60) result",
      [thirdId, adminId, JSON.stringify(r2Payload)],
    );
    const id = reserved.rows[0].result.nodeIds[0];
    await db.query(
      "select commit_photo_graph_upload($1,$2,$3::jsonb,$4::bigint[],$5::jsonb,$6::jsonb,$7::jsonb)",
      [
        thirdId,
        await revision(),
        JSON.stringify([
          {
            id,
            scale: 1,
            colour: "#808080",
            storage_path: `photography-images/${id}.png`,
            storage_provider: "r2",
          },
        ]),
        [id],
        JSON.stringify([]),
        JSON.stringify({
          model: "mean-lab-cie76",
          neighborsPerNode: 2,
          maxDistance: 1,
        }),
        JSON.stringify({ ok: true, createdIds: [String(id)], nodeCount: 3 }),
      ],
    );
    const nodes = await db.query<{ id: number; storage_provider: string }>(
      "select id, storage_provider from public.photo_graph_nodes order by id",
    );
    expect(nodes.rows.find((node) => node.id === id)?.storage_provider).toBe(
      "r2",
    );
    expect(
      nodes.rows
        .filter((node) => node.id !== id)
        .every((node) => node.storage_provider === "supabase"),
    ).toBe(true);
  });
});
