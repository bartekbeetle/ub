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
