import "server-only";
import { getDb, schema } from "@/db";
import { slugify } from "./utils";
import { eq } from "drizzle-orm";

type ProspectValues = Partial<typeof schema.prospects.$inferInsert>;

/**
 * Zamienia payload z formularza na wartości do bazy: puste stringi → null,
 * żeby w CRM nie siedziały „puste, ale niepuste" pola (`''`), które psują filtry i eksport.
 * Pomija klucze, których w payloadzie nie było — dzięki temu ta sama funkcja obsługuje POST i PATCH.
 */
export function prospectValuesFromPayload(d: Record<string, unknown>): ProspectValues {
  const out: ProspectValues = {};
  const text = (key: keyof ProspectValues, value: unknown) => {
    if (value === undefined) return;
    const s = typeof value === "string" ? value.trim() : value;
    // @ts-expect-error — klucze tekstowe schematu przyjmują string | null
    out[key] = s === "" || s === null ? null : s;
  };

  if (typeof d.name === "string") out.name = d.name.trim();
  text("legalName", d.legalName);
  text("nip", d.nip);
  text("krs", d.krs);
  text("city", d.city);
  text("voivodeship", d.voivodeship);
  text("phone", d.phone);
  text("email", d.email);
  text("website", d.website);
  text("instagram", d.instagram);
  text("facebook", d.facebook);
  text("burProviderId", d.burProviderId);
  text("burUrl", d.burUrl);
  text("dossierPath", d.dossierPath);
  text("researchNotes", d.researchNotes);

  if (Array.isArray(d.categories)) out.categories = d.categories as string[];
  if (typeof d.status === "string") out.status = d.status as typeof schema.prospects.$inferInsert.status;
  if (typeof d.priority === "string") out.priority = d.priority as typeof schema.prospects.$inferInsert.priority;
  if (typeof d.source === "string") out.source = d.source;
  if (typeof d.burSegment === "string") out.burSegment = d.burSegment as typeof schema.prospects.$inferInsert.burSegment;

  for (const key of ["burServicesCompleted", "burServicesActive", "burRatingX10", "burReviewCount"] as const) {
    if (key in d) out[key] = (d[key] as number | null) ?? null;
  }

  return out;
}

/** Wpis na oś czasu prospekta. Nie rzuca w górę — historia kontaktu nie może wywrócić zapisu. */
export async function logProspectActivity(params: {
  prospectId: number;
  type: typeof schema.prospectActivities.$inferInsert.type;
  content: string;
  createdBy?: string;
}): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(schema.prospectActivities).values({
      prospectId: params.prospectId,
      type: params.type,
      content: params.content,
      createdBy: params.createdBy ?? "admin",
    });
  } catch (err) {
    console.error("[prospects] Nie udało się zapisać aktywności:", err);
  }
}

/**
 * Wolny slug dla profilu w katalogu publicznym. `trainers.slug` jest UNIQUE,
 * a nazwy akademii bywają zbieżne — dokładamy sufiks zamiast wywalać zapis błędem 409.
 */
export async function freeTrainerSlug(name: string): Promise<string> {
  const db = await getDb();
  const base = slugify(name).slice(0, 150) || "trenerka";
  let candidate = base;
  for (let i = 2; i < 50; i++) {
    const taken = await db
      .select({ id: schema.trainers.id })
      .from(schema.trainers)
      .where(eq(schema.trainers.slug, candidate))
      .limit(1);
    if (taken.length === 0) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}
