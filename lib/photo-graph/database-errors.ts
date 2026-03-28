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

  return tableNames.some((tableName) => error.message.includes(tableName));
}
