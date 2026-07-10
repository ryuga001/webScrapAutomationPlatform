import { chatSuggestService } from "@/server/container";
import { requireUser } from "@/server/http/auth";
import { handleError, json, preflight } from "@/server/http/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const suggestions = await chatSuggestService.suggest(user.id, body);
    return json({ suggestions });
  } catch (err) {
    return handleError(err);
  }
}
