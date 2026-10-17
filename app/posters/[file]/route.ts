import { connection } from "next/server";
import { getStore, isStoreConfigured } from "@/lib/registrations";

const FILE = /^([0-9a-f]{32})\.(jpg|png|webp)$/;
const EXTENSION = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

/**
 * Posters uploaded in /admin, stored in the database. The name is a hash of
 * the bytes, so a URL never changes content and can be cached for good.
 */
export async function GET(request: Request, { params }: RouteContext<"/posters/[file]">) {
  await connection();
  const match = FILE.exec((await params).file);
  if (!match || !isStoreConfigured()) return new Response("Not found", { status: 404 });

  const poster = await getStore().getPoster(match[1]);
  if (!poster || EXTENSION[poster.contentType] !== match[2]) {
    return new Response("Not found", { status: 404 });
  }

  const etag = `"${poster.id}"`;
  const headers = {
    ETag: etag,
    "Cache-Control": "public, max-age=31536000, immutable",
    "CDN-Cache-Control": "max-age=31536000",
    "X-Content-Type-Options": "nosniff",
  };
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(new Blob([new Uint8Array(poster.bytes)], { type: poster.contentType }), {
    headers: { ...headers, "Content-Type": poster.contentType },
  });
}
