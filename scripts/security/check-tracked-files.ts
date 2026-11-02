import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const temporaryPath = /(?:^|\/)\.tmp(?:\/|$)/i;
const environmentPath = /(?:^|\/)(?:\.env[^/]*|[^/]+\.env(?:\.[^/]*)?)$/i;

export function findUnsafeTrackedFiles(paths: readonly string[]) {
  return paths.filter(
    (path) => temporaryPath.test(path) || environmentPath.test(path),
  );
}

function checkTrackedFiles() {
  let paths: string[];
  try {
    paths = execFileSync("git", ["ls-files", "-z"], {
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
      .split("\0")
      .filter(Boolean);
  } catch {
    console.error("Repository safety check could not inspect the Git index.");
    process.exitCode = 1;
    return;
  }

  const unsafePaths = findUnsafeTrackedFiles(paths);
  if (unsafePaths.length) {
    console.error("Temporary or environment files must not be tracked:");
    for (const path of unsafePaths) console.error(`- ${JSON.stringify(path)}`);
    console.error(
      "Remove them from the Git index; preserve needed local copies.",
    );
    process.exitCode = 1;
    return;
  }

  console.log("Repository safety check passed (tracked file paths only).");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  checkTrackedFiles();
}
