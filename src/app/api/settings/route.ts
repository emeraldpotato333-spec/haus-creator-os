import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export async function GET() {
  const prisma = getPrisma();
  const settings = await prisma.appSettings.upsert({
    where: { id: "app" },
    update: {},
    create: { id: "app" },
  });

  return NextResponse.json(settings);
}

export async function PATCH(request: NextRequest) {
  const prisma = getPrisma();
  const payload = await request.json();

  const settings = await prisma.appSettings.upsert({
    where: { id: "app" },
    update: {
      brandName: payload.brandName,
      defaultTheme: payload.defaultTheme,
      memoryText: payload.memoryText,
      brandVoice: payload.brandVoice,
      recruitmentCriteria: payload.recruitmentCriteria,
    },
    create: {
      id: "app",
      brandName: payload.brandName ?? "HAUS",
      defaultTheme: payload.defaultTheme ?? "system",
      memoryText: payload.memoryText ?? "",
      brandVoice: payload.brandVoice ?? "",
      recruitmentCriteria: payload.recruitmentCriteria ?? "",
    },
  });

  return NextResponse.json(settings);
}
