import { connection } from "next/server";
import { getStore, isStoreConfigured } from "@/lib/registrations";

const FILE = /^([0-9a-f]{32})\.(jpg|png|webp)$/;
const EXTENSION = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

// Misses are cached briefly too, so repeating one doesn't hit the database.
const notFound = () =>
  new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "public, max-age=300", "CDN-Cache-Control": "max-age=3600" },
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

  // Only the plain URL is served: a query string or another spelling of the
  // path would bypass the CDN cache and read the image from the database again.
  const url = new URL(request.url);
  const canonical = `/posters/${match[0]}`;
  if (url.pathname !== canonical || url.search) {
    return Response.redirect(new URL(canonical, url), 308);
  }

  const etag = `"${match[1]}"`;
  const headers = {
    ETag: etag,
    "Cache-Control": "public, max-age=86400",
    "CDN-Cache-Control": "max-age=86400",
    "X-Content-Type-Options": "nosniff",
  };
  // The name is the content's hash, so a matching ETag needs no lookup.
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  const poster = await getStore().getPoster(match[1]);
  if (!poster || EXTENSION[poster.contentType] !== match[2]) return notFound();
  return new Response(new Blob([new Uint8Array(poster.bytes)], { type: poster.contentType }), {
    headers: { ...headers, "Content-Type": poster.contentType },
  });
}
