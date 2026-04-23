import { notFound } from "next/navigation";
import { PageHeading } from "@/components/app/page-heading";
import { CreatorDetailClient } from "@/components/creators/creator-detail-client";
import { getPrisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CreatorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const prisma = getPrisma();
  const [creator, templates] = await Promise.all([
    prisma.creator.findUnique({
      where: { id },
      include: {
        interactions: { orderBy: { happenedAt: "desc" } },
        tasks: { orderBy: [{ status: "asc" }, { dueDate: "asc" }] },
        briefs: { orderBy: { updatedAt: "desc" } },
        linkedTemplates: { include: { template: true } },
      },
    }),
    prisma.template.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
  ]);

  if (!creator) {
    notFound();
  }

  return (
    <>
      <PageHeading eyebrow="Creator record" title={creator.name} />
      <CreatorDetailClient initialCreator={serialize(creator)} templates={serialize(templates)} />
    </>
  );
}
