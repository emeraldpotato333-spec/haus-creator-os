import { addDays, subDays } from "date-fns";
import type { PrismaClient } from "@/generated/prisma/client";
import { calculateOverallScore } from "@/lib/domain";

const demoCreators = [
  {
    name: "Mara Vale",
    handle: "@maravalehome",
    platform: "Instagram",
    profileUrl: "https://instagram.com/maravalehome",
    profileImageUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80",
    niche: "warm minimal interiors",
    source: "Instagram save folder",
    audienceSummary: "Design-forward homeowners and remodelers.",
    nextAction: "Review the gifting brief and send a tailored invite.",
    notes: "Strong natural light and excellent surface detail.",
    tags: ["interiors", "warm-minimal", "high-fit"],
    stage: "INVITED" as const,
    priority: "HIGH" as const,
    visualFitScore: 9,
    commercialFitScore: 8,
    contentQuality: 9,
    trustPurchaseIntentScore: 8,
  },
  {
    name: "Theo Calder",
    handle: "@calderstudio",
    platform: "Instagram",
    profileUrl: "https://instagram.com/calderstudio",
    profileImageUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80",
    niche: "designer education",
    source: "Trade newsletter",
    audienceSummary: "Trade-heavy audience with design authority.",
    nextAction: "Assess whether to move from replied to qualified.",
    notes: "Strong authority signal. Slower content cadence.",
    tags: ["designer", "trade", "authority"],
    stage: "REPLIED" as const,
    priority: "HIGH" as const,
    visualFitScore: 8,
    commercialFitScore: 8,
    contentQuality: 8,
    trustPurchaseIntentScore: 9,
  },
  {
    name: "Sofia Rune",
    handle: "@sofiarunehouse",
    platform: "Instagram",
    profileUrl: "https://instagram.com/sofiarunehouse",
    profileImageUrl: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=240&q=80",
    niche: "collected coastal interiors",
    source: "Customer mention",
    audienceSummary: "Affluent homeowners with strong purchase intent.",
    nextAction: "Review live post comments and conversion notes.",
    notes: "Good candidate for expanded collaboration if content holds.",
    tags: ["content-live", "coastal", "purchase-intent"],
    stage: "CONTENT_LIVE" as const,
    priority: "HIGH" as const,
    visualFitScore: 9,
    commercialFitScore: 9,
    contentQuality: 8,
    trustPurchaseIntentScore: 8,
  },
  {
    name: "June Atelier",
    handle: "@juneatelier",
    platform: "Instagram",
    profileUrl: "https://instagram.com/juneatelier",
    niche: "artisan homes",
    source: "Competitor comments",
    audienceSummary: "Craft-driven audience with handmade goods affinity.",
    nextAction: "Send a softer nurture note in two days.",
    notes: "Micro creator with very good taste match.",
    tags: ["micro", "artisan", "craft"],
    stage: "QUALIFIED" as const,
    priority: "MEDIUM" as const,
    visualFitScore: 9,
    commercialFitScore: 6,
    contentQuality: 8,
    trustPurchaseIntentScore: 7,
  },
] as const;

export async function loadDemoData(prisma: PrismaClient) {
  const creatorCount = await prisma.creator.count();

  if (creatorCount > 0) {
    return { loaded: false, reason: "existing-data" as const };
  }

  const createdCreators = [];

  for (const creator of demoCreators) {
    const created = await prisma.creator.create({
      data: {
        ...creator,
        tags: [...creator.tags],
        overallScore: calculateOverallScore(creator),
        isDemo: true,
        lastContactedAt: subDays(new Date(), 2),
        nextFollowUpAt: addDays(new Date(), 3),
      },
    });

    createdCreators.push(created);
  }

  await prisma.task.createMany({
    data: [
      {
        creatorId: createdCreators[0].id,
        title: "Follow up on the invitation",
        dueDate: addDays(new Date(), 1),
        priority: "HIGH",
        isDemo: true,
      },
      {
        creatorId: createdCreators[1].id,
        title: "Review Theo qualification fit",
        dueDate: new Date(),
        priority: "HIGH",
        isDemo: true,
      },
      {
        creatorId: createdCreators[2].id,
        title: "Evaluate live content",
        dueDate: addDays(new Date(), 2),
        priority: "MEDIUM",
        isDemo: true,
      },
    ],
  });

  return { loaded: true as const };
}
