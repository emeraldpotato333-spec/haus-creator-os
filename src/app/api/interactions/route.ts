import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { interactionInputSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const prisma = getPrisma();
  const parsed = interactionInputSchema.parse(await request.json());
  const interaction = await prisma.interaction.create({ data: parsed });

  return NextResponse.json(interaction, { status: 201 });
}
