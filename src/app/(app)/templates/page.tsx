import { PageHeading } from "@/components/app/page-heading";
import { TemplateLibrary } from "@/components/templates/template-library";
import { getPrisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

type TemplatesPageProps = {
  searchParams: Promise<{ template?: string }>;
};

export default async function TemplatesPage({ searchParams }: TemplatesPageProps) {
  const prisma = getPrisma();
  const { template } = await searchParams;
  const templates = await prisma.template.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  const selectedTemplateId =
    templates.find((item) => item.id === template)?.id ??
    templates.find((item) => item.name === template)?.id ??
    templates[0]?.id ??
    "";

  return (
    <>
      <PageHeading eyebrow="Reusable language" title="Templates" />
      <TemplateLibrary templates={serialize(templates)} initialSelectedId={selectedTemplateId} />
    </>
  );
}
