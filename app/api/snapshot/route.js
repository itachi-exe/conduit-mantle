import { NextResponse } from "next/server";
import { getSnapshot } from "@/conduit-backend/snapshot";

export async function GET() {
  const snapshot = await getSnapshot();
  return NextResponse.json(snapshot);
}
