import { PageHeading } from "@/components/app/page-heading";
import { TemplateLibrary } from "@/components/templates/template-library";
import { getPrisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const prisma = getPrisma();
  const templates = await prisma.template.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return (
    <>
      <PageHeading eyebrow="Reusable language" title="Templates" />
      <TemplateLibrary templates={serialize(templates)} />
    </>
  );
}
