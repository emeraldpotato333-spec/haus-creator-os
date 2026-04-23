import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { addDays, subDays } from "date-fns";
import { PrismaClient, type PipelineStage } from "../src/generated/prisma/client";
import { calculateOverallScore } from "../src/lib/domain";

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
- Show texture, scale, installation context, and how the material changes a room.

Deliverables:
- 1 primary short-form video
- 3-5 stills
- Usage-friendly captions and natural product context

Avoid:
- Generic renovation language
- Loud promotional hooks
- Overly filtered footage`,
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
- design-forward

Useful phrases:
- artisan tile for thoughtful interiors
- texture with architectural permanence
- surfaces that feel collected, not decorated
- quiet luxury through material depth`,
    variables: ["product_line", "room_context"],
  },
  {
    name: "HAUS Outreach Template - Micro Creator",
    category: "OUTREACH",
    subject: "A small HAUS idea for {{creator_name}}",
    body: `Hi {{creator_name}},

I came across your work and loved how you frame interiors with texture and restraint. I help with creator partnerships for HAUS, a luxury artisan tile brand.

I think your eye could translate our materials in a way that feels natural rather than sponsored. Would you be open to a small gifting collaboration around {{product_line}}?

Warmly,
HAUS`,
    variables: ["creator_name", "product_line"],
  },
  {
    name: "HAUS Outreach Template - Mid Tier",
    category: "OUTREACH",
    subject: "HAUS x {{creator_name}}",
    body: `Hi {{creator_name}},

Your interiors content has the kind of lived-in polish that feels very aligned with HAUS. We create artisan tile for elevated residential and trade projects.

I would love to explore a creator partnership that gives you room to tell a material story with samples, styling context, and an editorial brief.

Would you be open to reviewing a collaboration outline this week?`,
    variables: ["creator_name"],
  },
  {
    name: "HAUS Outreach Template - Authority / Designer",
    category: "OUTREACH",
    subject: "A trade-minded HAUS collaboration",
    body: `Hi {{creator_name}},

I admire the specificity of your design perspective. HAUS is building thoughtful relationships with designers and interiors voices who can speak to materiality with real authority.

If there is a fit, I would love to send samples and discuss a refined content or trade education concept around artisan tile selection.`,
    variables: ["creator_name"],
  },
  {
    name: "HAUS Outreach Template - UGC Creator",
    category: "OUTREACH",
    subject: "UGC concept for HAUS tile",
    body: `Hi {{creator_name}},

We are sourcing polished UGC creators for HAUS, a luxury artisan tile brand. Your visual pacing and product handling feel aligned with the kind of tactile content we need.

Would you be open to sharing rates for a short-form video package with usage rights?`,
    variables: ["creator_name"],
  },
  {
    name: "Follow-Up 1",
    category: "FOLLOW_UP",
    subject: "Following up on HAUS",
    body: `Hi {{creator_name}},

Just floating this back up. I think your eye for interiors could be a strong fit for HAUS, especially around {{product_line}}.

Would you be open to a quick look at the brief?`,
    variables: ["creator_name", "product_line"],
  },
  {
    name: "Follow-Up 2",
    category: "FOLLOW_UP",
    subject: "Closing the loop",
    body: `Hi {{creator_name}},

Closing the loop for now, but I wanted to say I still think there is a thoughtful HAUS fit here.

If timing opens up, I would be happy to send over a concise concept.`,
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
- one styled interior moment
- honest notes on where you would specify it

No hard sell. The goal is material discovery.`,
    variables: ["sample_name"],
  },
  {
    name: "Affiliate Offer Template",
    category: "OFFER",
    subject: "HAUS affiliate offer",
    body: `Hi {{creator_name}},

Based on the fit, we would like to offer an affiliate structure for HAUS:

- Code: {{affiliate_code}}
- Commission: {{commission}}
- Content focus: interiors audience with purchase intent

If this works, I can send the tracking details and suggested language.`,
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
- Rate: {{rate}}

Creative direction:
Keep the work tactile, editorial, and grounded in real design decision-making.`,
    variables: ["deliverables", "timeline", "usage_terms", "rate"],
  },
  {
    name: "Usage Rights Request",
    category: "RIGHTS",
    subject: "Usage rights for HAUS content",
    body: `Hi {{creator_name}},

We would love to license select HAUS content from your collaboration for use across organic social, email, site, and paid ads.

Could you confirm availability and pricing for {{usage_window}} usage?`,
    variables: ["creator_name", "usage_window"],
  },
  {
    name: "Ambassador Expansion Template",
    category: "OFFER",
    subject: "Expanding the HAUS partnership",
    body: `Hi {{creator_name}},

Your HAUS content performed beautifully and felt deeply aligned with the brand. I would love to discuss expanding this into an ongoing ambassador relationship.

Potential structure:
- seasonal sample stories
- affiliate participation
- early product previews
- design education content`,
    variables: ["creator_name"],
  },
  {
    name: "Soft Nurture Template",
    category: "NURTURE",
    subject: "A HAUS note for later",
    body: `Hi {{creator_name}},

No pressure on timing. I am keeping you on my HAUS shortlist because your perspective feels aligned with the kind of material stories we want to tell.

I will reach back out when there is a brief that feels especially right.`,
    variables: ["creator_name"],
  },
] as const;

