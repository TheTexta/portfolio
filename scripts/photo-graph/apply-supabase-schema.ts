import { readFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { Client } from "pg";

import { readDatabaseConnectionString } from "./database-config";

const SCHEMA_PATH = path.join(
  process.cwd(),
  "supabase",
  "photo-graph-schema.sql",
);

async function run() {
  loadEnvConfig(process.cwd());

  const connectionString = readDatabaseConnectionString();
  const sql = await readFile(SCHEMA_PATH, "utf-8");
  const client = new Client({
    connectionString,
    ssl:
      process.env.SUPABASE_DB_SSL === "disable"
        ? false
        : { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query(sql);
    console.log("Applied Supabase photo graph schema successfully.");
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error("Applying Supabase photo graph schema failed.");
  console.error(error);
  process.exit(1);
});
