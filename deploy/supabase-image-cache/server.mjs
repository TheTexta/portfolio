import { createHash, randomUUID } from "node:crypto";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { fileURLToPath } from "node:url";

const PORT = Number.parseInt(process.env.PORT ?? "8080", 10);
const SUPABASE_KONG_UPSTREAM =
  process.env.SUPABASE_KONG_UPSTREAM ?? "http://kong:8000";
const REDIS_URL = process.env.SUPABASE_IMAGE_CACHE_REDIS_URL;

if (!REDIS_URL) {
  throw new Error("Missing SUPABASE_IMAGE_CACHE_REDIS_URL");
}

const redisConfig = parseRedisUrl(REDIS_URL);
const CACHE_KEY_PREFIX = "supabase-image-cache:v1";
const LOCK_TTL_MS = 30_000;
const LOCK_WAIT_MS = 10_000;
const LOCK_RETRY_MS = 250;
const STALE_WINDOW_SECONDS = 60 * 60 * 12;
const UPSTREAM_TIMEOUT_MS = 30_000;
const CACHE_STATUS_HEADER = "X-Image-Cache-Status";
const CACHED_HEADER_NAMES = [
  "access-control-allow-origin",
  "cache-control",
  "content-disposition",
  "content-type",
  "etag",
  "last-modified",
  "vary",
];
const CACHEABLE_STATUS_CODES = new Set([200]);
const HEALTH_PATH = "/healthz";
const CACHE_ROUTE_PREFIX = "/storage/v1/render/image/public/";

function parseRedisUrl(value) {
  const parsed = new URL(value);

  if (!["redis:", "rediss:"].includes(parsed.protocol)) {
    throw new Error(
      "SUPABASE_IMAGE_CACHE_REDIS_URL must use redis:// or rediss://",
    );
  }

  const database =
    parsed.pathname && parsed.pathname !== "/"
      ? Number.parseInt(parsed.pathname.slice(1), 10)
      : 0;

  if (!Number.isInteger(database) || database < 0) {
    throw new Error("SUPABASE_IMAGE_CACHE_REDIS_URL has an invalid database");
  }

  return {
    tls: parsed.protocol === "rediss:",
    host: parsed.hostname,
    port: parsed.port ? Number.parseInt(parsed.port, 10) : 6379,
    username: decodeURIComponent(parsed.username || "default"),
    password: decodeURIComponent(parsed.password || ""),
    database,
  };
}

function parseAcceptBucket(acceptHeader) {
  const normalized = (acceptHeader ?? "").toLowerCase();

  if (normalized.includes("image/avif")) {
    return "avif";
  }

  if (normalized.includes("image/webp")) {
    return "webp";
  }

  return "default";
}

function buildCacheKey(requestUrl, acceptHeader) {
  const bucket = parseAcceptBucket(acceptHeader);
  const hash = createHash("sha256")
    .update(`${bucket}:${requestUrl}`)
    .digest("hex");

  return {
    bucket,
    redisKey: `${CACHE_KEY_PREFIX}:entry:${hash}`,
    lockKey: `${CACHE_KEY_PREFIX}:lock:${hash}`,
  };
}

