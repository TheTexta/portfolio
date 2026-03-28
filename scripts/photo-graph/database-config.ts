type DatabaseSocket = {
  host: string;
  port: number;
};

export type RemoteServerConfig = {
  host: string;
  username: string;
  password?: string;
  hostKey?: string;
};

function parseHostAndPort(value: string): DatabaseSocket {
  const [host, rawPort] = value.split(":");
  const port = rawPort ? Number(rawPort) : 5432;

  if (!host) {
    throw new Error("Database host is missing.");
  }

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("Database port is invalid.");
  }

  return {
    host,
    port,
  };
}

function readDirectDatabaseValue() {
  return (
    process.env.SUPABASE_DB_URL ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL
  );
}

export function readDatabaseConnectionString() {
  const directValue = readDirectDatabaseValue();

  if (directValue) {
    if (
      directValue.startsWith("postgres://") ||
      directValue.startsWith("postgresql://")
    ) {
      return directValue;
    }

    const user = process.env.SUPABASE_DB_USER;
    const password = process.env.SUPABASE_DB_PASSWORD;
    const database = process.env.SUPABASE_DB_NAME ?? "postgres";

    if (!user || !password) {
      throw new Error(
        "SUPABASE_DB_URL is not a full Postgres connection string. Set SUPABASE_DB_USER and SUPABASE_DB_PASSWORD, or provide a full postgres:// URL.",
      );
    }

    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${directValue}/${encodeURIComponent(database)}`;
  }

  throw new Error(
    "Missing required database connection details. Set SUPABASE_DB_URL, or DATABASE_URL / POSTGRES_URL, or provide SUPABASE_DB_URL with SUPABASE_DB_USER and SUPABASE_DB_PASSWORD.",
  );
}

export function readDatabaseSocket() {
  const directValue = readDirectDatabaseValue();

  if (!directValue) {
    return null;
  }

  if (
    directValue.startsWith("postgres://") ||
    directValue.startsWith("postgresql://")
  ) {
    const url = new URL(directValue);
    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : 5432,
    };
  }

  return parseHostAndPort(directValue);
}

export function readRemoteServerConfig() {
  const host = process.env.SERVER_LOCAL_IP?.trim();
  const username = process.env.SERVER_USERNAME?.trim();

  if (!host || !username) {
    return null;
  }

  return {
    host,
    username,
    password: process.env.SERVER_PASSWORD,
    hostKey: process.env.SERVER_SSH_HOSTKEY,
  } satisfies RemoteServerConfig;
}