const creators = [
  {
    name: "Mara Vale",
    handle: "@maravalehome",
    platform: "Instagram",
    profileUrl: "https://instagram.com/maravalehome",
    email: "mara@example.com",
    location: "Los Angeles, CA",
    niche: "warm minimal interiors",
    source: "Instagram save folder",
    audienceSummary: "Design-forward homeowners, remodelers, and boutique hospitality followers.",
    whyFit: "Strong natural light, material close-ups, and calm editorial room reveals.",
    notes: "Prioritize for quiet luxury positioning. Likely receptive to samples.",
    tags: ["interiors", "warm-minimal", "high-fit"],
    followers: 48200,
    engagementRate: 3.8,
    estimatedReach: 18000,
    stage: "BRIEF_SENT" as PipelineStage,
    priority: "HIGH",
    audienceFit: 9,
    contentQuality: 9,
    aestheticFit: 10,
    authorityTrust: 8,
    logisticsFit: 8,
    purchaseIntent: 8,
  },
  {
    name: "Theo Calder",
    handle: "@calderstudio",
    platform: "Instagram",
    profileUrl: "https://instagram.com/calderstudio",
    email: "studio@example.com",
    location: "Brooklyn, NY",
    niche: "designer education",
    source: "Trade newsletter",
    audienceSummary: "Interior designers, architects, and design students.",
    whyFit: "Can explain tile selection with authority and restraint.",
    notes: "Potential authority/designer outreach. Ask about trade education angle.",
    tags: ["designer", "authority", "trade"],
    followers: 126000,
    engagementRate: 2.1,
    estimatedReach: 32000,
    stage: "REPLIED" as PipelineStage,
    priority: "HIGH",
    audienceFit: 8,
    contentQuality: 8,
    aestheticFit: 9,
    authorityTrust: 10,
    logisticsFit: 7,
    purchaseIntent: 8,
  },
  {
    name: "Elena Moss",
    handle: "@mossandmarble",
    platform: "TikTok",
    profileUrl: "https://tiktok.com/@mossandmarble",
    location: "Austin, TX",
    niche: "renovation storytelling",
    source: "TikTok search",
    audienceSummary: "Renovating homeowners with high save intent.",
    whyFit: "Great before/after pacing and transparent material decision content.",
    notes: "May need tighter brand guardrails to keep output premium.",
    tags: ["renovation", "ugc", "sample"],
    followers: 73800,
    engagementRate: 5.4,
    estimatedReach: 52000,
    stage: "SAMPLE_SENT" as PipelineStage,
    priority: "MEDIUM",
    audienceFit: 8,
    contentQuality: 7,
    aestheticFit: 7,
    authorityTrust: 7,
    logisticsFit: 9,
    purchaseIntent: 9,
  },
  {
    name: "June Atelier",
    handle: "@juneatelier",
    platform: "Instagram",
    profileUrl: "https://instagram.com/juneatelier",
    email: "hello@juneatelier.example",
    location: "Portland, OR",
    niche: "artisan homes",
    source: "Competitor comments",
    audienceSummary: "Slow interiors, handmade goods, and artisan craft followers.",
    whyFit: "Excellent craft language and strong alignment with handmade surfaces.",
    notes: "Starter micro creator. Keep outreach soft and personal.",
    tags: ["micro", "artisan", "craft"],
    followers: 18400,
    engagementRate: 6.2,
    estimatedReach: 9100,
    stage: "INVITED" as PipelineStage,
    priority: "MEDIUM",
    audienceFit: 8,
    contentQuality: 8,
    aestheticFit: 9,
    authorityTrust: 7,
    logisticsFit: 8,
    purchaseIntent: 7,
  },
  {
    name: "Avery Stone",
    handle: "@averystoneinteriors",
    platform: "Instagram",
    profileUrl: "https://instagram.com/averystoneinteriors",
    location: "Chicago, IL",
    niche: "luxury residential design",
    source: "Designer directory",
    audienceSummary: "High-income homeowners and boutique design clients.",
    whyFit: "Good taste match, but content cadence is slower.",
    notes: "Watch for responsiveness before sending product.",
    tags: ["designer", "luxury", "slow-cadence"],
    followers: 39100,
    engagementRate: 1.9,
    estimatedReach: 7400,
    stage: "VETTED" as PipelineStage,
    priority: "MEDIUM",
    audienceFit: 8,
    contentQuality: 8,
    aestheticFit: 8,
    authorityTrust: 9,
    logisticsFit: 5,
    purchaseIntent: 8,
  },
  {
    name: "Lina Park",
    handle: "@linaframes",
    platform: "Instagram",
    profileUrl: "https://instagram.com/linaframes",
    location: "San Francisco, CA",
    niche: "product styling and UGC",
    source: "UGC shortlist",
    audienceSummary: "Brand-side content buyers and decor shoppers.",
    whyFit: "Very polished hands/product footage with clean lighting.",
    notes: "Best for paid UGC, not authority content.",
    tags: ["ugc", "paid", "styling"],
    followers: 22100,
    engagementRate: 4.1,
    estimatedReach: 13000,
    stage: "QUALIFIED" as PipelineStage,
    priority: "LOW",
    audienceFit: 6,
    contentQuality: 9,
    aestheticFit: 8,
    authorityTrust: 6,
    logisticsFit: 9,
    purchaseIntent: 6,
  },
  {
    name: "Sofia Rune",
    handle: "@sofiarunehouse",
    platform: "Instagram",
    profileUrl: "https://instagram.com/sofiarunehouse",
    location: "Charleston, SC",
    niche: "collected coastal interiors",
    source: "Customer mention",
    audienceSummary: "Affluent coastal homeowners and design enthusiasts.",
    whyFit: "Audience strongly matches premium tile buyers.",
    notes: "Content is live; evaluate comments for purchase questions.",
    tags: ["content-live", "coastal", "purchase-intent"],
    followers: 91200,
    engagementRate: 3.3,
    estimatedReach: 41000,
    contentLiveUrl: "https://instagram.com/p/example",
    affiliateCode: "SOFIAHAUS",
    conversions: 7,
    revenueCents: 184000,
    stage: "CONTENT_LIVE" as PipelineStage,
    priority: "HIGH",
    audienceFit: 9,
    contentQuality: 8,
    aestheticFit: 9,
    authorityTrust: 8,
    logisticsFit: 8,
    purchaseIntent: 9,
  },
  {
    name: "Nolan Reed",
    handle: "@reedrenovates",
    platform: "YouTube",
    profileUrl: "https://youtube.com/@reedrenovates",
    location: "Denver, CO",
    niche: "long-form renovation decisions",
    source: "YouTube search",
    audienceSummary: "Deep research homeowners and DIY-adjacent remodelers.",
    whyFit: "Excellent long-form education, less premium visual language.",
    notes: "Maybe nurture for a technical tile education concept.",
    tags: ["youtube", "education", "nurture"],
    followers: 154000,
    engagementRate: 2.7,
    estimatedReach: 65000,
    stage: "SOURCED" as PipelineStage,
    priority: "LOW",
    audienceFit: 7,
    contentQuality: 7,
    aestheticFit: 5,
    authorityTrust: 8,
    logisticsFit: 7,
    purchaseIntent: 7,
  },
  {
    name: "Isabel Hart",
    handle: "@isabelhartdesign",
    platform: "Instagram",
    profileUrl: "https://instagram.com/isabelhartdesign",
    location: "Nashville, TN",
    niche: "traditional revival interiors",
    source: "Press feature",
    audienceSummary: "Design clients, trade accounts, and premium renovation followers.",
    whyFit: "High trust and strong purchasing audience.",
    notes: "Scored strong after first activation. Candidate for ambassador track.",
    tags: ["evaluated", "expansion", "designer"],
    followers: 67300,
    engagementRate: 3.1,
    estimatedReach: 26000,
    affiliateCode: "ISABELHAUS",
    conversions: 13,
    revenueCents: 392500,
    stage: "EVALUATED" as PipelineStage,
    priority: "HIGH",
    audienceFit: 9,
    contentQuality: 9,
    aestheticFit: 8,
    authorityTrust: 9,
    logisticsFit: 9,
    purchaseIntent: 9,
  },
] as const;

