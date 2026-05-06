import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

config({ path: ".env.local" });
config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed HAUS Creator OS.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const templates = [
  {
    name: "Tier 1 Boss Approval Packet",
    category: "OFFER",
    subject: "HAUS approval packet: {{creator_name}}",
    body: `Creator:
Project:
Why they matter:
Proposed HAUS contribution:
Expected deliverables:
Estimated product / freight / cash cost:
Why this is worth it:
Approval needed by:`,
    variables: ["creator_name", "project_name", "approval_deadline"],
  },
  {
    name: "Tier 2 Personalized Collab Email",
    category: "OUTREACH",
    subject: "HAUS x {{creator_name}}",
    body: `Hi {{creator_name}},

I’ve been following your {{project_type}} project and the way you handle {{collab_angle}} feels especially aligned with HAUS.

We make artisan tile and architectural surfaces that work best when the story feels tactile, thoughtful, and specific to the space.

I’d love to explore a simple collaboration around {{tile_interest}} and see if there’s a fit for your project.

Would you be open to discussing it?`,
    variables: ["creator_name", "project_type", "collab_angle", "tile_interest"],
  },
  {
    name: "Tier 3 UGC Paid Ads Inquiry",
    category: "OUTREACH",
    subject: "UGC concept for HAUS",
    body: `Hi {{creator_name}},

I came across your work and liked how natural your camera presence feels.

This would mainly be for paid ad content rather than requiring an organic post.

Would you be open to sharing your rate for a small package of raw UGC-style videos for HAUS, with possible sample or tile shipment?

If helpful, we can keep the brief simple and work from a clean shot list.`,
    variables: ["creator_name"],
  },
  {
    name: "Brief After Yes",
    category: "BRIEF",
    subject: "HAUS brief: {{creator_name}}",
    body: `Creative direction:

Tile / material focus:

Story angle:

Shot list:

Deliverables:

Timeline:

Usage rights:

Posting / ad usage notes:`,
    variables: ["creator_name"],
  },
] as const;

async function main() {
  await prisma.appSettings.upsert({
    where: { id: "app" },
    update: {
      brandName: "HAUS",
      brandVoice:
        "Editorial, tactile, quietly luxurious, and specific. Avoid loud SaaS language and generic influencer copy.",
      recruitmentCriteria:
        "Prioritize creators with interiors authority, material literacy, premium audience fit, strong natural light, and purchase intent.",
      memoryText:
        "HAUS Creator OS is for recruiting creators who can make artisan tile feel collected, architectural, and emotionally durable.",
    },
    create: {
      id: "app",
      brandName: "HAUS",
      brandVoice:
        "Editorial, tactile, quietly luxurious, and specific. Avoid loud SaaS language and generic influencer copy.",
      recruitmentCriteria:
        "Prioritize creators with interiors authority, material literacy, premium audience fit, strong natural light, and purchase intent.",
      memoryText:
        "HAUS Creator OS is for recruiting creators who can make artisan tile feel collected, architectural, and emotionally durable.",
    },
  });

  for (const template of templates) {
    await prisma.template.upsert({
      where: { name: template.name },
      update: {
        category: template.category,
        subject: template.subject,
        body: template.body,
        variables: [...template.variables],
        isStarter: true,
      },
      create: {
        ...template,
        variables: [...template.variables],
        isStarter: true,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
