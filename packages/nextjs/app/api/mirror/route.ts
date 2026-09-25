import { reconcile } from "../../../lib/store";

export async function GET(request: Request): Promise<Response> {
  const sequence = new URL(request.url).searchParams.get("sequence");
  if (sequence === null || !/^[0-9]+$/.test(sequence)) {
    return Response.json({ error: "sequence is required" }, { status: 400 });
  }
  try {
    const row = await reconcile(sequence);
    return Response.json({
      sequenceNumber: row.sequenceNumber,
      status: row.status,
      topicId: row.topicId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "reconcile failed";
    return Response.json({ error: message }, { status: 404 });
  }
}
