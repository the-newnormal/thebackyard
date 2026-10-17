import { connection, type NextRequest } from "next/server";
import { buildIcs } from "@/lib/calendar";
import { featured } from "@/lib/editions/select";
import { getStore, isStoreConfigured } from "@/lib/registrations";
import { siteUrl } from "@/lib/site";

/** `/event.ics?edition=<slug>` for one date; without it, the next one (older links). */
export async function GET(request: NextRequest) {
  await connection();
  if (!isStoreConfigured()) return new Response("Not found", { status: 404 });

  const slug = request.nextUrl.searchParams.get("edition");
  const editions = (await getStore().listEditions()).filter((e) => e.status !== "draft");
  const now = new Date();
  const edition = slug ? editions.find((e) => e.slug === slug) : featured(editions, now);
  if (!edition) return new Response("Not found", { status: 404 });

  return new Response(buildIcs(edition, siteUrl(), now), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="backyard-${edition.slug}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
