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
    name: "HAUS Master Creator Brief",
    category: "BRIEF",
    subject: "HAUS creator brief: editorial tile story",
    body: `Create a calm, editorial story around HAUS artisan tile as a material with provenance, texture, and permanence.

Core message:
- HAUS tile is handmade, architectural, and quietly luxurious.
- The story should feel collected, lived-in, and design-literate.
- Show texture, scale, installation context, and how the material changes a room.`,
    variables: ["creator_name", "sample_name", "deadline", "deliverables"],
  },
  {
    name: "HAUS Brand Positioning Brief",
    category: "BRIEF",
    subject: "How to speak about HAUS",
    body: `HAUS sits at the intersection of interiors, craft, and architectural surfaces.

Voice:
- precise
- warm
- restrained
- tactile
- design-forward`,
    variables: ["product_line", "room_context"],
  },
  {
    name: "HAUS Outreach Template - Micro Creator",
    category: "OUTREACH",
    subject: "A small HAUS idea for {{creator_name}}",
    body: `Hi {{creator_name}},

I came across your work and loved how you frame interiors with texture and restraint. I help with creator partnerships for HAUS, a luxury artisan tile brand.

Would you be open to a small gifting collaboration around {{product_line}}?`,
    variables: ["creator_name", "product_line"],
  },
  {
    name: "HAUS Outreach Template - Mid Tier",
    category: "OUTREACH",
    subject: "HAUS x {{creator_name}}",
    body: `Hi {{creator_name}},

Your interiors content has the kind of lived-in polish that feels very aligned with HAUS.

Would you be open to reviewing a collaboration outline this week?`,
    variables: ["creator_name"],
  },
  {
    name: "HAUS Outreach Template - Authority / Designer",
    category: "OUTREACH",
    subject: "A trade-minded HAUS collaboration",
    body: `Hi {{creator_name}},

HAUS is building thoughtful relationships with designers and interiors voices who can speak to materiality with real authority.`,
    variables: ["creator_name"],
  },
  {
    name: "HAUS Outreach Template - UGC Creator",
    category: "OUTREACH",
    subject: "UGC concept for HAUS tile",
    body: `Hi {{creator_name}},

We are sourcing polished UGC creators for HAUS, a luxury artisan tile brand.

Would you be open to sharing rates for a short-form video package with usage rights?`,
    variables: ["creator_name"],
  },
  {
    name: "Follow-Up 1",
    category: "FOLLOW_UP",
    subject: "Following up on HAUS",
    body: `Hi {{creator_name}},

Just floating this back up. I think your eye for interiors could be a strong fit for HAUS.`,
    variables: ["creator_name", "product_line"],
  },
  {
    name: "Follow-Up 2",
    category: "FOLLOW_UP",
    subject: "Closing the loop",
    body: `Hi {{creator_name}},

Closing the loop for now, but I wanted to say I still think there is a thoughtful HAUS fit here.`,
    variables: ["creator_name"],
  },
  {
    name: "Sample / Gifting Brief",
    category: "BRIEF",
    subject: "HAUS sample details",
    body: `Sample focus: {{sample_name}}

Please capture:
- unboxing or first look
- close detail of texture and edge
- one styled interior moment`,
    variables: ["sample_name"],
  },
  {
    name: "Affiliate Offer Template",
    category: "OFFER",
    subject: "HAUS affiliate offer",
    body: `Hi {{creator_name}},

Based on the fit, we would like to offer an affiliate structure for HAUS:
- Code: {{affiliate_code}}
- Commission: {{commission}}`,
    variables: ["creator_name", "affiliate_code", "commission"],
  },
  {
    name: "Paid Collaboration Brief",
    category: "OFFER",
    subject: "Paid HAUS collaboration brief",
    body: `Scope:
- {{deliverables}}
- Timeline: {{timeline}}
- Usage: {{usage_terms}}
- Rate: {{rate}}`,
    variables: ["deliverables", "timeline", "usage_terms", "rate"],
  },
  {
    name: "Usage Rights Request",
    category: "RIGHTS",
    subject: "Usage rights for HAUS content",
    body: `Hi {{creator_name}},

We would love to license select HAUS content from your collaboration.`,
    variables: ["creator_name", "usage_window"],
  },
  {
    name: "Ambassador Expansion Template",
    category: "OFFER",
    subject: "Expanding the HAUS partnership",
    body: `Hi {{creator_name}},

Your HAUS content performed beautifully and felt deeply aligned with the brand.`,
    variables: ["creator_name"],
  },
  {
    name: "Soft Nurture Template",
    category: "NURTURE",
    subject: "A HAUS note for later",
    body: `Hi {{creator_name}},

No pressure on timing. I am keeping you on my HAUS shortlist.`,
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
