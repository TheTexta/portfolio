import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { Client } from "pg";

import {
  readDatabaseConnectionString,
  readRemoteServerConfig,
  type RemoteServerConfig,
} from "./database-config";

const SCHEMA_PATH = path.join(
  process.cwd(),
  "supabase",
  "photo-graph-schema.sql",
);

function resolveRemoteCommand() {
  const script = [
    "set -euo pipefail",
    "container=$(docker ps --format \"{{.Names}}\" | grep \"^supabase-db-\" | head -n 1)",
    "if [ -z \"$container\" ]; then echo \"Missing supabase-db container.\" >&2; exit 1; fi",
    "db_user=$(docker exec \"$container\" env | grep \"^POSTGRES_USER=\" | cut -d= -f2-)",
    "db_name=$(docker exec \"$container\" env | grep \"^POSTGRES_DB=\" | cut -d= -f2-)",
    "db_pass=$(docker exec \"$container\" env | grep \"^POSTGRES_PASSWORD=\" | cut -d= -f2-)",
    "docker exec -e PGPASSWORD=\"$db_pass\" -i \"$container\" psql -v ON_ERROR_STOP=1 -h localhost -U \"$db_user\" -d \"$db_name\"",
  ].join("; ");

  return `bash -lc '${script}'`;
}

function resolveRemoteSshInvocation(remoteServer: RemoteServerConfig) {
  const remoteCommand = resolveRemoteCommand();

  if (process.platform === "win32") {
    const args = ["-ssh", "-batch"];

    if (remoteServer.password) {
      args.push("-pw", remoteServer.password);
    }

    if (remoteServer.hostKey) {
      args.push("-hostkey", remoteServer.hostKey);
    }

    args.push(
      `${remoteServer.username}@${remoteServer.host}`,
      remoteCommand,
    );

    return {
      command: "plink.exe",
      args,
    };
  }

  return {
    command: "ssh",
    args: [
      "-o",
      "BatchMode=yes",
      `${remoteServer.username}@${remoteServer.host}`,
      remoteCommand,
    ],
  };
}

async function applySchemaDirect(sql: string) {
  const connectionString = readDatabaseConnectionString();
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
  } finally {
    await client.end();
  }
}

async function applySchemaOverSsh(sql: string, remoteServer: RemoteServerConfig) {
  const { command, args } = resolveRemoteSshInvocation(remoteServer);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) {
        if (stdout.trim()) {
          process.stdout.write(stdout);
        }
        resolve();
        return;
      }

      reject(
        new Error(
          `Remote schema apply failed for ${remoteServer.username}@${remoteServer.host}: ${stderr.trim() || stdout.trim() || `exit code ${code}`}`,
        ),
      );
    });

    child.stdin.end(sql);
  });
}

async function run() {
  loadEnvConfig(process.cwd());

  const sql = await readFile(SCHEMA_PATH, "utf-8");

  try {
    await applySchemaDirect(sql);
    console.log("Applied Supabase photo graph schema successfully.");
    return;
  } catch (error) {
    const remoteServer = readRemoteServerConfig();
    if (!remoteServer) {
      throw error;
    }
  }

  const remoteServer = readRemoteServerConfig();
  if (!remoteServer) {
    throw new Error("Missing remote server configuration.");
  }

  await applySchemaOverSsh(sql, remoteServer);
  console.log("Applied Supabase photo graph schema successfully over SSH.");
}

run().catch((error) => {
  console.error("Applying Supabase photo graph schema failed.");
  console.error(error);
  process.exit(1);
});
