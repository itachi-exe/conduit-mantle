import { NextResponse } from "next/server";
import { getSnapshot } from "@/conduit-backend/snapshot";
import { rankSignals, computeComposability, computeNetFlow7d } from "@/conduit-backend/signals";

export async function GET() {
  const snapshot = await getSnapshot();
  const signals = rankSignals(snapshot.protocols);
  const composability = computeComposability(snapshot.protocols);
  const netFlow = computeNetFlow7d(snapshot.protocols);

  return NextResponse.json({
    source: snapshot.source,
    generatedAt: snapshot.generatedAt,
    signals,
    topSignal: signals[0] ?? null,
    composability,
    netFlow,
  });
}
