import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { pipelineStageSchema, prioritySchema } from "@/lib/validators";
import { getPrisma } from "@/lib/prisma";
import { calculateOverallScore } from "@/lib/domain";

type CsvPayload = {
  kind: "creators" | "tasks";
  csv: string;
};

export async function POST(request: NextRequest) {
  const prisma = getPrisma();
  const payload = (await request.json()) as CsvPayload;

  if (!payload?.csv || !payload?.kind) {
    return NextResponse.json({ error: "Missing CSV payload." }, { status: 400 });
  }

  const parsed = Papa.parse<Record<string, string>>(payload.csv, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length) {
    return NextResponse.json({ error: parsed.errors[0]?.message ?? "CSV could not be parsed." }, { status: 400 });
  }

  if (payload.kind === "creators") {
    let created = 0;

    for (const row of parsed.data) {
      const scores = {
        visualFitScore: Number(row.visualFitScore || 0),
        commercialFitScore: Number(row.commercialFitScore || 0),
        contentQuality: Number(row.contentQuality || 0),
        trustPurchaseIntentScore: Number(row.trustPurchaseIntentScore || 0),
      };

      await prisma.creator.create({
        data: {
          name: row.name,
          handle: row.handle,
          platform: row.platform || "Instagram",
          stage: pipelineStageSchema.catch("SOURCED").parse((row.stage || "SOURCED").replaceAll(" ", "_").toUpperCase()),
          priority: prioritySchema.catch("MEDIUM").parse((row.priority || "MEDIUM").toUpperCase()),
          niche: row.niche || null,
          audienceSummary: row.audienceSummary || null,
          notes: row.notes || "",
          nextAction: row.nextAction || null,
          profileImageUrl: row.profileImageUrl || null,
          tags: row.tags ? row.tags.split(/[;,]/).map((tag) => tag.trim()).filter(Boolean) : [],
          ...scores,
          overallScore: calculateOverallScore(scores),
        },
      });
      created += 1;
    }

    return NextResponse.json({ ok: true, created });
  }

  let created = 0;

  for (const row of parsed.data) {
    const creator =
      row.handle
        ? await prisma.creator.findFirst({
            where: {
              handle: row.handle,
            },
          })
        : null;

    await prisma.task.create({
      data: {
        creatorId: creator?.id ?? null,
        title: row.title,
        details: row.details || "",
        status: ["TODO", "IN_PROGRESS", "DONE"].includes(row.status) ? (row.status as "TODO" | "IN_PROGRESS" | "DONE") : "TODO",
        priority: prioritySchema.catch("MEDIUM").parse((row.priority || "MEDIUM").toUpperCase()),
        dueDate: row.dueDate ? new Date(row.dueDate) : null,
      },
    });
    created += 1;
  }

  return NextResponse.json({ ok: true, created });
}
