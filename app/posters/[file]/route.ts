import { connection } from "next/server";
import { getStore, isStoreConfigured } from "@/lib/registrations";

const FILE = /^([0-9a-f]{32})\.(jpg|png|webp)$/;
const EXTENSION = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

// An id's bytes never change, so a few are kept in memory: requests the CDN
// doesn't absorb (odd query strings make new cache keys) then cost a tiny
// lookup instead of reading the whole image from the database.
const bytesCache = new Map<string, Uint8Array>();
const CACHED_POSTERS = 6;

const CACHED_FOR_A_DAY = { "Cache-Control": "public, max-age=86400", "CDN-Cache-Control": "max-age=86400" };

// Misses are cached briefly too, so repeating one doesn't hit the database.
const notFound = () =>
  new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "public, max-age=60", "CDN-Cache-Control": "max-age=60" },
  });

/**
 * Posters uploaded in /admin, stored in the database. The name is a hash of
 * the bytes, so a URL never changes content. Caches keep them for a day, so a
 * poster removed in /admin stops being served soon after.
 */
export async function GET(request: Request, { params }: RouteContext<"/posters/[file]">) {
  await connection();
  const match = FILE.exec((await params).file);
  if (!match || !isStoreConfigured()) return notFound();
  const [file, id, ext] = match;

  const url = new URL(request.url);
  const canonical = `/posters/${file}`;
  if (url.pathname !== canonical || url.search) {
    return new Response(null, {
      status: 308,
      headers: { Location: new URL(canonical, url).toString(), ...CACHED_FOR_A_DAY },
    });
  }

  const etag = `"${id}"`;
  const headers = { ETag: etag, ...CACHED_FOR_A_DAY, "X-Content-Type-Options": "nosniff" };
  // The name is the content's hash, so a matching ETag needs no lookup.
  const tags = (request.headers.get("if-none-match") ?? "").split(",").map((t) => t.trim());
  if (tags.some((t) => t === etag || t === `W/${etag}`)) {
    return new Response(null, { status: 304, headers });
  }

  // Still checked every time, so a removed poster stops being served.
  const store = getStore();
  const contentType = await store.posterType(id);
  if (!contentType || EXTENSION[contentType] !== ext) return notFound();
  let bytes = bytesCache.get(id);
  if (!bytes) {
    const poster = await store.getPoster(id);
    if (!poster) return notFound();
    bytes = poster.bytes;
    bytesCache.set(id, bytes);
    if (bytesCache.size > CACHED_POSTERS) bytesCache.delete(bytesCache.keys().next().value!);
  }
  return new Response(new Blob([new Uint8Array(bytes)], { type: contentType }), {
    headers: { ...headers, "Content-Type": contentType },
  });
}