async function main() {
  await prisma.creatorTemplate.deleteMany();
  await prisma.brief.deleteMany();
  await prisma.interaction.deleteMany();
  await prisma.task.deleteMany();
  await prisma.creator.deleteMany();
  await prisma.template.deleteMany();

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
    await prisma.template.create({
      data: {
        ...template,
        category: template.category,
        variables: [...template.variables],
        isStarter: true,
      },
    });
  }

  const createdCreators = [];

  for (const creator of creators) {
    const overallScore = calculateOverallScore(creator);
    const created = await prisma.creator.create({
      data: {
        ...creator,
        tags: [...creator.tags],
        overallScore,
        stageChangedAt: subDays(new Date(), Math.floor(Math.random() * 9)),
      },
    });
    createdCreators.push(created);

    await prisma.interaction.create({
      data: {
        creatorId: created.id,
        type: creator.stage === "SOURCED" || creator.stage === "VETTED" ? "NOTE" : "EMAIL",
        title:
          creator.stage === "SOURCED"
            ? "Sourcing note"
            : creator.stage === "CONTENT_LIVE"
              ? "Live content review queued"
              : "Partnership touchpoint",
        body: creator.notes,
        happenedAt: subDays(new Date(), Math.floor(Math.random() * 12) + 1),
      },
    });
  }

  const [mara, theo, elena, june, , lina, sofia, , isabel] = createdCreators;

  await prisma.task.createMany({
    data: [
      {
        creatorId: mara.id,
        title: "Review Mara's brief edits",
        details: "Make sure the room context and sample language feel specific.",
        dueDate: new Date(),
        priority: "HIGH",
      },
      {
        creatorId: theo.id,
        title: "Qualify Theo for designer education angle",
        details: "Check audience comments for trade intent and product questions.",
        dueDate: addDays(new Date(), 1),
        priority: "HIGH",
        automationKey: "stage:replied:qualification-review",
      },
      {
        creatorId: elena.id,
        title: "Confirm sample delivery",
        details: "Ask for ETA and confirm unboxing direction.",
        dueDate: addDays(new Date(), 3),
        priority: "MEDIUM",
        automationKey: "stage:sample-sent:delivery-check",
      },
      {
        creatorId: june.id,
        title: "Follow up with June",
        details: "Send soft follow-up with handmade tile angle.",
        dueDate: subDays(new Date(), 1),
        priority: "MEDIUM",
        automationKey: "stage:invited:follow-up",
      },
      {
        creatorId: lina.id,
        title: "Request UGC rate card",
        details: "Ask about bundled stills, raw footage, and usage.",
        dueDate: addDays(new Date(), 2),
        priority: "LOW",
      },
      {
        creatorId: sofia.id,
        title: "Evaluate Sofia's live post",
        details: "Collect comments, saves proxy, purchase questions, and attribution notes.",
        dueDate: new Date(),
        priority: "HIGH",
        automationKey: "stage:content-live:evaluation",
      },
      {
        creatorId: isabel.id,
        title: "Draft ambassador expansion",
        details: "Use high-scoring evaluation to propose an ongoing partnership.",
        dueDate: addDays(new Date(), 2),
        priority: "HIGH",
      },
    ],
  });

  await prisma.brief.createMany({
    data: [
      {
        creatorId: mara.id,
        title: "Mara artisan surface story",
        body: "Focus on close texture, natural light, and how handmade tile shifts the room.",
        status: "SENT",
        dueDate: addDays(new Date(), 10),
        sentAt: subDays(new Date(), 1),
      },
      {
        creatorId: sofia.id,
        title: "Coastal collected tile reveal",
        body: "Capture the sample as a design decision rather than a product placement.",
        status: "CONTENT_LIVE",
        dueDate: subDays(new Date(), 2),
        sentAt: subDays(new Date(), 14),
      },
    ],
  });

  const outreachTemplate = await prisma.template.findFirst({
    where: { name: "HAUS Outreach Template - Authority / Designer" },
  });

  if (outreachTemplate) {
    await prisma.creatorTemplate.createMany({
      data: [
        { creatorId: theo.id, templateId: outreachTemplate.id },
        { creatorId: isabel.id, templateId: outreachTemplate.id },
      ],
      skipDuplicates: true,
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
