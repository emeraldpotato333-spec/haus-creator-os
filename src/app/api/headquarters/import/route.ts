import { ZodError } from "zod";
import { getHqStore, HqStoreError } from "@/lib/hq-store";
import { isSameOriginMutation } from "@/lib/hq-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const maximumBytes = 1024 * 1024;

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return Response.json({ error: "Import records from this headquarters page." }, { status: 403, headers });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "Use a JSON request body." }, { status: 415, headers });
  }
  if (Number(request.headers.get("content-length")) > maximumBytes) {
    return Response.json({ error: "Import no more than 25 records in a file under 1 MB." }, { status: 413, headers });
  }
  try {
    const store = getHqStore();
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > maximumBytes) {
      return Response.json({ error: "Import no more than 25 records in a file under 1 MB." }, { status: 413, headers });
    }
    let input: unknown;
    try { input = JSON.parse(body); } catch {
      return Response.json({ error: "Import file must contain valid JSON." }, { status: 400, headers });
    }
    const result = await store.importRecords(input);
    return Response.json(result, { status: result.created ? 201 : 200, headers });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid import. No records were added.", details: error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })) }, { status: 400, headers });
    }
    if (error instanceof HqStoreError) {
      return Response.json({ error: error.message }, { status: error.code === "unavailable" ? 503 : 409, headers });
    }
    return Response.json({ error: "Import could not be completed. Existing records were not changed. Reload before retrying." }, { status: 503, headers });
  }
}
