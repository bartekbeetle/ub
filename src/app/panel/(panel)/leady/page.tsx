import { crmTrenerkiEnabled } from "@/lib/crm-flag";
import { CrmLeadyPage } from "./crm-page";
import { LegacyLeadyPage } from "./legacy-page";

export const dynamic = "force-dynamic";

type SP = { etap?: string; q?: string; dzis?: string };

export default async function PanelLeadyPage({ searchParams }: { searchParams: Promise<SP> }) {
  return crmTrenerkiEnabled() ? <CrmLeadyPage searchParams={searchParams} /> : <LegacyLeadyPage />;
}
