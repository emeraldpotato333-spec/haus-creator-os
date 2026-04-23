import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { templateInputSchema } from "@/lib/validators";

export async function GET() {
  const prisma = getPrisma();
  const templates = await prisma.template.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  const prisma = getPrisma();
  const parsed = templateInputSchema.parse(await request.json());
  const template = await prisma.template.create({ data: parsed });

  return NextResponse.json(template, { status: 201 });
}
