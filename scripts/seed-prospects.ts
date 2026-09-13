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
  {
    name: "ZDZ — Centrum Kształcenia w Kaliszu",
    legalName: "Zakład Doskonalenia Zawodowego w Poznaniu",
    nip: "7770001720",
    krs: "0000101221",
    city: "Kalisz",
    voivodeship: "wielkopolskie",
    categories: [
      "Stylizacja paznokci",
      "Manicure & Pedicure",
      "Stylizacja rzęs",
      "Kosmetologia",
      "Inne",
    ],
    phone: "787 010 733",
    email: "zdz@zdz.kalisz.pl",
    status: "do_kontaktu",
    priority: "wysoki",
    source: "reczny",
    burSegment: "A",
    burProviderId: "7392",
    burServicesCompleted: 1237,
    burServicesActive: 90,
    burRatingX10: 47,
    burReviewCount: 5567,
    dossierPath: "Zasoby/uniwersytet-beauty/trenerki/zdz-poznan.md",
    researchNotes:
      "Dane z karty dostawcy BUR (PARP), weryfikacja 13.09.2026. NAJWIĘKSZY dostawca w naszej bazie — " +
      "1237 usług zrealizowanych wobec 112 u BIAR i 106 u Only Beauty. Uczy stylizacji paznokci " +
      "(hybryda, żel, Acrygel, tytan) w Kaliszu, czyli w kategorii i województwie leadów czekających " +
      "w panelu.\n\n" +
      "ROZWIĄZANA PUŁAPKA NAZW: „ZDZ Kalisz” i „ZDZ Konin” to NIE są osobne podmioty. Oba to Centra " +
      "Kształcenia jednej osoby prawnej — Zakładu Doskonalenia Zawodowego w Poznaniu (NIP 7770001720, " +
      "KRS 0000101221). Potwierdzone tożsamością NIP i REGON (000512421) na stronie ZDZ Kalisz " +
      "i na karcie BUR. Karta BUR id=15082 to ZDZ TORUŃ (NIP 8790169015) — inny podmiot, odrzucony.\n\n" +
      "DŹWIGNIA: jedna umowa pokrywa pięć miast — Poznań, Kalisz, Konin, Leszno, Piła.\n\n" +
      "UWAGA przed rozmową: (1) nie znamy ceny kursu paznokci — pytanie nr 1; (2) nie potwierdzono, " +
      "czy któraś z 90 aktywnych usług BUR to paznokcie w Kaliszu (karta usługi wymaga logowania " +
      "Profilem Zaufanym); (3) to instytucja z własnym działem naboru, nie solowa trenerka — " +
      "decyzja nie zapadnie w jednej rozmowie; (4) KOLIZJA: centrala w Poznaniu też uczy paznokci, " +
      "czyli zderza się z Only Beauty. Kalisz i Konin są wolne.",
  },
  {
    name: "SNH Magdalena Kaźmierczak-Polowczyk",
    nip: "8272188298",
    city: "Kalisz",
    voivodeship: "wielkopolskie",
    categories: ["Stylizacja rzęs", "Stylizacja brwi", "Fryzjerstwo", "Inne"],
    phone: "601 458 848",
    email: "snhkazmierczak@gmail.com",
    status: "do_kontaktu",
    priority: "sredni",
    source: "reczny",
    burSegment: "A",
    burProviderId: "15618",
    burServicesCompleted: 577,
    burServicesActive: 5,
    burRatingX10: 49,
    burReviewCount: 6343,
    dossierPath: "Zasoby/uniwersytet-beauty/trenerki/snh-kalisz.md",
    researchNotes:
      "Dane z karty dostawcy BUR (PARP), weryfikacja 13.09.2026. Najwyżej oceniany podmiot w bazie — " +
      "4,9 przy 6343 ocenach. Wcześniejsza hipoteza („RSPO 482089 → prawdopodobnie segment A”) " +
      "potwierdzona wpisem w rejestrze.\n\n" +
      "NIE UCZY PAZNOKCI — sprawdzone na stronie. Zakres beauty: stylizacja oka (henna pudrowa, " +
      "lifting i laminacja rzęs, botoks rzęs, laminacja brwi) oraz fryzjerstwo i barbering. " +
      "Dlatego NIE jest adresatem leadów paznokciowych leżących dziś w panelu — czeka na leada " +
      "rzęsy/brwi z rejonu kaliskiego.\n\n" +
      "UWAGA: tylko 5 usług aktywnych wobec 577 zrealizowanych — kursantka może trafić na przerwę " +
      "między naborami. Ceny szkoleń beauty nieustalone (kwota 1120 zł netto z wyszukiwarki dotyczy " +
      "nieznanej usługi, a SNH szkoli też ze sprzedaży i zarządzania — nie przenoszę jej na beauty). " +
      "KOLIZJA do rozstrzygnięcia, gdy podpiszemy obu: ZDZ Kalisz też uczy rzęs.",
  },
  {
    name: "Julia Nessa",
    nip: "9721250453",
    city: "Poznań",
    voivodeship: "wielkopolskie",
    categories: ["Stylizacja paznokci", "Manicure & Pedicure"],
    phone: "515 238 216",
    status: "parking",
    priority: "niski",
    source: "reczny",
    burSegment: "B",
    researchNotes:
      "Weryfikacja 13.09.2026. SEGMENT B — brak śladu w rejestrze BUR, a strona szkoleniowa " +
      "(szkolenia.julianessa.pl) nie wspomina o dofinansowaniu, BUR, KFS ani PARP ani razu. " +
      "Dziś leada nie dostaje. Nie kasować — to rynek etapu „wpis do BUR jako aktywo wynajmowane”. " +
      "Mocna wizytówka: 4,9 przy 269 opiniach GMB, REGON 302783563, Pogodna 16, 60-275 Poznań.\n\n" +
      "🔴 WARTOŚĆ TEGO WPISU TO CENNIK, nie sam podmiot. To pierwszy publiczny cennik kursów " +
      "paznokciowych w Wielkopolsce, jaki mamy: grupowo manicure hybrydowy 600 zł, zdobienia 550 zł, " +
      "manicure kombinowany 750 zł, doszkolenie żelowe 850 zł, 5 kształtów 1000 zł, podstawy " +
      "przedłużania żelem 1200 zł. Indywidualnie 1200–2500 zł.\n\n" +
      "KONSEKWENCJA DLA MODELU: przy tych cenach prowizja 500 zł za zapis to 42–91% ceny kursu — " +
      "nie spina się. ZASTRZEŻENIE: to cennik rynku otwartego u podmiotu BEZ wpisu do BUR; " +
      "szkolenia z dofinansowaniem bywają wyceniane 2–4× wyżej i wtedy 500 zł to 5–10%. " +
      "Cen u Only Beauty, ZDZ i BIAR nadal nie znamy. Wniosek operacyjny: „ile kosztuje szkolenie” " +
      "musi być pytaniem nr 1 w każdej rozmowie, ZANIM padnie kwota 500 zł.",
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
