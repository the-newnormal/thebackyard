import { connection } from "next/server";
import { getStore, isStoreConfigured } from "@/lib/registrations";

const FILE = /^([0-9a-f]{32})\.(jpg|png|webp)$/;
const EXTENSION = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

/**
 * Posters uploaded in /admin, stored in the database. The name is a hash of
 * the bytes, so a URL never changes content. Caches keep them for a day, so a
 * poster removed in /admin stops being served soon after.
 */
export async function GET(request: Request, { params }: RouteContext<"/posters/[file]">) {
  await connection();
  const match = FILE.exec((await params).file);
  if (!match || !isStoreConfigured()) return new Response("Not found", { status: 404 });

  // A query string would bypass the CDN cache and read the image from the
  // database every time.
  const url = new URL(request.url);
  if (url.search) return Response.redirect(new URL(url.pathname, url), 308);

  const etag = `"${match[1]}"`;
  const headers = {
    ETag: etag,
    "Cache-Control": "public, max-age=86400",
    "CDN-Cache-Control": "max-age=86400",
    "X-Content-Type-Options": "nosniff",
  };
  const poster = await getStore().getPoster(match[1]);
  if (!poster || EXTENSION[poster.contentType] !== match[2]) {
    return new Response("Not found", { status: 404 });
  }
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(new Blob([new Uint8Array(poster.bytes)], { type: poster.contentType }), {
    headers: { ...headers, "Content-Type": poster.contentType },
  });
}
