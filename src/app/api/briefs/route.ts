import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { briefInputSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const prisma = getPrisma();
  const parsed = briefInputSchema.parse(await request.json());
  const brief = await prisma.brief.create({ data: parsed });

  return NextResponse.json(brief, { status: 201 });
}
