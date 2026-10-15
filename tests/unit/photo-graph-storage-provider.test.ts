import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const migration = new URL(
  "../../supabase/migrations/20261015000937_photo_graph_storage_provider.sql",
  import.meta.url,
);

describe("Photo Graph provider migration", () => {
  it("keeps existing paths as Supabase and restricts new R2 keys", async () => {
    const db = new PGlite();
    try {
      await db.exec(`create role anon;
      create role authenticated;
      create role service_role;
      create table public.photo_graph_uploads (
        id uuid primary key, admin_id uuid not null, payload jsonb not null,
        node_ids bigint[] not null, result jsonb
      );
      create table public.photo_graph_nodes (
        id bigint primary key, scale double precision not null,
        colour text not null, storage_path text
      );
      insert into public.photo_graph_nodes (id, scale, colour, storage_path)
      values (1, 1, '#808080', 'photography-images/1.png');`);

      const sql = await readFile(migration, "utf8");
      await db.exec(sql);
      await db.exec(sql); // Re-applying this additive migration must be safe.
      const nodes = await db.query<{
        id: number;
        storage_path: string;
        storage_provider: string;
      }>(
        "select id, storage_path, storage_provider from public.photo_graph_nodes order by id",
      );
      expect(nodes.rows).toEqual([
        {
          id: 1,
          storage_path: "photography-images/1.png",
          storage_provider: "supabase",
        },
      ]);

      await db.exec(`insert into public.photo_graph_nodes
        (id, scale, colour, storage_path, storage_provider)
        values (2, 1, '#808080', 'photography-images/2.webp', 'r2');`);
      for (const [path, provider] of [
        ["photography-images/_pending/a.png", "r2"],
        ["photography-images/3.html", "r2"],
        [null, "r2"],
        ["photography-images/3.png", "unexpected"],
      ]) {
        await expect(
          db.query(
            `insert into public.photo_graph_nodes
             (id, scale, colour, storage_path, storage_provider)
             values (3, 1, '#808080', $1, $2)`,
            [path, provider],
          ),
        ).rejects.toThrow();
      }

      const queued = await db.query<{ id: number }>(
        "select public.queue_photo_graph_r2_deletion(2) id",
      );
      const job = await db.query<{
        node_id: number;
        storage_provider: string;
        storage_path: string;
      }>(
        "select node_id, storage_provider, storage_path from public.photo_graph_media_cleanup_jobs where id = $1",
        [queued.rows[0].id],
      );
      expect(job.rows).toEqual([
        {
          node_id: 2,
          storage_provider: "r2",
          storage_path: "photography-images/2.webp",
        },
      ]);
      expect(
        (await db.query("select id from public.photo_graph_nodes where id = 2"))
          .rows,
      ).toEqual([]);
      expect(
        (
          await db.query<{ storage_provider: string }>(
            "select storage_provider from public.photo_graph_nodes where id = 1",
          )
        ).rows[0].storage_provider,
      ).toBe("supabase");
      for (const role of ["anon", "authenticated"]) {
        const grants = await db.query<{
          table_access: boolean;
          rpc_access: boolean;
        }>(
          "select has_table_privilege($1, 'public.photo_graph_media_cleanup_jobs', 'SELECT') table_access, has_function_privilege($1, 'public.queue_photo_graph_r2_deletion(bigint)', 'EXECUTE') rpc_access",
          [role],
        );
        expect(grants.rows[0]).toEqual({
          table_access: false,
          rpc_access: false,
        });
      }
    } finally {
      await db.close();
    }
  });
});
