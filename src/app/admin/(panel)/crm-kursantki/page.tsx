import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isAdminRole, isSuperadminRole } from "@/lib/roles";
import { CATEGORIES, voivodeshipName } from "@/lib/constants";
import { pipelineBoard, pipelineBoardCards, pipelineBoards, pipelineFunnel } from "@/lib/pipeline";
import { FunnelKanban } from "@/components/admin/pipeline/FunnelKanban";
import { BoardKanban } from "@/components/admin/pipeline/BoardKanban";
import { AddTrainerButton } from "@/components/admin/pipeline/AddTrainerButton";
import { AddBoardSelect } from "@/components/admin/pipeline/AddBoardSelect";

export const dynamic = "force-dynamic";

type Search = Promise<{ [key: string]: string | string[] | undefined }>;

const place = (city: string | null, voiv: string) => city || voivodeshipName(voiv) || "brak miasta";

/**
 * CRM KURSANTEK (Bartek, 08.10.2026): zakładka „Lejek" + jedna zakładka na każdą tablicę
 * trenerka × kategoria. Tylko admin; kwoty naliczeń widzi wyłącznie superadmin.
 */
export default async function CrmKursantkiPage({ searchParams }: { searchParams: Search }) {
  // Bramka na samej stronie (layout renderuje się równolegle): przekierowanie PRZED zapytaniami.
  const user = await getSessionUser();
  if (!user || !isAdminRole(user.role)) redirect("/admin/login");
  const superadmin = isSuperadminRole(user.role);

  const sp = await searchParams;
  const tab = typeof sp.tablica === "string" ? Number(sp.tablica) : null;
  const boards = await pipelineBoards();
  const funnel = await pipelineFunnel();
  const openFunnel = funnel.filter((f) => f.stage !== "odrzucona").length;

  const current = tab && Number.isInteger(tab) ? await pipelineBoard(tab) : null;
  const cards = current ? await pipelineBoardCards(current.board.id) : null;

  // Zakładki pogrupowane po trenerce, żeby „La Beauty · brwi" i „La Beauty · rzęsy" stały obok siebie.
  const byTrainer = new Map<number, typeof boards>();
  for (const b of boards) byTrainer.set(b.trainerId, [...(byTrainer.get(b.trainerId) ?? []), b]);

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
      active ? "border-sand-700 bg-sand-700 text-white" : "border-sand-200 bg-white text-ink-soft hover:border-sand-400"
    }`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold">CRM kursantek</h1>
          <p className="mt-1 text-sm text-muted">
            Lejek → kwalifikacja po telefonie → przypisanie na tablicę trenerki → cykl do wpłaty i kursu.
            Nic stąd nie wysyła maili ani SMS-ów.
          </p>
        </div>
        <AddTrainerButton categories={CATEGORIES} />
      </div>

      <nav aria-label="Tablice" className="mt-5 flex flex-wrap items-center gap-2">
        <Link href="/admin/crm-kursantki" className={tabClass(!current)}>
          Lejek <span className="opacity-70">({openFunnel})</span>
        </Link>
        {[...byTrainer.values()].map((group) =>
          group.map((b) => (
            <Link key={b.id} href={`/admin/crm-kursantki?tablica=${b.id}`} className={tabClass(current?.board.id === b.id)}>
              {b.name} <span className="opacity-70">({b.cards})</span>
              {!b.hasContract && <span title="Bez podpisanej umowy" aria-label="bez umowy">·&nbsp;bez umowy</span>}
            </Link>
          ))
        )}
      </nav>

      {current && cards ? (
        <section className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-lg font-semibold">
              {current.board.name}
              {!current.trainer.autoAssign && (
                <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 align-middle text-[11px] font-bold text-amber-800">
                  bez umowy — dane kursantek nie wychodzą do trenerki
                </span>
              )}
            </h2>
            <AddBoardSelect
              trainerId={current.trainer.id}
              trainerName={current.trainer.name}
              missing={CATEGORIES.filter(
                (c) => !boards.some((b) => b.trainerId === current.trainer.id && b.category === c)
              )}
            />
          </div>
          <BoardKanban
            boardId={current.board.id}
            items={cards.map((c) => ({
              assignmentId: c.assignmentId,
              leadId: c.leadId,
              name: c.name,
              phone: c.phone,
              courseTitle: c.courseTitle,
              place: place(c.city, c.voivodeship),
              stage: c.stage,
              assignedAt: c.assignedAt.toISOString(),
              hasPhoneConsent: c.hasPhoneConsent,
              lastEvent: c.lastEvent,
              amount: superadmin ? c.amount : null,
            }))}
          />
        </section>
      ) : (
        <section className="mt-6">
          {tab !== null && !current && <p className="mb-3 text-sm text-red-700">Nie ma takiej tablicy — pokazuję lejek.</p>}
          {boards.length === 0 && (
            <p className="mb-3 text-sm text-muted">
              Nie masz jeszcze żadnej tablicy. Kliknij „Dodaj trenerkę" — każda zaznaczona kategoria dostanie swój Kanban.
            </p>
          )}
          <FunnelKanban
            boards={boards.map((b) => ({ id: b.id, label: b.name, category: b.category }))}
            items={funnel.map((f) => ({
              id: f.id,
              name: f.name,
              phone: f.phone,
              category: f.category,
              courseTitle: f.courseTitle,
              place: place(f.city, f.voivodeship),
              createdAt: f.createdAt.toISOString(),
              stage: f.stage,
              hasPhoneConsent: f.hasPhoneConsent,
            }))}
          />
        </section>
      )}
    </div>
  );
}
