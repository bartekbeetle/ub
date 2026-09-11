// Seed CRM trenerek: 3 potwierdzone podmioty na start pipeline'u B2B.
//
// Dane z rejestru Bazy Usług Rozwojowych (PARP), zweryfikowane 2026-09-11.
// Dossier źródłowe w vaultcie Sejf → Zasoby/uniwersytet-beauty/trenerki/
//
// Idempotentny — dopasowuje po NIP-ie, a gdy go brak, po nazwie. Nie nadpisuje istniejących
// wierszy: jeśli podmiot już jest w CRM, seed go pomija (ręczne notatki są ważniejsze od seeda).
import "dotenv/config";
import { eq, or, sql } from "drizzle-orm";

async function getDb() {
  const url = process.env.DATABASE_URL;
  if (url && url.trim() !== "") {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const schema = await import("../src/db/schema");
    const pool = new Pool({
      connectionString: url,
      connectionTimeoutMillis: 15000,
      statement_timeout: 30000,
    });
    return { db: drizzle(pool, { schema }), close: () => pool.end(), schema };
  }
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  const schema = await import("../src/db/schema");
  const client = new PGlite("./.pglite");
  return { db: drizzle(client, { schema }), close: () => client.close(), schema };
}

const BUR_URL = (id: string) =>
  `https://uslugirozwojowe.parp.gov.pl/wyszukiwarka/dostawca-uslug/podglad?id=${id}`;

type SeedProspect = {
  name: string;
  legalName?: string;
  nip?: string;
  krs?: string;
  city: string;
  voivodeship: string;
  categories: string[];
  phone?: string;
  email?: string;
  status: string;
  priority: string;
  source: string;
  burSegment: "A" | "B" | "nieznany";
  burProviderId?: string;
  burServicesCompleted?: number;
  burServicesActive?: number;
  burRatingX10?: number;
  burReviewCount?: number;
  dossierPath?: string;
  researchNotes?: string;
  /** Slug istniejącego profilu w katalogu — jeśli istnieje, prospekt zostaje z nim powiązany. */
  trainerSlug?: string;
};

const PROSPECTS: SeedProspect[] = [
  {
    name: "BIAR Academy",
    legalName: "BIAR Academy sp. z o.o.",
    nip: "9542870417",
    krs: "0001103025",
    city: "Katowice",
    voivodeship: "slaskie",
    categories: ["Stylizacja rzęs", "Stylizacja brwi", "Fryzjerstwo", "Inne"],
    phone: "603 270 619",
    email: "info@biarbeauty.com",
    status: "do_kontaktu",
    priority: "wysoki",
    source: "reczny",
    burSegment: "A",
    burProviderId: "177944",
    burServicesCompleted: 112,
    burServicesActive: 13,
    burRatingX10: 50,
    burReviewCount: 373,
    dossierPath: "Zasoby/uniwersytet-beauty/trenerki/biar-academy.md",
    researchNotes:
      "Dane z karty dostawcy BUR (PARP), weryfikacja 11.09.2026. Zakres szkoleń: wizaż i makijaż, " +
      "stylizacja rzęs i brwi, fryzury. 112 usług zrealizowanych i 13 aktywnych to jeden z mocniejszych " +
      "wyników w śląskim — podmiot zna proces dofinansowania i nie trzeba go uczyć BUR od zera.\n\n" +
      "UWAGA przy dopasowaniu leadów: „wizaż / makijaż okolicznościowy” NIE ma odpowiednika w naszym " +
      "słowniku kategorii (jest tylko „PMU / Makijaż permanentny”, czyli co innego). Zapisane jako " +
      "„Inne” — do rozstrzygnięcia przy poszerzaniu słownika kategorii.",
  },
  {
    name: "Akademia Only Beauty",
    nip: "7773076925",
    city: "Poznań",
    voivodeship: "wielkopolskie",
    categories: [
      "Stylizacja paznokci",
      "PMU / Makijaż permanentny",
      "Kosmetologia",
      "Manicure & Pedicure",
      "Inne",
    ],
    phone: "570 883 999",
    email: "akademiaonlybeauty@gmail.com",
    status: "do_kontaktu",
    priority: "wysoki",
    source: "reczny",
    burSegment: "A",
    burProviderId: "158005",
    burServicesCompleted: 106,
    burServicesActive: 4,
    burRatingX10: 48,
    burReviewCount: 191,
    researchNotes:
      "Dane z karty dostawcy BUR (PARP), weryfikacja 11.09.2026. Zakres: stylizacja paznokci, PMU, " +
      "podologia, kosmetyka, makijaż. Podologia i makijaż okolicznościowy nie mają odpowiednika " +
      "w naszym słowniku kategorii — zapisane jako „Inne”. Do ustalenia przy pierwszej rozmowie, " +
      "czy w ogóle zgłaszać na nie leady.",
  },
  {
    name: "Weronika Kachel",
    city: "Tychy",
    voivodeship: "slaskie",
    categories: ["PMU / Makijaż permanentny"],
    status: "aktywna",
    priority: "wysoki",
    source: "reczny",
    burSegment: "A",
    dossierPath: "Zasoby/uniwersytet-beauty/trenerki/weronika-kachel.md",
    researchNotes:
      "Pierwsza partnerka UB — profil publiczny już istnieje w katalogu. Zgoda na publikację profilu, " +
      "opinii z GMB i szkoleń: ustna, potwierdzona przez Bartka 18.07.2026. Umowa partnerska nadal " +
      "niepodpisana — dlatego auto-przydział leadów w katalogu zostaje wyłączony.",
    trainerSlug: "weronika-kachel",
  },
];

