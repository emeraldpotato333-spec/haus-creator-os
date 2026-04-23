import { PageHeading } from "@/components/app/page-heading";
import { CreatorsClient } from "@/components/creators/creators-client";
import { getPrisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function CreatorsPage() {
  const prisma = getPrisma();
  const creators = await prisma.creator.findMany({
    include: {
      tasks: true,
      briefs: true,
      interactions: { take: 1, orderBy: { happenedAt: "desc" } },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  return (
    <>
      <PageHeading eyebrow="Recruitment" title="Creators" />
      <CreatorsClient creators={serialize(creators)} />
    </>
  );
}
