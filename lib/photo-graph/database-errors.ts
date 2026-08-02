export function isRecoverablePhotoGraphDatabaseError(
  error: unknown,
  tableNames: string[] = [],
) {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.message.includes("Missing required Supabase env var")) {
    return true;
  }

  if (
    error.message.includes("Invalid authentication credentials") ||
    error.message.includes("fetch failed")
  ) {
    return true;
  }

  return tableNames.some((tableName) => error.message.includes(tableName));
}
