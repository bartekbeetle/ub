import "dotenv/config";
import bcrypt from "bcryptjs";

async function getDb() {
  const url = process.env.DATABASE_URL;
  if (url && url.trim() !== "") {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const schema = await import("../src/db/schema");
    // Timeouty ratunkowe: bez nich seed potrafi wisieć w nieskończoność
    // (blokując `next start`). connectionTimeoutMillis = ile czekać na
    // połączenie z puli; statement_timeout = twardy limit na pojedyncze zapytanie.
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

async function main() {
  const { db, close, schema } = await getDb();
  const { users, trainers, courses, blogPosts, reviews, settings } = schema;
  const { sql } = await import("drizzle-orm");

  const existing = await db.select().from(users).limit(1);
  if (existing.length > 0) {
    console.log("Seed pominięty — baza już zawiera dane. (Usuń .pglite / wyczyść DB, żeby seedować od zera.)");
    await close();
    return;
  }

  // === ADMIN z env ===
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error("Brak ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD w env — nie mogę utworzyć konta admina.");
  }
  await db.insert(users).values({
    email: adminEmail,
    passwordHash: await bcrypt.hash(adminPassword, 12),
    role: "admin",
    mustChangePassword: true,
  });
  console.log(`✓ Admin: ${adminEmail} (wymuszona zmiana hasła przy 1. logowaniu)`);

  // === USTAWIENIA ===
  await db.insert(settings).values({ id: 1 });

  // === TRENERKI ===
  const [kasia, magda, ania, ewelina] = await db
    .insert(trainers)
    .values([
      {
        slug: "katarzyna-wisniewska",
        name: "Katarzyna Wiśniewska",
        email: "k.wisniewska@przyklad-akademia.pl",
        phone: "+48 512 384 291",
        bio: "Master trenerka makijażu permanentnego z 11-letnim doświadczeniem. Założycielka autorskiej akademii PMU w Katowicach. Wyszkoliła ponad 800 linergistek, z których wiele prowadzi dziś własne, dobrze prosperujące gabinety. Specjalizuje się w technikach ombre brows i lip blush. Jako jedna z pierwszych w Polsce wprowadziła szkolenia w pełni rozliczane z dofinansowań BUR — pomaga kursantkom przejść cały proces od wniosku po certyfikat.",
        specializations: ["PMU / Makijaż permanentny", "Medycyna estetyczna"],
        city: "Katowice",
        voivodeship: "slaskie",
        certificates: [
          { title: "Master Trainer PMU", description: "Międzynarodowy certyfikat trenerski PhiAcademy" },
          { title: "Certyfikat BUR / SUS 2.0", description: "Usługi rozwojowe z dofinansowaniem PARP" },
          { title: "Mistrzyni Polski PMU 2023", description: "I miejsce w kategorii ombre brows" },
        ],
        instagram: "https://instagram.com/kasia.pmu.academy",
        facebook: "https://facebook.com/kasiapmuacademy",
        rating: 49,
        reviewCount: 156,
        studentsCount: 847,
        billingModel: "per_lead",
        rate: 100,
        isActive: true,
      },
      {
        slug: "magdalena-kowalczyk",
        name: "Magdalena Kowalczyk",
        email: "kontakt@przyklad-magdabeauty.pl",
        phone: "+48 604 772 158",
        bio: "Stylistka rzęs i brwi, trenerka z 8-letnim stażem. Prowadzi butikowe studio szkoleniowe w Warszawie, gdzie stawia na małe grupy (max 4 osoby) i pracę na modelkach od pierwszego dnia. Jej kursantki chwalą przede wszystkim opiekę poszkoleniową — każda absolwentka ma 3 miesiące konsultacji online w cenie kursu.",
        specializations: ["PMU / Makijaż permanentny", "Kosmetologia"],
        city: "Warszawa",
        voivodeship: "mazowieckie",
        certificates: [
          { title: "Certyfikowana trenerka stylizacji rzęs", description: "Metody 1:1, 2D-8D, Mega Volume" },
          { title: "Certyfikat BUR", description: "Podmiot zarejestrowany w Bazie Usług Rozwojowych" },
        ],
        instagram: "https://instagram.com/magda.lashes.warsaw",
        rating: 48,
        reviewCount: 94,
        studentsCount: 412,
        billingModel: "per_lead",
        rate: 100,
        isActive: true,
      },
      {
        slug: "anna-nowakowska",
        name: "Anna Nowakowska",
        email: "szkolenia@przyklad-annanails.pl",
        phone: "+48 668 291 445",
        bio: "Mistrzyni stylizacji paznokci, sędzia mistrzostw nail art, trenerka od 2015 roku. W swojej pracowni w Krakowie szkoli od podstaw — od manicure hybrydowego po zaawansowane zdobienia i przedłużanie na formach. Absolwentki otrzymują komplet startowy produktów i wsparcie w wyposażeniu pierwszego stanowiska.",
        specializations: ["Stylizacja paznokci", "Manicure & Pedicure"],
        city: "Kraków",
        voivodeship: "malopolskie",
        certificates: [
          { title: "Sędzia międzynarodowa Nail Art", description: "Nailympion Poland" },
          { title: "Instruktorka stylizacji paznokci", description: "Dyplom mistrzowski w rzemiośle" },
        ],
        instagram: "https://instagram.com/anna.nails.krakow",
        website: "https://przyklad-annanails.pl",
        rating: 50,
        reviewCount: 78,
        studentsCount: 356,
        billingModel: "per_zapis",
        rate: 500,
        isActive: true,
      },
      {
        slug: "ewelina-zajac",
        name: "Ewelina Zając",
        email: "e.zajac@przyklad-estetica.pl",
        phone: "+48 725 118 903",
        bio: "Kosmetolożka z tytułem magistra, trenerka zabiegów z pogranicza kosmetologii i medycyny estetycznej. W swoim centrum szkoleniowym w Gliwicach uczy mezoterapii igłowej, stymulatorów tkankowych i profesjonalnej pielęgnacji anti-aging. Szkolenia prowadzi w kameralnych grupach z naciskiem na bezpieczeństwo procedur i aspekty prawne wykonywania zabiegów.",
        specializations: ["Medycyna estetyczna", "Kosmetologia", "Masaż"],
        city: "Gliwice",
        voivodeship: "slaskie",
        certificates: [
          { title: "Magister kosmetologii", description: "Śląski Uniwersytet Medyczny" },
          { title: "Certyfikat mezoterapii igłowej", description: "Szkolenie medyczne z zakresu iniekcji" },
          { title: "Certyfikat BUR / SUS 2.0" },
        ],
        facebook: "https://facebook.com/esteticagliwice",
        rating: 47,
        reviewCount: 61,
        studentsCount: 289,
        billingModel: "per_lead",
        rate: 100,
        isActive: true,
      },
    ])
    .returning();
  console.log("✓ 4 trenerki");

  // === KONTA LOGOWANIA TRENEREK (panel self-service) ===
  const { seedTrainerUsers } = await import("./seed-trainer-users-lib");
  const trainerAccounts = await seedTrainerUsers(db as never, schema);
  console.log(`✓ ${trainerAccounts.filter((a) => a.created).length} kont trenerek (hasło startowe: Trenerka!2026)`);

  // === OPINIE ===
  await db.insert(reviews).values([
    { trainerId: kasia.id, authorName: "Patrycja M.", rating: 5, content: "Najlepsza decyzja w moim życiu zawodowym. Kasia tłumaczy wszystko od podstaw, a po szkoleniu naprawdę umiałam zrobić brwi ombre od A do Z. Dofinansowanie z BUR załatwione praktycznie za mnie.", courseTitle: "Makijaż permanentny brwi — ombre & microblading" },
    { trainerId: kasia.id, authorName: "Sylwia K.", rating: 5, content: "Małe grupy, dużo praktyki na modelkach, zero owijania w bawełnę. Po kursie dostałam jeszcze 3 miesiące wsparcia online. Polecam każdej, która myśli o PMU na poważnie.", courseTitle: "Makijaż permanentny ust — lip blush" },
    { trainerId: kasia.id, authorName: "Joanna W.", rating: 4, content: "Bardzo intensywne szkolenie, momentami aż za dużo materiału na raz, ale dzięki skryptom wszystko dało się nadrobić. Atmosfera super, sprzęt z najwyższej półki.", courseTitle: "Makijaż permanentny brwi — ombre & microblading" },
    { trainerId: magda.id, authorName: "Karolina T.", rating: 5, content: "Magda ma anielską cierpliwość. Przyszłam kompletnie zielona, wyszłam z certyfikatem i pierwszą klientką umówioną jeszcze w trakcie kursu!", courseTitle: "Stylizacja rzęs od podstaw" },
    { trainerId: magda.id, authorName: "Natalia P.", rating: 5, content: "Szkolenie w 4-osobowej grupie to strzał w dziesiątkę — trenerka miała czas dla każdej z nas. Modelki zapewnione, materiały w cenie.", courseTitle: "Stylizacja rzęs od podstaw" },
    { trainerId: ania.id, authorName: "Weronika S.", rating: 5, content: "Ania to mistrzyni w każdym calu. Kurs przedłużania na formach zmienił moją pracę — klientki dopytują, gdzie się szkoliłam.", courseTitle: "Przedłużanie paznokci na formach" },
    { trainerId: ania.id, authorName: "Dominika R.", rating: 5, content: "Zaczynałam od zera, a dziś prowadzę własne stanowisko w salonie. Dofinansowanie pokryło całość kursu — bez tego nie byłoby mnie na to stać.", courseTitle: "Manicure hybrydowy od podstaw" },
    { trainerId: ewelina.id, authorName: "Aleksandra B.", rating: 5, content: "Ogromna wiedza merytoryczna, wszystko poparte medycznymi źródłami. Po kursie mezoterapii czuję się pewnie i bezpiecznie w gabinecie.", courseTitle: "Mezoterapia igłowa — kurs podstawowy" },
    { trainerId: ewelina.id, authorName: "Monika D.", rating: 4, content: "Solidne szkolenie z naciskiem na bezpieczeństwo. Jedyny minus to dojazd do Gliwic, ale było warto.", courseTitle: "Mezoterapia igłowa — kurs podstawowy" },
  ]);
  console.log("✓ Opinie");

  // === SZKOLENIA ===
  const in3weeks = new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
  const in4weeks = new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 10);
  const in5weeks = new Date(Date.now() + 35 * 86400000).toISOString().slice(0, 10);
  const in6weeks = new Date(Date.now() + 42 * 86400000).toISOString().slice(0, 10);

  await db.insert(courses).values([
    {
      slug: "makijaz-permanentny-brwi-ombre-microblading-katowice",
      title: "Makijaż permanentny brwi — ombre & microblading",
      category: "PMU / Makijaż permanentny",
      level: "Podstawowy",
      mode: "Stacjonarny",
      shortDescription: "Kompleksowy kurs PMU brwi od podstaw: technika ombre (cieniowanie) i microblading. 3 dni intensywnej praktyki na modelkach, certyfikat i wsparcie poszkoleniowe.",
      description: "Trzydniowe szkolenie stacjonarne, które prowadzi Cię od kompletnych podstaw do samodzielnego wykonania makijażu permanentnego brwi dwiema najpopularniejszymi technikami: ombre brows (cieniowanie maszynowe) oraz microblading (metoda piórkowa).\n\nPierwszy dzień to teoria: budowa skóry, kolorystyka i dobór pigmentów, wizaż i geometria brwi, zasady higieny i wymagania sanepidu. Drugi i trzeci dzień pracujesz na skórkach treningowych, a następnie na modelkach pod okiem trenerki.\n\nPo szkoleniu otrzymujesz certyfikat w języku polskim i angielskim, komplet materiałów oraz 3 miesiące konsultacji online.",
      program: [
        "Budowa i fizjologia skóry, przeciwwskazania do zabiegu",
        "Kolorystyka i pigmentologia — dobór koloru do typu urody",
        "Geometria i rysunek brwi — wizaż praktyczny",
        "Technika ombre brows krok po kroku (praca maszynką)",
        "Technika microblading — praca piórkiem manualnym",
        "Higiena pracy, wymogi sanepidu, dokumentacja klientki",
        "Praca na skórkach treningowych",
        "2 dni pracy na modelkach pod okiem trenerki",
        "Pielęgnacja pozabiegowa i wizyty korekcyjne",
        "Marketing usług PMU — jak zdobyć pierwsze klientki",
      ],
      includes: [
        "Certyfikat PL/EN honorowany w UE",
        "Skrypt szkoleniowy 120 stron",
        "Starter kit: maszynka treningowa, pigmenty, piórka",
        "Modelki zapewnione przez organizatora",
        "3 miesiące konsultacji online po kursie",
        "Catering w trakcie szkolenia",
      ],
      forWhom: "Kurs dla początkujących — nie potrzebujesz żadnego doświadczenia w branży beauty. Idealny dla kosmetyczek chcących rozszerzyć ofertę oraz osób planujących przebranżowienie.",
      price: 5900,
      subsidyPercent: 100,
      nextDate: in3weeks,
      totalSpots: 8,
      takenSpots: 5,
      durationHours: 24,
      city: "Katowice",
      voivodeship: "slaskie",
      imageUrl: "/images/pmu-brwi.jpg",
      trainerId: kasia.id,
      status: "opublikowane",
    },
    {
      slug: "makijaz-permanentny-ust-lip-blush-katowice",
      title: "Makijaż permanentny ust — lip blush",
      category: "PMU / Makijaż permanentny",
      level: "Średniozaawansowany",
      mode: "Stacjonarny",
      shortDescription: "Dwudniowe szkolenie z techniki lip blush dla linergistek chcących rozszerzyć ofertę o makijaż permanentny ust. Praca na modelkach, pigmentologia ust, korekta asymetrii.",
      description: "Szkolenie dedykowane osobom, które mają już podstawy pracy z maszynką PMU i chcą dodać do oferty najbardziej dochodową usługę — makijaż permanentny ust techniką lip blush.\n\nNauczysz się doboru pigmentu do naturalnego koloru ust, pracy z asymetrią, techniki cieniowania dającej efekt delikatnie podkreślonych ust oraz obsługi trudnych przypadków (usta po powiększaniu, blizny, przebarwienia).",
      program: [
        "Anatomia i fizjologia czerwieni wargowej",
        "Pigmentologia ust — neutralizacja sinych ust, dobór koloru",
        "Rysunek i korekta asymetrii",
        "Technika lip blush — cieniowanie całych ust",
        "Znieczulenia i komfort klientki podczas zabiegu",
        "Praca na modelkach — 2 pełne zabiegi",
        "Powikłania, opryszczka, pielęgnacja pozabiegowa",
      ],
      includes: [
        "Certyfikat PL/EN",
        "Zestaw pigmentów do ust (5 kolorów)",
        "Modelki zapewnione",
        "Konsultacje online 3 miesiące",
      ],
      forWhom: "Dla linergistek z podstawami PMU. Wymagane ukończone szkolenie podstawowe z makijażu permanentnego.",
      price: 4200,
      subsidyPercent: 100,
      nextDate: in5weeks,
      totalSpots: 6,
      takenSpots: 2,
      durationHours: 16,
      city: "Katowice",
      voivodeship: "slaskie",
      imageUrl: "/images/pmu-usta.jpg",
      trainerId: kasia.id,
      status: "opublikowane",
    },
    {
      slug: "stylizacja-rzes-od-podstaw-warszawa",
      title: "Stylizacja rzęs od podstaw — metoda 1:1 i objętościowa",
      category: "PMU / Makijaż permanentny",
      level: "Podstawowy",
      mode: "Stacjonarny",
      shortDescription: "Kurs stylizacji rzęs w kameralnej 4-osobowej grupie. Metoda klasyczna 1:1 oraz wprowadzenie do objętości 2D-3D. Warszawa, praca na modelkach od pierwszego dnia.",
      description: "Dwudniowy kurs stylizacji rzęs prowadzony w butikowym studiu w centrum Warszawy. Grupa maksymalnie 4-osobowa gwarantuje indywidualne podejście trenerki.\n\nOpanujesz aplikację metodą klasyczną 1:1, poznasz podstawy objętości 2D-3D, nauczysz się doboru skrętu, długości i grubości rzęs do oprawy oka klientki. Drugiego dnia pracujesz na dwóch modelkach.",
      program: [
        "Budowa i cykl wzrostu rzęs naturalnych",
        "BHP, alergie, patch testy",
        "Dobór rzęs: skręty, długości, grubości, mapping",
        "Aplikacja metodą klasyczną 1:1",
        "Wprowadzenie do metody objętościowej 2D-3D",
        "Praca na 2 modelkach pod okiem trenerki",
        "Pielęgnacja, uzupełnienia, demontaż",
      ],
      includes: [
        "Certyfikat ukończenia",
        "Zestaw startowy rzęs i klejów premium",
        "Modelki zapewnione",
        "3 miesiące konsultacji online",
      ],
      forWhom: "Dla początkujących bez doświadczenia. Kurs przygotowuje do samodzielnej pracy z klientkami od pierwszego tygodnia po szkoleniu.",
      price: 2800,
      subsidyPercent: 100,
      nextDate: in4weeks,
      totalSpots: 4,
      takenSpots: 1,
      durationHours: 16,
      city: "Warszawa",
      voivodeship: "mazowieckie",
      imageUrl: "/images/akademia-sala.jpg",
      trainerId: magda.id,
      status: "opublikowane",
    },
    {
      slug: "przedluzanie-i-laminacja-rzes-brwi-warszawa",
      title: "Laminacja rzęs i brwi z henną pudrową",
      category: "Kosmetologia",
      level: "Podstawowy",
      mode: "Stacjonarny",
      shortDescription: "Jednodniowe szkolenie łączone: laminacja rzęs, laminacja brwi i henna pudrowa. Trzy dochodowe usługi w jeden dzień, komplet produktów w cenie.",
      description: "Intensywne jednodniowe szkolenie, po którym dodasz do oferty trzy najchętniej rezerwowane usługi brow & lash: laminację rzęs, laminację brwi oraz koloryzację henną pudrową.\n\nSzkolenie w 100% praktyczne — po krótkim wprowadzeniu teoretycznym od razu przechodzisz do pracy na modelkach.",
      program: [
        "Analiza włosa i skóry, przeciwwskazania",
        "Laminacja rzęs krok po kroku",
        "Laminacja i stylizacja brwi",
        "Henna pudrowa — geometria i aplikacja",
        "Praca na 2 modelkach",
        "Cennik usług i rentowność zabiegów",
      ],
      includes: [
        "Certyfikat ukończenia",
        "Komplet produktów do laminacji (wystarcza na ok. 30 zabiegów)",
        "Modelki zapewnione",
      ],
      forWhom: "Dla początkujących oraz kosmetyczek rozszerzających ofertę.",
      price: 1900,
      subsidyPercent: 100,
      nextDate: in3weeks,
      totalSpots: 6,
      takenSpots: 3,
      durationHours: 8,
      city: "Warszawa",
      voivodeship: "mazowieckie",
      imageUrl: "/images/akademia-sala.jpg",
      trainerId: magda.id,
      status: "opublikowane",
    },
    {
      slug: "manicure-hybrydowy-od-podstaw-krakow",
      title: "Manicure hybrydowy od podstaw",
      category: "Manicure & Pedicure",
      level: "Podstawowy",
      mode: "Stacjonarny",
      shortDescription: "Dwudniowy kurs manicure hybrydowego dla początkujących: przygotowanie płytki, idealna aplikacja przy skórkach, trwałość 3-4 tygodnie. Kraków.",
      description: "Kurs, od którego większość stylistek zaczyna karierę w branży nail. W dwa dni nauczysz się profesjonalnego manicure hybrydowego: od przygotowania płytki metodą łączoną, przez perfekcyjną aplikację bazy przy skórkach, po zdobienia, które klientki kochają.\n\nPracujesz na własnej dłoni treningowej i na modelkach. Po kursie otrzymujesz zestaw startowy i rabaty u partnerów.",
      program: [
        "Anatomia paznokcia, choroby i przeciwwskazania",
        "Manicure łączony: frezarka + cążki",
        "Aplikacja hybrydy przy skórkach (baza, kolor, top)",
        "Opracowanie skórek i nawilżenie",
        "Proste zdobienia: french, babyboomer, ombre",
        "Praca na modelkach",
        "Dezynfekcja i sterylizacja narzędzi",
      ],
      includes: [
        "Certyfikat ukończenia",
        "Zestaw startowy (lampa, frezarka treningowa, hybrydy)",
        "Skrypt szkoleniowy",
        "Rabaty u partnerów na doposażenie stanowiska",
      ],
      forWhom: "Dla osób bez doświadczenia, które chcą zacząć zarabiać w branży nail — także dorywczo.",
      price: 2400,
      subsidyPercent: 100,
      nextDate: in4weeks,
      totalSpots: 8,
      takenSpots: 6,
      durationHours: 16,
      city: "Kraków",
      voivodeship: "malopolskie",
      imageUrl: "/images/akademia-sala.jpg",
      trainerId: ania.id,
      status: "opublikowane",
    },
    {
      slug: "przedluzanie-paznokci-na-formach-krakow",
      title: "Przedłużanie paznokci na formach — żel i akrylożel",
      category: "Stylizacja paznokci",
      level: "Średniozaawansowany",
      mode: "Stacjonarny",
      shortDescription: "Kurs przedłużania paznokci na formach dla stylistek znających podstawy. Architektura paznokcia, żel budujący i akrylożel, salonowe tempo pracy.",
      description: "Szkolenie dla stylistek, które opanowały manicure hybrydowy i chcą wejść na wyższy poziom — przedłużanie na formach to usługa, za którą klientki płacą 150-250 zł.\n\nNauczysz się prawidłowej architektury paznokcia, pracy żelem budującym i akrylożelem, a także jak skrócić czas zabiegu do salonowego tempa 2-2,5h.",
      program: [
        "Architektura paznokcia — apex, krzywa C, punkty stresu",
        "Dobór i zakładanie form",
        "Przedłużanie żelem budującym",
        "Przedłużanie akrylożelem (polygel)",
        "Opracowanie i modelowanie pilnikiem",
        "Praca na modelkach — pełna stylizacja",
        "Naprawy i uzupełnienia",
      ],
      includes: [
        "Certyfikat ukończenia",
        "Zestaw form i produktów do przedłużania",
        "Modelki zapewnione",
      ],
      forWhom: "Wymagana znajomość podstaw manicure hybrydowego (ukończony kurs podstawowy lub doświadczenie).",
      price: 3200,
      subsidyPercent: 100,
      nextDate: in6weeks,
      totalSpots: 6,
      takenSpots: 2,
      durationHours: 16,
      city: "Kraków",
      voivodeship: "malopolskie",
      imageUrl: "/images/akademia-sala.jpg",
      trainerId: ania.id,
      status: "opublikowane",
    },
    {
      slug: "mezoterapia-iglowa-kurs-podstawowy-gliwice",
      title: "Mezoterapia igłowa — kurs podstawowy",
      category: "Medycyna estetyczna",
      level: "Podstawowy",
      mode: "Stacjonarny",
      shortDescription: "Certyfikowany kurs mezoterapii igłowej twarzy, szyi i dekoltu. Aspekty prawne, bezpieczeństwo iniekcji, praca na modelkach. Gliwice.",
      description: "Jednodniowe, intensywne szkolenie z mezoterapii igłowej — jednego z najpopularniejszych zabiegów stymulujących skórę. Kurs prowadzony przez magistra kosmetologii z doświadczeniem klinicznym.\n\nProgram obejmuje pełną teorię iniekcji, farmakologię preparatów (koktajle witaminowe, kwas hialuronowy niesieciowany), aspekty prawne wykonywania zabiegów przez kosmetologów oraz praktykę na modelkach.",
      program: [
        "Anatomia twarzy — strefy bezpieczne i niebezpieczne",
        "Przeciwwskazania, wywiad i dokumentacja medyczna",
        "Preparaty do mezoterapii: skład, dobór, przechowywanie",
        "Techniki iniekcji: nappage, point by point, liniowa",
        "Mezoterapia twarzy, szyi, dekoltu i skóry głowy",
        "Powikłania i postępowanie awaryjne",
        "Aspekty prawne — co może kosmetolog",
        "Praca na modelkach",
      ],
      includes: [
        "Certyfikat PL/EN",
        "Preparaty i materiały jednorazowe na czas kursu",
        "Modelki zapewnione",
        "Wzory dokumentacji zabiegowej (RODO, zgody)",
      ],
      forWhom: "Dla kosmetologów, kosmetyczek i pielęgniarek. Wymagane min. wykształcenie kierunkowe lub doświadczenie w zabiegach kosmetycznych.",
      price: 3800,
      subsidyPercent: 100,
      nextDate: in4weeks,
      totalSpots: 6,
      takenSpots: 4,
      durationHours: 10,
      city: "Gliwice",
      voivodeship: "slaskie",
      imageUrl: "/images/medycyna-estetyczna.jpg",
      trainerId: ewelina.id,
      status: "opublikowane",
    },
    {
      slug: "stymulatory-tkankowe-kurs-zaawansowany-gliwice",
      title: "Stymulatory tkankowe — kurs zaawansowany",
      category: "Medycyna estetyczna",
      level: "Zaawansowany",
      mode: "Stacjonarny",
      shortDescription: "Zaawansowane szkolenie z podawania stymulatorów tkankowych. Dla osób po kursie mezoterapii. Najnowsze preparaty, techniki kaniulowe, praca na modelkach.",
      description: "Szkolenie dla praktykujących kosmetologów, które wprowadza do oferty zabiegi stymulatorami tkankowymi — obecnie najdynamiczniej rosnący segment zabiegów estetycznych w Polsce.\n\nPoznasz klasyfikację stymulatorów, protokoły zabiegowe najpopularniejszych preparatów oraz techniki podania igłą i kaniulą.",
      program: [
        "Klasyfikacja stymulatorów tkankowych",
        "Protokoły zabiegowe i łączenie preparatów",
        "Technika podania igłą i kaniulą 25G",
        "Strefy zabiegowe: twarz, szyja, dłonie",
        "Powikłania naczyniowe — profilaktyka i postępowanie",
        "Praca na modelkach",
      ],
      includes: ["Certyfikat PL/EN", "Preparaty na czas kursu", "Modelki zapewnione"],
      forWhom: "Wyłącznie dla osób z ukończonym kursem mezoterapii igłowej i praktyką iniekcyjną.",
      price: 6500,
      subsidyPercent: 85,
      nextDate: in6weeks,
      totalSpots: 4,
      takenSpots: 1,
      durationHours: 8,
      city: "Gliwice",
      voivodeship: "slaskie",
      imageUrl: "/images/medycyna-estetyczna.jpg",
      trainerId: ewelina.id,
      status: "opublikowane",
    },
    {
      slug: "masaz-twarzy-kobido-gliwice",
      title: "Masaż twarzy Kobido — japoński lifting bez skalpela",
      category: "Masaż",
      level: "Podstawowy",
      mode: "Stacjonarny",
      shortDescription: "Kurs japońskiego masażu liftingującego Kobido. Sekwencje klasyczne, techniki drenażu i liftingu. Zabieg, za który klientki płacą 200-350 zł.",
      description: "Dwudniowe szkolenie z masażu Kobido — japońskiej techniki liftingującej, która od kilku lat jest jednym z najczęściej wyszukiwanych zabiegów na twarz w Polsce.\n\nOpanujesz pełną, 90-minutową sekwencję zabiegową: od drenażu limfatycznego, przez intensywne techniki liftingujące, po akupresurę i pracę z tkanką głęboką.",
      program: [
        "Historia i filozofia masażu Kobido",
        "Anatomia mięśni twarzy i szyi",
        "Drenaż limfatyczny twarzy",
        "Techniki liftingujące i modelujące",
        "Akupresura punktów twarzy",
        "Pełna sekwencja zabiegowa 90 minut",
        "Praktyka w parach + na modelkach",
      ],
      includes: ["Certyfikat ukończenia", "Skrypt z sekwencjami zabiegowymi", "Kosmetyki na czas kursu"],
      forWhom: "Dla kosmetyczek, masażystek i osób początkujących — masaż nie wymaga wcześniejszego doświadczenia.",
      price: 2600,
      subsidyPercent: 100,
      nextDate: in5weeks,
      totalSpots: 8,
      takenSpots: 3,
      durationHours: 16,
      city: "Gliwice",
      voivodeship: "slaskie",
      imageUrl: "/images/medycyna-estetyczna.jpg",
      trainerId: ewelina.id,
      status: "opublikowane",
    },
  ]);
  console.log("✓ 9 szkoleń");

  // === BLOG ===
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);

  await db.insert(blogPosts).values([
    {
      slug: "jak-zdobyc-dofinansowanie-na-szkolenie-beauty-przewodnik",
      title: "Jak zdobyć dofinansowanie na szkolenie beauty? Kompletny przewodnik 2026",
      category: "Dofinansowania",
      excerpt: "Dofinansowanie do 100% na kurs PMU, rzęs czy paznokci? To nie ściema — to Baza Usług Rozwojowych. Wyjaśniamy krok po kroku, kto może skorzystać, ile realnie dostaniesz i jak złożyć wniosek, żeby nie odbił się od urzędniczego biurka.",
      content: "## Czym jest BUR i dlaczego to nie jest \"program dla bezrobotnych\"\n\nBaza Usług Rozwojowych (BUR) to ogólnopolska platforma prowadzona przez PARP, w której znajdziesz szkolenia objęte dofinansowaniem z Funduszy Europejskich. Najważniejsza rzecz, którą musisz wiedzieć: **BUR to nie urząd pracy**. Z dofinansowania możesz skorzystać, jeśli:\n\n- pracujesz na etacie,\n- studiujesz,\n- prowadzisz własną działalność,\n- jesteś mamą na urlopie macierzyńskim,\n- albo faktycznie jesteś osobą bezrobotną.\n\nWysokość dofinansowania zależy od województwa i operatora — w większości regionów to **80-100% ceny szkolenia**.\n\n## Krok 1: Wybierz szkolenie z BUR\n\nSzkolenie musi być opublikowane w Bazie Usług Rozwojowych przez certyfikowaną firmę szkoleniową. Wszystkie kursy dostępne na Uniwersytet Beauty prowadzą trenerki zarejestrowane w BUR — dzięki temu masz pewność, że dofinansowanie będzie możliwe.\n\n## Krok 2: Znajdź operatora w swoim województwie\n\nKażde województwo ma operatorów regionalnych, którzy przyjmują wnioski i wypłacają środki. Różnią się limitem kwotowym (zwykle 5 000 - 10 000 zł na osobę) i poziomem dofinansowania.\n\n## Krok 3: Złóż wniosek PRZED zapisem na kurs\n\nNajczęstszy błąd: najpierw zapis i wpłata, potem wniosek. **Kolejność musi być odwrotna** — najpierw wniosek do operatora, po jego akceptacji zapis przez BUR.\n\n## Krok 4: Zrealizuj szkolenie i rozlicz\n\nPo szkoleniu wypełniasz ankietę w BUR i dostarczasz operatorowi fakturę. Zwrot środków trafia na Twoje konto zwykle w ciągu 14-30 dni.\n\n## Nie chcesz przechodzić przez to sama?\n\nW Uniwersytet Beauty przeprowadzamy Cię przez cały proces — od wyboru kursu, przez wniosek, po rozliczenie. [Umów bezpłatną konsultację](/konsultacja) i sprawdź, ile dofinansowania możesz dostać w swoim województwie.",
      imageUrl: "/images/akademia-sala.jpg",
      metaTitle: "Dofinansowanie na szkolenie beauty 2026 — przewodnik BUR krok po kroku",
      metaDescription: "Jak dostać do 100% dofinansowania na kurs PMU, rzęs lub paznokci z Bazy Usług Rozwojowych? Przewodnik krok po kroku: kto może skorzystać, wnioski, terminy.",
      author: "Redakcja Uniwersytet Beauty",
      readingMinutes: 8,
      status: "opublikowane",
      publishedAt: daysAgo(4),
    },
    {
      slug: "ile-zarabia-linergistka-w-polsce",
      title: "Ile zarabia linergistka w Polsce? Realne stawki 2026",
      category: "Kariera w Beauty",
      excerpt: "Makijaż permanentny brwi kosztuje klientkę 800-1500 zł, a doświadczona linergistka przyjmuje 2-4 klientki dziennie. Policzyłyśmy realne zarobki na różnych etapach kariery — od świeżo po kursie do własnego gabinetu.",
      content: "## Stawki za zabiegi PMU w 2026 roku\n\nCeny makijażu permanentnego w Polsce różnią się w zależności od miasta i renomy linergistki:\n\n- **Brwi ombre / microblading:** 800-1500 zł (Warszawa, Kraków, Trójmiasto) / 600-1000 zł (mniejsze miasta)\n- **Usta lip blush:** 900-1600 zł\n- **Kreska międzyrzęsowa:** 500-900 zł\n- **Korekta roczna:** 300-600 zł\n\n## Pierwsze 6 miesięcy po kursie\n\nZaczynasz od cen promocyjnych (400-600 zł za brwi), budując portfolio. Przy 10-15 zabiegach miesięcznie to **5 000 - 8 000 zł przychodu**. Po odjęciu kosztów pigmentów i igieł (ok. 50-80 zł na zabieg) oraz wynajmu stanowiska zostaje ok. 3 500 - 6 000 zł.\n\n## Po roku praktyki\n\nPełny cennik, stali klienci z polecen i 20-35 zabiegów miesięcznie dają **15 000 - 30 000 zł przychodu**. To moment, w którym większość linergistek przechodzi na własny gabinet.\n\n## Co decyduje o zarobkach?\n\n1. **Jakość szkolenia bazowego** — poprawki po słabych kursach kosztują więcej niż dobry kurs\n2. **Portfolio i Instagram** — klientki wybierają oczami\n3. **Miasto i lokal** — ale PMU to usługa, na którą klientki przyjeżdżają nawet 100 km\n4. **Dosprzedaż** — korekty roczne to stały, przewidywalny przychód\n\n## Jak zacząć bez 6 000 zł na kurs?\n\nWłaśnie po to istnieje dofinansowanie z BUR — kurs PMU, który normalnie kosztuje 5 900 zł, możesz zrobić **za 0 zł**. [Sprawdź kursy PMU z dofinansowaniem](/kursy?kategoria=PMU+%2F+Makija%C5%BC+permanentny).",
      imageUrl: "/images/pmu-brwi.jpg",
      metaTitle: "Ile zarabia linergistka w Polsce? Realne stawki i zarobki PMU 2026",
      metaDescription: "Realne zarobki linergistki w 2026: stawki za brwi ombre, lip blush, przychody na start i po roku praktyki. Sprawdź, ile można zarobić na PMU.",
      author: "Redakcja Uniwersytet Beauty",
      readingMinutes: 6,
      status: "opublikowane",
      publishedAt: daysAgo(9),
    },
    {
      slug: "bur-nie-tylko-dla-bezrobotnych-5-mitow",
      title: "BUR nie tylko dla bezrobotnych — obalamy 5 mitów o dofinansowaniach",
      category: "Dofinansowania",
      excerpt: "\"Muszę być bezrobotna\", \"to trwa pół roku\", \"i tak nie dostanę\". Sprawdzamy najczęstsze mity o dofinansowaniach na szkolenia beauty — i pokazujemy, jak jest naprawdę.",
      content: "## Mit 1: \"Dofinansowania są tylko dla bezrobotnych\"\n\n**Fałsz.** To najczęstszy mit, przez który tysiące kobiet w ogóle nie składa wniosków. Dofinansowania z BUR są dostępne dla osób pracujących, studentek, przedsiębiorczyń i mam na urlopach macierzyńskich. Status bezrobotnej NIE jest wymagany — a w wielu programach osoby pracujące mają wręcz pierwszeństwo.\n\n## Mit 2: \"Załatwienie dofinansowania trwa pół roku\"\n\n**Fałsz.** Standardowy czas od złożenia wniosku do decyzji operatora to **2-4 tygodnie**. Cały proces — od wniosku do rozpoczęcia kursu — zamyka się zwykle w 4-6 tygodni.\n\n## Mit 3: \"Papierologia jest nie do przejścia\"\n\n**Częściowo prawda, ale...** Wniosek wymaga kilku dokumentów i znajomości systemu BUR. Dlatego dobre firmy szkoleniowe (i my) pomagają w całym procesie — od założenia konta w BUR po rozliczenie. Ty wybierasz kurs, my prowadzimy Cię przez formalności.\n\n## Mit 4: \"Dofinansowanie pokrywa tylko część kursu\"\n\n**Zależy od województwa.** W większości regionów poziom dofinansowania to 80-95%, a dla wybranych grup (np. kobiety 50+, osoby z niepełnosprawnościami, niskie kwalifikacje) — **do 100%**. Przy kursie za 5 900 zł nawet 80% oznacza, że płacisz tylko 1 180 zł.\n\n## Mit 5: \"Środki się już skończyły\"\n\n**Fałsz.** Nabory operatorów otwierają się cyklicznie przez cały rok. Perspektywa finansowa UE 2021-2027 gwarantuje środki na usługi rozwojowe do końca 2027 roku. Jeśli w Twoim województwie nabór jest chwilowo zamknięty — zapisujemy Cię na listę i informujemy o starcie kolejnego.\n\n## Sprawdź swoje dofinansowanie\n\nWypełnij [krótki formularz](/konsultacja), a bezpłatnie sprawdzimy, jaki poziom dofinansowania przysługuje Ci w Twoim województwie.",
      imageUrl: "/images/medycyna-estetyczna.jpg",
      metaTitle: "BUR nie tylko dla bezrobotnych — 5 mitów o dofinansowaniach na szkolenia",
      metaDescription: "Czy dofinansowanie na szkolenie beauty wymaga statusu bezrobotnej? Ile trwa wniosek do BUR? Obalamy 5 najczęstszych mitów o dofinansowaniach.",
      author: "Redakcja Uniwersytet Beauty",
      readingMinutes: 5,
      status: "opublikowane",
      publishedAt: daysAgo(14),
    },
    {
      slug: "microblading-czy-ombre-brows-co-wybrac",
      title: "Microblading czy ombre brows? Którą technikę PMU wybrać na start",
      category: "Poradniki",
      excerpt: "Dwie najpopularniejsze techniki makijażu permanentnego brwi różnią się narzędziem, efektem i trwałością. Podpowiadamy, którą wybrać jako pierwszą — z perspektywy przyszłej linergistki, nie klientki.",
      content: "## Czym się różnią te techniki?\n\n**Microblading** to metoda manualna — piórkiem z mikroostrzami rysujesz pojedyncze włoski. Efekt jest hipernaturalny, ale technika wymaga świetnej ręki i lepiej trzyma się na skórze normalnej i suchej.\n\n**Ombre brows** (cieniowanie) wykonuje się maszynką — efekt przypomina delikatnie wycieniowane brwi po makijażu. Technika bardziej uniwersalna: działa na każdym typie skóry, także tłustej i dojrzałej.\n\n## Rynek: czego chcą klientki w 2026?\n\nTrend od kilku lat jest jednoznaczny — **ombre brows wypiera microblading**. Powody:\n\n- trwałość: ombre utrzymuje się 2-3 lata vs 1-1,5 roku przy microbladingu,\n- mniejsze ryzyko rozmycia pigmentu na skórze tłustej,\n- łatwiejsza korekta.\n\nW dużych miastach ok. 70-80% zabiegów brwi to obecnie cieniowanie maszynowe.\n\n## Która technika jest łatwiejsza do nauki?\n\nParadoksalnie — **ombre brows**. Praca maszynką jest bardziej powtarzalna i wybacza więcej niż piórko. Microblading wymaga miesięcy treningu na skórkach, zanim efekty będą stabilne.\n\n## Nasza rekomendacja\n\nJeśli zaczynasz od zera: wybierz **kurs łączony** (ombre + microblading). Ombre będzie Twoją główną usługą, a microblading pozwoli obsłużyć klientki, które świadomie chcą metody włoskowej.\n\n[Zobacz kurs PMU brwi ombre & microblading z dofinansowaniem do 100%](/kurs/makijaz-permanentny-brwi-ombre-microblading-katowice).",
      imageUrl: "/images/pmu-brwi.jpg",
      metaTitle: "Microblading czy ombre brows — którą technikę PMU wybrać na start?",
      metaDescription: "Porównanie microbladingu i ombre brows z perspektywy przyszłej linergistki: trwałość, trudność nauki, trendy rynkowe 2026 i nasza rekomendacja.",
      author: "Redakcja Uniwersytet Beauty",
      readingMinutes: 5,
      status: "opublikowane",
      publishedAt: daysAgo(21),
    },
    {
      slug: "przebranzowienie-na-beauty-po-30-od-czego-zaczac",
      title: "Przebranżowienie na beauty po 30-tce — od czego zacząć?",
      category: "Kariera w Beauty",
      excerpt: "Etat Cię wypala, a branża beauty kusi wolnością i zarobkami? Coraz więcej kobiet po 30-tce zmienia zawód na stylizację paznokci, rzęsy czy PMU. Oto realistyczny plan przebranżowienia — bez rzucania pracy z dnia na dzień.",
      content: "## Dlaczego akurat beauty?\n\nBranża usług kosmetycznych w Polsce rośnie nieprzerwanie od dekady i jest wyjątkowo odporna na kryzysy. Do tego daje coś, czego etat nie da nigdy: **elastyczny grafik i sufit zarobków zależny od Ciebie**, nie od widełek w korporacji.\n\n## Plan przebranżowienia w 4 krokach\n\n### 1. Wybierz specjalizację (nie \"wszystko naraz\")\n\nNajczęstsze ścieżki na start:\n\n- **Stylizacja paznokci** — najniższy próg wejścia, kurs od ok. 2 400 zł, szybki start\n- **Stylizacja rzęs** — kurs od ok. 2 800 zł, wysokie stawki za objętości\n- **PMU** — najwyższy próg (kurs ok. 5 000 - 6 500 zł), ale i najwyższe zarobki\n\n### 2. Zdobądź dofinansowanie zamiast wydawać oszczędności\n\nTu wchodzi BUR: jako osoba **pracująca** masz pełne prawo do dofinansowania 80-100% na certyfikowane szkolenie. Kurs, nie ruszając oszczędności.\n\n### 3. Pierwsze klientki równolegle z etatem\n\nWieczory i weekendy przez pierwsze 3-6 miesięcy: budujesz portfolio, Instagram i bazę klientek. Kiedy przychód z beauty sięga 60-70% pensji — czas na decyzję.\n\n### 4. Własna działalność\n\nWynajem stanowiska w istniejącym salonie (800-1500 zł/mies.) to najbezpieczniejszy start — bez inwestowania w lokal.\n\n## Najważniejsza rada\n\nNie oszczędzaj na szkoleniu bazowym. Poprawianie złych nawyków po tanim kursie kosztuje więcej niż porządne szkolenie z certyfikatem. [Przejrzyj certyfikowane kursy z dofinansowaniem](/kursy) — wszystkie prowadzą trenerki zarejestrowane w BUR.",
      imageUrl: "/images/akademia-sala.jpg",
      metaTitle: "Przebranżowienie na beauty po 30 — realistyczny plan krok po kroku",
      metaDescription: "Jak zmienić zawód na branżę beauty po 30-tce: wybór specjalizacji, dofinansowanie kursu z BUR, pierwsze klientki i przejście z etatu na swoje.",
      author: "Redakcja Uniwersytet Beauty",
      readingMinutes: 7,
      status: "opublikowane",
      publishedAt: daysAgo(28),
    },
    {
      slug: "trendy-beauty-2026-jakie-uslugi-beda-zarabiac",
      title: "Trendy beauty 2026: na jakich usługach zarobisz najwięcej",
      category: "Trendy",
      excerpt: "Stymulatory tkankowe, masaż Kobido, laminacja 2.0 — sprawdzamy, które usługi rosną najszybciej i w co warto inwestować swoje szkoleniowe złotówki (albo dofinansowanie) w 2026 roku.",
      content: "## 1. Stymulatory tkankowe — lider wzrostów\n\nZabiegi stymulujące produkcję kolagenu to najdynamiczniej rosnący segment estetyki. Klientki odchodzą od \"wypełniania\" na rzecz naturalnej poprawy jakości skóry. Ceny zabiegów: 800-1800 zł, a kalendarz dobrych gabinetów jest zapełniony na tygodnie do przodu.\n\n**Dla kogo:** kosmetolożki z doświadczeniem iniekcyjnym.\n\n## 2. Masaż Kobido — hit wśród usług bezinwazyjnych\n\n\"Lifting bez skalpela\" przyciąga klientki, które boją się igieł. Zabieg za 200-350 zł, niski koszt wejścia (kurs ok. 2 600 zł, zero drogiego sprzętu) i ogromna powtarzalność — klientki wracają co 2-4 tygodnie.\n\n**Dla kogo:** idealny start dla początkujących.\n\n## 3. PMU ust (lip blush) — przegania brwi\n\nBrwi to wciąż największy rynek PMU, ale to usta rosną najszybciej. Naturalne, delikatnie podkreślone usta to efekt \"clean girl\", którego chcą klientki 20-35 lat.\n\n## 4. Laminacja rzęs i brwi — mały koszt, stały dochód\n\nUsługa \"wejściowa\", która buduje bazę klientek: zabieg 150-250 zł, 45 minut pracy, produkty za ok. 20 zł. Świetna dosprzedaż do każdej innej usługi brow & lash.\n\n## W co zainwestować dofinansowanie?\n\nJeśli zaczynasz: **Kobido albo laminacja + rzęsy** (niski próg, szybki zwrot). Jeśli masz doświadczenie: **stymulatory tkankowe** — to tam płynie rynek premium. [Sprawdź terminy szkoleń z dofinansowaniem](/kursy).",
      imageUrl: "/images/medycyna-estetyczna.jpg",
      metaTitle: "Trendy beauty 2026 — na jakich usługach zarobisz najwięcej",
      metaDescription: "Stymulatory tkankowe, Kobido, lip blush, laminacja — analiza usług beauty z największym potencjałem zarobkowym w 2026 i wskazówki, w co zainwestować.",
      author: "Redakcja Uniwersytet Beauty",
      readingMinutes: 6,
      status: "opublikowane",
      publishedAt: daysAgo(35),
    },
  ]);
  console.log("✓ 6 postów blogowych");

  // sanity: policz
  const [{ c: tc }] = await db.select({ c: sql<number>`count(*)::int` }).from(trainers);
  const [{ c: cc }] = await db.select({ c: sql<number>`count(*)::int` }).from(courses);
  const [{ c: bc }] = await db.select({ c: sql<number>`count(*)::int` }).from(blogPosts);
  console.log(`\nSeed zakończony: ${tc} trenerki, ${cc} szkoleń, ${bc} postów.`);
  await close();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Błąd seeda:", err);
    process.exit(1);
  });
