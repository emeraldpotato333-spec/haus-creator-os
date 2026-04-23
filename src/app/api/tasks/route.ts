import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { taskInputSchema } from "@/lib/validators";

export async function GET() {
  const prisma = getPrisma();
  const tasks = await prisma.task.findMany({
    include: { creator: true },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  const prisma = getPrisma();
  const parsed = taskInputSchema.parse(await request.json());
  const task = await prisma.task.create({ data: parsed });

  return NextResponse.json(task, { status: 201 });
}
