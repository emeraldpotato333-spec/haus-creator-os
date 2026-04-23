import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { templateInputSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const prisma = getPrisma();
  const parsed = templateInputSchema.partial().parse(await request.json());
  const template = await prisma.template.update({
    where: { id },
    data: parsed,
  });

  return NextResponse.json(template);
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const prisma = getPrisma();
  await prisma.template.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
