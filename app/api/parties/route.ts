import { getActiveParties, partiesLoadError } from "@/lib/parties.server";

export async function GET() {
  try {
    return Response.json(await getActiveParties());
  } catch {
    return Response.json({ error: partiesLoadError }, { status: 503 });
  }
}