function parseCacheControlMaxAge(headerValue) {
  if (!headerValue) {
    return null;
  }

  const match = headerValue.match(/(?:^|,)\s*max-age=(\d+)/i);
  if (!match) {
    return null;
  }

  const seconds = Number.parseInt(match[1], 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function pickHeaders(headers) {
  const selected = {};

  for (const name of CACHED_HEADER_NAMES) {
    const value = headers[name];
    if (!value) {
      continue;
    }

    if (Array.isArray(value)) {
      selected[name] = value.join(", ");
      continue;
    }

    selected[name] = value;
  }

  return selected;
}

function serializeCacheEntry(entry) {
  const metaBuffer = Buffer.from(JSON.stringify(entry.meta), "utf8");
  const header = Buffer.allocUnsafe(4);
  header.writeUInt32BE(metaBuffer.length, 0);
  return Buffer.concat([header, metaBuffer, entry.body]);
}

function deserializeCacheEntry(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    throw new Error("Cached entry is truncated");
  }

  const metaLength = buffer.readUInt32BE(0);
  const metaEnd = 4 + metaLength;

  if (buffer.length < metaEnd) {
    throw new Error("Cached entry metadata is truncated");
  }

  const meta = JSON.parse(buffer.subarray(4, metaEnd).toString("utf8"));
  return {
    meta,
    body: buffer.subarray(metaEnd),
  };
}

function isCacheRoute(pathname) {
  return pathname.startsWith(CACHE_ROUTE_PREFIX);
}

function createRedisSocket() {
  if (redisConfig.tls) {
    return tls.connect({
      host: redisConfig.host,
      port: redisConfig.port,
      servername: redisConfig.host,
    });
  }

  return net.createConnection({
    host: redisConfig.host,
    port: redisConfig.port,
  });
}

function encodeRedisCommand(parts) {
  const encodedParts = parts.map((part) => {
    const buffer = Buffer.isBuffer(part) ? part : Buffer.from(String(part));
    return Buffer.concat([
      Buffer.from(`$${buffer.length}\r\n`, "utf8"),
      buffer,
      Buffer.from("\r\n", "utf8"),
    ]);
  });

  return Buffer.concat([
    Buffer.from(`*${parts.length}\r\n`, "utf8"),
    ...encodedParts,
  ]);
}

function findLineEnd(buffer, offset) {
  for (let index = offset; index < buffer.length - 1; index += 1) {
    if (buffer[index] === 13 && buffer[index + 1] === 10) {
      return index;
    }
  }

  return -1;
}

function parseRedisValue(buffer, offset = 0) {
  if (offset >= buffer.length) {
    return null;
  }

  const prefix = buffer[offset];
  const lineEnd = findLineEnd(buffer, offset);

  if (lineEnd === -1) {
    return null;
  }

  const header = buffer.subarray(offset + 1, lineEnd).toString("utf8");
  const nextOffset = lineEnd + 2;

  if (prefix === 43) {
    return {
      value: header,
      nextOffset,
    };
  }

  if (prefix === 45) {
    return {
      error: header,
      nextOffset,
    };
  }

  if (prefix === 58) {
    return {
      value: Number.parseInt(header, 10),
      nextOffset,
    };
  }

  if (prefix === 36) {
    const length = Number.parseInt(header, 10);

    if (length === -1) {
      return {
        value: null,
        nextOffset,
      };
    }

    const endOffset = nextOffset + length;
    if (buffer.length < endOffset + 2) {
      return null;
    }

    return {
      value: buffer.subarray(nextOffset, endOffset),
      nextOffset: endOffset + 2,
    };
  }

  if (prefix === 42) {
    const length = Number.parseInt(header, 10);

    if (length === -1) {
      return {
        value: null,
        nextOffset,
      };
    }

    const values = [];
    let arrayOffset = nextOffset;

    for (let index = 0; index < length; index += 1) {
      const parsed = parseRedisValue(buffer, arrayOffset);

      if (!parsed) {
        return null;
      }

      if (parsed.error) {
        return parsed;
      }

      values.push(parsed.value);
      arrayOffset = parsed.nextOffset;
    }

    return {
      value: values,
      nextOffset: arrayOffset,
    };
  }

  throw new Error(
    `Unsupported Redis response prefix: ${String.fromCharCode(prefix)}`,
  );
}

async function runRedisCommand(...commandParts) {
  const commands = [];

  if (redisConfig.password) {
    if (redisConfig.username) {
      commands.push(["AUTH", redisConfig.username, redisConfig.password]);
    } else {
      commands.push(["AUTH", redisConfig.password]);
    }
  }

  if (redisConfig.database > 0) {
    commands.push(["SELECT", redisConfig.database]);
  }

  commands.push(commandParts);

  const socket = createRedisSocket();

  return await new Promise((resolve, reject) => {
    let settled = false;
    let responseBuffer = Buffer.alloc(0);
    let responsesRead = 0;

    const finish = (callback) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.removeAllListeners();
      socket.destroy();
      callback();
    };

    socket.setTimeout(10_000);

    socket.once("connect", () => {
      try {
        const payload = Buffer.concat(commands.map(encodeRedisCommand));
        socket.write(payload);
      } catch (error) {
        finish(() => reject(error));
      }
    });

    socket.on("data", (chunk) => {
      responseBuffer = Buffer.concat([responseBuffer, chunk]);

      while (true) {
        const parsed = parseRedisValue(responseBuffer);

        if (!parsed) {
          return;
        }

        responseBuffer = responseBuffer.subarray(parsed.nextOffset);
        responsesRead += 1;

        if (parsed.error) {
          finish(() => reject(new Error(parsed.error)));
          return;
        }

        if (responsesRead === commands.length) {
          finish(() => resolve(parsed.value));
          return;
        }
      }
    });

    socket.once("timeout", () => {
      finish(() => reject(new Error("Redis request timed out")));
    });

    socket.once("error", (error) => {
      finish(() => reject(error));
    });
  });
}

