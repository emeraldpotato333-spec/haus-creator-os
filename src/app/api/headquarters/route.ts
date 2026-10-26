import { getHqStore, HqStoreError } from "@/lib/hq-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const records = await getHqStore().list();
    return Response.json({ records }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof HqStoreError ? error.message : "Shared headquarters is temporarily unavailable.";
    return Response.json({ error: message }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
