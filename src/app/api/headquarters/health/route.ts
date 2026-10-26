import { getHqStore, isHqConfigured } from "@/lib/hq-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isHqConfigured()) {
    return Response.json({ status: "unconfigured", writesEnabled: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  try {
    await getHqStore().probe();
    return Response.json({ status: "ready", storage: "shared", writesEnabled: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable", writesEnabled: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