async function pingRedis() {
  const response = await runRedisCommand("PING");
  return response === "PONG";
}

async function getCacheEntry(redisKey) {
  const payload = await runRedisCommand("GET", redisKey);

  if (payload === null) {
    return null;
  }

  return deserializeCacheEntry(payload);
}

async function setCacheEntry(redisKey, entry, ttlSeconds) {
  await runRedisCommand(
    "SET",
    redisKey,
    serializeCacheEntry(entry),
    "EX",
    ttlSeconds,
  );
}

async function deleteRedisKey(redisKey) {
  await runRedisCommand("DEL", redisKey);
}

async function acquireLock(lockKey, lockValue) {
  const response = await runRedisCommand(
    "SET",
    lockKey,
    lockValue,
    "NX",
    "PX",
    LOCK_TTL_MS,
  );

  return response === "OK";
}

async function releaseLock(lockKey, lockValue) {
  const currentValue = await runRedisCommand("GET", lockKey);

  if (currentValue && currentValue.equals(Buffer.from(lockValue))) {
    await deleteRedisKey(lockKey);
  }
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function waitForWarmEntry(redisKey) {
  const deadline = Date.now() + LOCK_WAIT_MS;

  while (Date.now() < deadline) {
    const entry = await getCacheEntry(redisKey);

    if (entry) {
      return entry;
    }

    await sleep(LOCK_RETRY_MS);
  }

  return null;
}

async function fetchUpstream(request) {
  const upstreamUrl = new URL(request.url, SUPABASE_KONG_UPSTREAM);
  const upstreamHeaders = {
    accept: request.headers["accept"] ?? "*/*",
    host: request.headers.host ?? upstreamUrl.host,
    "x-forwarded-for": request.socket.remoteAddress ?? "",
    "x-forwarded-host": request.headers.host ?? "",
    "x-forwarded-proto":
      request.headers["x-forwarded-proto"] ??
      (request.socket.encrypted ? "https" : "http"),
  };
  const client = upstreamUrl.protocol === "https:" ? https : http;

  return await new Promise((resolve, reject) => {
    const upstreamRequest = client.request(
      upstreamUrl,
      {
        headers: upstreamHeaders,
        method: "GET",
        timeout: UPSTREAM_TIMEOUT_MS,
      },
      (response) => {
        const chunks = [];

        response.on("data", (chunk) => {
          chunks.push(chunk);
        });

        response.once("end", () => {
          resolve({
            body: Buffer.concat(chunks),
            headers: response.headers,
            statusCode: response.statusCode ?? 502,
            statusMessage: response.statusMessage ?? "Bad Gateway",
          });
        });
      },
    );

    upstreamRequest.once("timeout", () => {
      upstreamRequest.destroy(new Error("Upstream request timed out"));
    });

    upstreamRequest.once("error", (error) => {
      reject(error);
    });

    upstreamRequest.end();
  });
}

function buildCachedResponse(entry, cacheStatus) {
  return {
    body: entry.body,
    headers: entry.meta.headers,
    statusCode: entry.meta.statusCode,
    statusMessage: entry.meta.statusMessage,
    cacheStatus,
  };
}

function createCacheEntry(upstreamResponse) {
  const cacheControl = upstreamResponse.headers["cache-control"];
  const maxAge = parseCacheControlMaxAge(
    Array.isArray(cacheControl) ? cacheControl.join(", ") : cacheControl,
  );

  if (!CACHEABLE_STATUS_CODES.has(upstreamResponse.statusCode) || !maxAge) {
    return null;
  }

  const contentType = upstreamResponse.headers["content-type"];
  const normalizedContentType = Array.isArray(contentType)
    ? contentType[0]
    : contentType;

  if (!normalizedContentType?.startsWith("image/")) {
    return null;
  }

  const now = Date.now();

  return {
    body: upstreamResponse.body,
    meta: {
      headers: pickHeaders(upstreamResponse.headers),
      statusCode: upstreamResponse.statusCode,
      statusMessage: upstreamResponse.statusMessage,
      storedAt: now,
      freshUntil: now + maxAge * 1_000,
      staleUntil: now + (maxAge + STALE_WINDOW_SECONDS) * 1_000,
    },
    ttlSeconds: maxAge + STALE_WINDOW_SECONDS,
  };
}

function sendResponse(response, payload, method) {
  response.statusCode = payload.statusCode;
  response.statusMessage = payload.statusMessage;

  for (const [name, value] of Object.entries(payload.headers ?? {})) {
    if (value) {
      response.setHeader(name, value);
    }
  }

  if (!response.hasHeader("access-control-allow-origin")) {
    response.setHeader("access-control-allow-origin", "*");
  }

  response.setHeader("access-control-expose-headers", CACHE_STATUS_HEADER);
  response.setHeader(CACHE_STATUS_HEADER, payload.cacheStatus);

  if (payload.body) {
    response.setHeader("content-length", payload.body.length);
  }

  if (method === "HEAD") {
    response.end();
    return;
  }

  response.end(payload.body);
}

function sendError(response, statusCode, statusMessage, detail) {
  response.statusCode = statusCode;
  response.statusMessage = statusMessage;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(
    JSON.stringify({
      error: detail,
    }),
  );
}

async function refreshCacheEntry(request, redisKey, staleEntry) {
  const upstreamResponse = await fetchUpstream(request);
  const cacheEntry = createCacheEntry(upstreamResponse);

  if (!cacheEntry) {
    if (staleEntry) {
      return buildCachedResponse(staleEntry, "STALE");
    }

    return {
      body: upstreamResponse.body,
      headers: pickHeaders(upstreamResponse.headers),
      statusCode: upstreamResponse.statusCode,
      statusMessage: upstreamResponse.statusMessage,
      cacheStatus: "MISS",
    };
  }

  await setCacheEntry(redisKey, cacheEntry, cacheEntry.ttlSeconds);

  return {
    body: cacheEntry.body,
    headers: cacheEntry.meta.headers,
    statusCode: cacheEntry.meta.statusCode,
    statusMessage: cacheEntry.meta.statusMessage,
    cacheStatus: staleEntry ? "REVALIDATED" : "MISS",
  };
}

async function handleCacheRequest(request, response) {
  if (!["GET", "HEAD"].includes(request.method ?? "")) {
    sendError(
      response,
      405,
      "Method Not Allowed",
      "Only GET and HEAD are supported.",
    );
    return;
  }

  let cacheInfo;

  try {
    cacheInfo = buildCacheKey(request.url, request.headers.accept);
  } catch (error) {
    sendError(response, 400, "Bad Request", error.message);
    return;
  }

  let cacheEntry;

  try {
    cacheEntry = await getCacheEntry(cacheInfo.redisKey);
  } catch (error) {
    console.error("failed to read cache entry", error);
    sendError(response, 503, "Service Unavailable", "Redis cache lookup failed.");
    return;
  }

  if (cacheEntry) {
    const now = Date.now();

    if (now <= cacheEntry.meta.freshUntil) {
      sendResponse(
        response,
        buildCachedResponse(cacheEntry, "HIT"),
        request.method,
      );
      return;
    }

    if (now > cacheEntry.meta.staleUntil) {
      cacheEntry = null;
    }
  }

  const lockValue = randomUUID();
  let hasLock = false;

  try {
    hasLock = await acquireLock(cacheInfo.lockKey, lockValue);
  } catch (error) {
    console.error("failed to acquire cache lock", error);
    sendError(response, 503, "Service Unavailable", "Redis cache lock failed.");
    return;
  }

  if (!hasLock) {
    if (cacheEntry) {
      sendResponse(
        response,
        buildCachedResponse(cacheEntry, "UPDATING"),
        request.method,
      );
      return;
    }

    try {
      const warmedEntry = await waitForWarmEntry(cacheInfo.redisKey);

      if (warmedEntry) {
        sendResponse(
          response,
          buildCachedResponse(warmedEntry, "HIT"),
          request.method,
        );
        return;
      }
    } catch (error) {
      console.error("failed while waiting for warm cache entry", error);
      sendError(
        response,
        503,
        "Service Unavailable",
        "Redis cache warm-up wait failed.",
      );
      return;
    }

    sendError(
      response,
      504,
      "Gateway Timeout",
      "Timed out waiting for a warm cache entry.",
    );
    return;
  }

  try {
    const payload = await refreshCacheEntry(
      request,
      cacheInfo.redisKey,
      cacheEntry,
    );
    sendResponse(response, payload, request.method);
  } catch (error) {
    console.error("failed to refresh cache entry", error);

    if (cacheEntry) {
      sendResponse(
        response,
        buildCachedResponse(cacheEntry, "STALE"),
        request.method,
      );
      return;
    }

    sendError(
      response,
      502,
      "Bad Gateway",
      "Failed to fetch Supabase image render.",
    );
  } finally {
    try {
      await releaseLock(cacheInfo.lockKey, lockValue);
    } catch (error) {
      console.error("failed to release cache lock", error);
    }
  }
}

async function handleRequest(request, response) {
  const url = new URL(request.url, "http://cache.local");

  if (url.pathname === HEALTH_PATH) {
    try {
      const healthy = await pingRedis();

      if (!healthy) {
        sendError(response, 503, "Service Unavailable", "Redis ping failed.");
        return;
      }

      response.statusCode = 200;
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.end(JSON.stringify({ ok: true }));
      return;
    } catch (error) {
      console.error("health check failed", error);
      sendError(
        response,
        503,
        "Service Unavailable",
        "Redis health check failed.",
      );
      return;
    }
  }

  if (!isCacheRoute(url.pathname)) {
    sendError(response, 404, "Not Found", "Route not handled by the image cache.");
    return;
  }

  await handleCacheRequest(request, response);
}

export {
  buildCacheKey,
  createCacheEntry,
  deserializeCacheEntry,
  parseAcceptBucket,
  parseCacheControlMaxAge,
  parseRedisUrl,
  serializeCacheEntry,
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = http.createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      console.error("unhandled request error", error);
      sendError(
        response,
        500,
        "Internal Server Error",
        "Unhandled cache server error.",
      );
    });
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`supabase image cache listening on ${PORT}`);
  });
}
