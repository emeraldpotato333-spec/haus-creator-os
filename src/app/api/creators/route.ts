import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { creatorInputSchema, withOverallScore } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const prisma = getPrisma();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const stage = searchParams.get("stage")?.trim();

  const creators = await prisma.creator.findMany({
    where: {
      ...(stage && stage !== "ALL" ? { stage: stage as never } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { handle: { contains: query, mode: "insensitive" } },
              { niche: { contains: query, mode: "insensitive" } },
              { tags: { has: query } },
            ],
          }
        : {}),
    },
    include: {
      tasks: true,
      interactions: { orderBy: { happenedAt: "desc" }, take: 1 },
      briefs: true,
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  return NextResponse.json(creators);
}

export async function POST(request: NextRequest) {
  const prisma = getPrisma();
  const payload = await request.json();
  const parsed = creatorInputSchema.parse(payload);

  const creator = await prisma.creator.create({
    data: withOverallScore(parsed),
  });

  await prisma.interaction.create({
    data: {
      creatorId: creator.id,
      type: "NOTE",
      title: "Creator added",
      body: creator.whyFit ?? creator.notes ?? "",
    },
  });

  return NextResponse.json(creator, { status: 201 });
}
