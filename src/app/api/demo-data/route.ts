import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { loadDemoData } from "@/lib/demo-data";

export async function POST() {
  const prisma = getPrisma();
  const result = await loadDemoData(prisma);

  if (!result.loaded) {
    return NextResponse.json(
      { error: "Demo data can only be loaded into an empty creator workspace." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}
