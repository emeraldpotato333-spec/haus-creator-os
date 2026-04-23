import { PageHeading } from "@/components/app/page-heading";
import { SettingsEditor } from "@/components/settings/settings-editor";
import { getPrisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const prisma = getPrisma();
  const settings = await prisma.appSettings.upsert({
    where: { id: "app" },
    update: {},
    create: { id: "app" },
  });

  return (
    <>
      <PageHeading eyebrow="Memory" title="Notes / Memory" />
      <SettingsEditor initialSettings={serialize(settings)} mode="notes" />
    </>
  );
}