async function main() {
  const { db, close, schema } = await getDb();
  const { prospects, prospectActivities, trainers } = schema;

  for (const p of PROSPECTS) {
    const existing = await db
      .select({ id: prospects.id })
      .from(prospects)
      .where(p.nip ? or(eq(prospects.nip, p.nip), eq(prospects.name, p.name)) : eq(prospects.name, p.name))
      .limit(1);

    if (existing.length > 0) {
      console.log(`· ${p.name} — już w CRM (#${existing[0].id}), pomijam`);
      continue;
    }

    let trainerId: number | null = null;
    if (p.trainerSlug) {
      const t = await db
        .select({ id: trainers.id })
        .from(trainers)
        .where(eq(trainers.slug, p.trainerSlug))
        .limit(1);
      trainerId = t[0]?.id ?? null;
      if (!trainerId) {
        console.log(`  ⚠ Brak profilu „${p.trainerSlug}" w katalogu — prospekt bez powiązania.`);
      }
    }

    const [created] = await db
      .insert(prospects)
      .values({
        name: p.name,
        legalName: p.legalName ?? null,
        nip: p.nip ?? null,
        krs: p.krs ?? null,
        city: p.city,
        voivodeship: p.voivodeship,
        categories: p.categories,
        phone: p.phone ?? null,
        email: p.email ?? null,
        status: p.status as typeof prospects.$inferInsert.status,
        priority: p.priority as typeof prospects.$inferInsert.priority,
        source: p.source,
        burSegment: p.burSegment,
        burProviderId: p.burProviderId ?? null,
        burUrl: p.burProviderId ? BUR_URL(p.burProviderId) : null,
        burServicesCompleted: p.burServicesCompleted ?? null,
        burServicesActive: p.burServicesActive ?? null,
        burRatingX10: p.burRatingX10 ?? null,
        burReviewCount: p.burReviewCount ?? null,
        burCheckedAt: p.burProviderId ? new Date("2026-09-11T12:00:00Z") : null,
        dossierPath: p.dossierPath ?? null,
        researchNotes: p.researchNotes ?? null,
        researchedAt: new Date("2026-09-11T12:00:00Z"),
        trainerId,
      })
      .returning();

    await db.insert(prospectActivities).values({
      prospectId: created.id,
      type: "notatka",
      content: `Dodany z seeda startowego CRM (dane z BUR, weryfikacja 11.09.2026).`,
      createdBy: "system",
    });

    console.log(`✓ ${p.name} (#${created.id})${trainerId ? ` ↔ trenerka #${trainerId}` : ""}`);
  }

  const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(prospects);
  console.log(`\nProspektów w CRM: ${c}`);
  await close();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Błąd seed-prospects:", err);
    process.exit(1);
  });
