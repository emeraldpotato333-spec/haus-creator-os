import { ZodError } from "zod";
import { getHqStore, HqStoreError } from "@/lib/hq-store";
import { HqValidationError, isSameOriginMutation } from "@/lib/hq-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const headers = { "Cache-Control": "private, no-store" };

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const record = await getHqStore().get(id);
    if (!record) return Response.json({ error: "Creator record not found." }, { status: 404, headers });
    return Response.json(record, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  if (!isSameOriginMutation(request)) {
    return Response.json({ error: "Save changes from this headquarters page." }, { status: 403, headers });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "Use a JSON request body." }, { status: 415, headers });
  }
  try {
    const store = getHqStore();
    const { id } = await context.params;
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > 20000) {
      return Response.json({ error: "This update is too large." }, { status: 413, headers });
    }
    let input: unknown;
    try { input = JSON.parse(body); } catch {
      return Response.json({ error: "Request body must be valid JSON." }, { status: 400, headers });
    }
    const result = await store.patch(id, input);
    return Response.json(result, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return Response.json({ error: "Invalid planning update.", details: error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })) }, { status: 400, headers });
  }
  if (error instanceof HqValidationError) return Response.json({ error: error.message }, { status: 400, headers });
  if (error instanceof HqStoreError) {
    const status = error.code === "not_found" ? 404 : error.code === "unavailable" ? 503 : 409;
    return Response.json({ error: error.message, ...(error.current ? { current: error.current } : {}) }, { status, headers });
  }
  return Response.json({ error: "The change could not be saved. Reload and try again." }, { status: 503, headers });
}
