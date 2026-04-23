import { PageHeading } from "@/components/app/page-heading";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { getPrisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const prisma = getPrisma();
  const creators = await prisma.creator.findMany({
    orderBy: [{ stageChangedAt: "desc" }],
  });

  return (
    <>
      <PageHeading eyebrow="Drag and decide" title="Pipeline" />
      <PipelineBoard creators={serialize(creators)} />
    </>
  );
}
