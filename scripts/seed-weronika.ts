// Seed PRODUKCYJNY: pierwszy REALNY profil trenerki — Weronika Kachel (Tychy).
// Dane zweryfikowane 2026-07-18: wizytówka Google (5.0 / 371 opinii, profil zarządzany
// przez nas), weronikakachelpmu.com, wpis w BUR (uslugirozwojowe.parp.gov.pl).
// Dossier źródłowe: vault Sejf → Zasoby/uniwersytet-beauty/trenerki/weronika-kachel.md
//
// Idempotentny — sprawdza slug, bezpieczny do wielokrotnego odpalenia.
// Zgoda Weroniki na publikację profilu, opinii z GMB i szkoleń: potwierdzona
// przez Bartka 2026-07-18. Ceny szkoleń: 5000 zł (od Bartka, 2026-07-18).
import "dotenv/config";
import { eq } from "drizzle-orm";

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

const SLUG = "weronika-kachel";

async function main() {
  const { db, close, schema } = await getDb();
  const { trainers, reviews, courses } = schema;

  const existing = await db.select({ id: trainers.id }).from(trainers).where(eq(trainers.slug, SLUG)).limit(1);
  if (existing.length > 0) {
    console.log(`Seed-weronika: profil "${SLUG}" już istnieje (id=${existing[0].id}) — nic do zrobienia.`);
    await close();
    return;
  }

  const [trainer] = await db
    .insert(trainers)
    .values({
      slug: SLUG,
      name: "Weronika Kachel",
      email: "wkachelpmu@gmail.com", // wewnętrzne — NIE renderować publicznie (uszczelnienie)
      phone: "+48 513 276 200", // wewnętrzne — NIE renderować publicznie (uszczelnienie)
      bio:
        "Właścicielka studia Weronika Kachel Microblading and PMU w Tychach. W branży makijażu permanentnego od 2014 roku, od ponad 10 lat szkoli z PMU najnowocześniejszymi technikami. " +
        "II Wicemistrzyni Świata w Makijażu Permanentnym (Mediolan), I Mistrzyni Polski w Microbladingu Brwi (Poznań). " +
        "Sędzia na międzynarodowych mistrzostwach PMU w Wietnamie, Czechach, Irlandii i Polsce. " +
        "Certyfikowana trenerka PROARTIST i AIPMUA. Jej studio ma ocenę 5.0 z ponad 370 opinii w Google.",
      specializations: [
        "Makijaż permanentny brwi",
        "Microblading",
        "Makijaż permanentny ust",
        "Kreski / eyeliner",
        "Usuwanie PMU (laserowe i bezlaserowe)",
        "Pigmentacja medyczna",
      ],
      city: "Tychy",
      voivodeship: "śląskie",
      certificates: [
        { title: "II Wicemistrzyni Świata w Makijażu Permanentnym", description: "Mediolan" },
        { title: "I Mistrzyni Polski w Microbladingu Brwi", description: "Poznań" },
        { title: "II Wicemistrzyni międzynarodowych mistrzostw GOLD", description: "Gdynia" },
        { title: "I Wicemistrzyni Polski w Microbladingu Brwi", description: "Kraków" },
        { title: "Sędzia międzynarodowych mistrzostw PMU", description: "Wietnam, Czechy, Irlandia, Polska" },
        { title: "Certyfikowana trenerka PROARTIST" },
        { title: "Certyfikowana trenerka AIPMUA" },
        { title: "Podmiot zarejestrowany w Bazie Usług Rozwojowych (PARP)", description: "uslugirozwojowe.parp.gov.pl" },
      ],
      instagram: "https://www.instagram.com/weronika_kachel_pmu",
      facebook: "https://www.facebook.com/WKmicrobladingandPmu",
      website: "https://weronikakachelpmu.com",
      rating: 50, // 5.0 w Google (371 opinii, stan 2026-07-18)
      reviewCount: 371,
      billingModel: "per_zapis",
      rate: 500,
      isActive: true,
    })
    .returning({ id: trainers.id });

  console.log(`✓ Trenerka: Weronika Kachel (id=${trainer.id})`);

  // Opinie kursantek z wizytówki Google (cytaty dosłowne, przycięte do pełnych zdań).
  // Zgoda na publikację: współpraca partnerska — profil GMB zarządzany przez nas.
  const googleReviews: { authorName: string; rating: number; content: string; courseTitle?: string }[] = [
    {
      authorName: "Natalia Matyszczyk",
      rating: 5,
      content:
        "Odbyłam szkolenie z cieniowanej kreski eyeliner i jestem bardzo zadowolona z jego przebiegu! Weronika jest otwarta, szczera i przy tym wszystkim bardzo skrupulatna, co pozwoliło mi przyswoić ogrom wiedzy teoretycznej.",
      courseTitle: "Masterclass kreski cieniowane",
    },
    {
      authorName: "Wiktoria Dymek",
      rating: 5,
      content: "Szkolenie u Weroniki to było jedno z najlepszych szkoleń, na jakich miałam okazję być.",
    },
    {
      authorName: "Anna Tomaszewicz",
      rating: 5,
      content:
        "Miałam przyjemność uczestniczyć w szkoleniu z makijażu permanentnego u Weroniki Kachel i z pełnym przekonaniem mogę je polecić.",
    },
    {
      authorName: "Martyna Nagrabska",
      rating: 5,
      content: "Polecam szkolenie z całego serca. Pani Weronika świetnie przekazuje wiedzę, a atmosfera podczas szkolenia jest świetna.",
    },
    {
      authorName: "Jolanta Dziadkiewicz",
      rating: 5,
      content:
        "Serdecznie polecam szkolenie u pani Weroniki. Pełen profesjonalizm oraz zaangażowanie ze strony prowadzącej. Szkolenie przebiegło w miłej atmosferze.",
    },
    {
      authorName: "Karolina Waszczuk",
      rating: 5,
      content: "Serdecznie polecam szkolenie u Pani Weroniki. Pełny profesjonalizm i zaangażowanie ze strony trenera.",
    },
  ];
  await db.insert(reviews).values(googleReviews.map((r) => ({ ...r, trainerId: trainer.id })));
  console.log(`✓ Opinie z Google: ${googleReviews.length}`);

  // Szkolenia z weronikakachelpmu.com/szkolenia — opublikowane, cena 5000 zł
  // (potwierdzona przez Bartka 2026-07-18).
  const dzien = 8; // 1 dzień szkoleniowy ≈ 8h
  const kursy: {
    slug: string;
    title: string;
    level: string;
    durationHours: number;
    program?: string[];
  }[] = [
    { slug: "wk-basic-pmu-brwi-usta-kreska", title: "Basic PMU — brwi, usta, kreska", level: "Podstawowy", durationHours: 5 * dzien },
    {
      slug: "wk-brwi-ombre-basic",
      title: "Brwi ombre basic",
      level: "Podstawowy",
      durationHours: 3 * dzien,
      program: [
        "Teoria: BHP w gabinecie, stanowisko pracy, sterylizacja",
        "Karta klienta, przeciwwskazania, choroby skóry",
        "Kolorymetria i dobór pigmentów",
        "Ćwiczenia techniki na skórkach",
        "Pokaz zabiegu na modelce wykonywany przez trenerkę",
        "Ćwiczenia praktyczne na modelce",
        "Omówienie błędów i indywidualny feedback",
        "Dzień 3 gratis — umawiany indywidualnie",
      ],
    },
    { slug: "wk-brwi-microblading-basic", title: "Brwi microblading basic", level: "Podstawowy", durationHours: 3 * dzien },
    { slug: "wk-wlos-maszynowy", title: "Włos maszynowy", level: "Średniozaawansowany", durationHours: 3 * dzien },
    {
      slug: "wk-masterclass-brwi-ombre",
      title: "Masterclass brwi ombre",
      level: "Zaawansowany",
      durationHours: dzien,
      program: [
        "Pokaz zabiegu na modelce wykonywany przez trenerkę",
        "Ćwiczenia praktyczne na modelce",
        "Omówienie błędów i wskazówki indywidualne",
        "Rozdanie certyfikatów",
      ],
    },
    { slug: "wk-usta-basic", title: "Usta basic", level: "Podstawowy", durationHours: 3 * dzien },
    { slug: "wk-masterclass-usta", title: "Masterclass usta", level: "Zaawansowany", durationHours: 2 * dzien },
    { slug: "wk-kreski-basic", title: "Kreski basic", level: "Podstawowy", durationHours: 3 * dzien },
    { slug: "wk-masterclass-kreski-cieniowane", title: "Masterclass kreski cieniowane", level: "Zaawansowany", durationHours: 2 * dzien },
    { slug: "wk-masterclass-eyeliner-klasyczny", title: "Masterclass kreski — eyeliner klasyczny", level: "Zaawansowany", durationHours: dzien },
    { slug: "wk-usuwanie-laserowe", title: "Usuwanie laserowe PMU i tatuażu", level: "Średniozaawansowany", durationHours: dzien },
    { slug: "wk-brodawka-piersiowa", title: "Pigmentacja brodawki piersiowej 3D", level: "Zaawansowany", durationHours: 2 * dzien },
  ];

  await db.insert(courses).values(
    kursy.map((k) => ({
      slug: k.slug,
      title: k.title,
      category: "Makijaż permanentny",
      level: k.level,
      mode: "Stacjonarny",
      shortDescription: `Szkolenie stacjonarne w studiu Weroniki Kachel w Tychach. Certyfikat ukończenia, praca na modelkach.`,
      program: k.program ?? [],
      includes: ["Certyfikat ukończenia", "Praca na modelce", "Wsparcie po szkoleniu"],
      price: 5000,
      subsidyPercent: 85,
      durationHours: k.durationHours,
      city: "Tychy",
      voivodeship: "śląskie",
      trainerId: trainer.id,
      status: "opublikowane" as const,
    }))
  );
  console.log(`✓ Szkolenia (opublikowane, 5000 zł): ${kursy.length}`);

  await close();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Błąd seed-weronika:", err);
    process.exit(1);
  });
