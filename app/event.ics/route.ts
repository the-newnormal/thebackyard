import { buildIcs } from "@/lib/calendar";
import { siteUrl } from "@/lib/site";

export function GET() {
  return new Response(buildIcs(siteUrl()), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="backyard.ics"',
    },
  });
}
