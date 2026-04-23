import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { taskInputSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const prisma = getPrisma();
  const parsed = taskInputSchema.partial().parse(await request.json());

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...parsed,
      ...(parsed.status === "DONE" ? { completedAt: new Date() } : {}),
      ...(parsed.status && parsed.status !== "DONE" ? { completedAt: null } : {}),
    },
  });

  return NextResponse.json(task);
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const prisma = getPrisma();
  await prisma.task.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
