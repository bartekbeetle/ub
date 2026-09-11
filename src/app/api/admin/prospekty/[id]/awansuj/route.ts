import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";
import { freeTrainerSlug, logProspectActivity } from "@/lib/prospects";
import { CATEGORIES } from "@/lib/constants";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

/**
 * Awans prospekta do katalogu publicznego: tworzy wiersz w `trainers`.
 *
 * Dwie bramki wbudowane w ten handler i celowo NIEprzestawialne z UI:
 * 1. `autoAssign: false` — bez podpisanej umowy automat nie wysyła danych osobowych kursantki.
 *    Włącza się ręcznie w karcie trenerki, po umowie.
 * 2. `isActive: false` — profil powstaje jako UKRYTY szkic. Świeży wiersz nie ma bio, zdjęć
 *    ani opinii; wpuszczony od razu do katalogu byłby cienką stroną w indeksie, czyli dokładnie
 *    tym, przed czym chroni rozdział `prospects` / `trainers`. Publikuje admin po uzupełnieniu profilu.
 */
export async function POST(_req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const prospectId = Number(id);
  if (!Number.isInteger(prospectId)) return NextResponse.json({ error: "Nieprawidłowe ID." }, { status: 400 });

  const db = await getDb();
  const rows = await db.select().from(schema.prospects).where(eq(schema.prospects.id, prospectId)).limit(1);
  const prospect = rows[0];
  if (!prospect) return NextResponse.json({ error: "Nie znaleziono prospekta." }, { status: 404 });

  if (prospect.trainerId) {
    return NextResponse.json(
      { error: "Ten prospekt ma już powiązany profil w katalogu trenerek." },
      { status: 409 }
    );
  }
  if (prospect.status !== "umowa") {
    return NextResponse.json(
      { error: "Profil tworzymy dopiero przy statusie „Umowa”. Zmień status prospekta." },
      { status: 409 }
    );
  }

  const specializations = prospect.categories.filter((c) => (CATEGORIES as readonly string[]).includes(c));
  const slug = await freeTrainerSlug(prospect.name);

  const [trainer] = await db
    .insert(schema.trainers)
    .values({
      slug,
      name: prospect.name,
      email: prospect.email,
      phone: prospect.phone,
      city: prospect.city,
      voivodeship: prospect.voivodeship,
      specializations,
      instagram: prospect.instagram,
      facebook: prospect.facebook,
      website: prospect.website,
      autoAssign: false, // bramka umowy — patrz komentarz nad handlerem
      isActive: false, // profil startuje jako ukryty szkic
    })
    .returning();

  const [updated] = await db
    .update(schema.prospects)
    .set({ trainerId: trainer.id, status: "aktywna", updatedAt: new Date() })
    .where(eq(schema.prospects.id, prospectId))
    .returning();

  await logProspectActivity({
    prospectId,
    type: "zmiana_statusu",
    content: `Awans do katalogu: utworzono profil trenerki #${trainer.id} (${slug}) — ukryty, bez auto-przydziału leadów.`,
    createdBy: user.email,
  });
  await logAudit({
    actor: actorLabel(user),
    action: "prospekt_awansowany",
    entityType: "prospect",
    entityId: prospectId,
    details: { trainerId: trainer.id, slug },
  });

  return NextResponse.json({ prospect: updated, trainer }, { status: 201 });
}
