import "dotenv/config";

/**
 * Content-as-code: realne wpisy blogowe (klaster SEO).
 *
 * Idempotentny — upsert po slugu. Odpalaj ile chcesz, nie duplikuje i nie
 * kasuje demo-seeda (scripts/seed.ts). Nowy wpis = dopisz obiekt do POSTS
 * i odpal: npm run db:seed-blog
 *
 * Lokalnie (DATABASE_URL puste) leci na PGlite (./.pglite), na prod na Postgres.
 */

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

type SeedPost = {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  content: string;
  imageUrl: string | null;
  metaTitle: string;
  metaDescription: string;
  author: string;
  readingMinutes: number;
  status: "opublikowane" | "szkic";
  publishedAt: Date;
};

// ── PILLAR A #1 ────────────────────────────────────────────────────────────
const POST_A1_CONTENT = `Jeśli szukasz w Google „jak zdobyć zawód beauty z dofinansowaniem", pewnie już gdzieś przeczytałaś, że kurs możesz mieć „za darmo". I pewnie coś Ci w tym nie zagrało. Słusznie. W większości przypadków nie dostajesz szkolenia za zero złotych - dostajesz zwrot 80-90% jego ceny, a resztę dopłacasz z własnej kieszeni. To wciąż różnica między kilkuset złotymi a kilkoma tysiącami, więc gra jest warta świeczki. Ale zacznijmy od prawdy, nie od hasła z reklamy.

Ten przewodnik pokazuje całą ścieżkę: dlaczego beauty to sensowny kierunek na przekwalifikowanie, skąd realnie biorą się pieniądze na kurs, jakie zawody możesz zdobyć i - najważniejsze - ile naprawdę dopłacisz. Bez ściemy o „darmowych" kursach dla każdego.

## Dlaczego beauty to dobry zawód na przekwalifikowanie w 2026

Wejście do zawodu w beauty jest tańsze i szybsze niż w większości branż, które dają podobne zarobki. Nie potrzebujesz trzech lat studiów ani dyplomu uczelni. Dobry kurs PMU, stylizacji rzęs czy paznokci to kwestia od kilku dni do kilku tygodni, a po nim możesz zacząć przyjmować pierwsze klientki.

Zarobki? Realnie zależą od miasta, techniki i tego, ile pracy włożysz w zbudowanie klientek. Stylistka rzęs w średnim mieście liczy sobie za aplikację 120-200 zł, a jedna klientka wraca co 3-4 tygodnie na uzupełnienie. Linergistka (makijaż permanentny) bierze za zabieg brwi 500-900 zł. Policz sobie, ile takich zabiegów mieści się w tygodniu, kiedy masz już stały grafik. To nie są kokosy z dnia na dzień, ale to zawód, w którym sama ustalasz ceny i sama decydujesz, kiedy pracujesz.

Druga rzecz to elastyczność. Możesz pracować na etacie i przyjmować klientki po godzinach. Możesz wynająć jedno stanowisko w cudzym salonie, zamiast od razu otwierać własny lokal. Możesz robić zabiegi mobilnie, u klientek w domu. Dla wielu kobiet - zwłaszcza mam, które chcą wrócić do pracy na własnych warunkach - to jest ten haczyk. Nie musisz od razu rzucać wszystkiego. Zaczynasz obok tego, co już masz.

I ten niski próg wejścia robi się jeszcze niższy, kiedy dorzucisz do tego dofinansowanie.

## Skąd wziąć pieniądze na szkolenie - BUR, KFS, EFS+ w pigułce

Są trzy główne źródła, z których finansuje się kursy zawodowe w Polsce. Nazwy brzmią jak urzędowa zupa liter, więc rozłożę je po ludzku.

**BUR (Baza Usług Rozwojowych)** to publiczna platforma prowadzona przez PARP, na której certyfikowane firmy szkoleniowe wystawiają swoje kursy. Przez BUR płynie dofinansowanie z funduszy unijnych, rozdzielane regionalnie przez operatorów w każdym województwie. To najczęstsza droga dla osoby, która chce się przekwalifikować i sama szuka kursu. Zwykle pokrywa 80-90% ceny.

**KFS (Krajowy Fundusz Szkoleniowy)** to pieniądze dla osób już zatrudnionych, w tym dla Ciebie, jeśli pracujesz na umowę, i dla pracodawców, którzy chcą doszkolić zespół. W części przypadków KFS finansuje nawet 100% kosztów kursu (dla mikroprzedsiębiorstw) albo 80% (dla większych). Wniosek składa pracodawca, więc ta ścieżka działa, gdy masz szefa gotowego to podpisać - albo gdy sama prowadzisz działalność.

**EFS+ (Europejski Fundusz Społeczny Plus)** to szersze źródło unijne, z którego finansowane są programy regionalne - często właśnie te dystrybuowane przez BUR. W praktyce, jako kursantka, najczęściej zetkniesz się z EFS+ pod szyldem „projekt dofinansowany ze środków Unii Europejskiej" przy konkretnym naborze w Twoim województwie.

Dla większości kobiet, które piszą do nas z pytaniem o zawód w beauty od zera, właściwą drogą jest BUR. I tu pojawia się mit, który trzeba obalić.

### BUR to nie urząd pracy - komu naprawdę się to należy

Najczęstsze przekonanie brzmi tak: „dofinansowanie jest dla bezrobotnych, a ja pracuję, więc mi się nie należy". To nieprawda i przez to nieporozumienie mnóstwo kobiet nawet nie sprawdza, czy kwalifikuje się do zwrotu.

Dofinansowanie z BUR nie jest zarezerwowane dla osób zarejestrowanych w urzędzie pracy. W większości regionalnych naborów mogą z niego korzystać osoby pracujące na etacie, prowadzące działalność, studentki, a w wielu projektach szczególnie zachęca się mamy wracające na rynek pracy i osoby po 30. czy 45. roku życia. Zasady różnią się między województwami i konkretnymi naborami - jeden operator kieruje program do osób o niskich kwalifikacjach, inny do mieszkańców konkretnego powiatu, jeszcze inny do kobiet planujących zmianę zawodu.

<!-- TODO wewnętrzny link: [komu należy się dofinansowanie z BUR] → podtemat „BUR ≠ urząd pracy - kto się kwalifikuje" (brief 2/3) -->

Dlatego jedynej sensownej odpowiedzi na pytanie „czy mnie to obejmuje?" nie da się napisać w artykule. Trzeba sprawdzić Twoją sytuację pod aktualne nabory w Twoim regionie. Zajmuje to dosłownie chwilę - wróć do tego na końcu, przy teście kwalifikacji.

## Jakie zawody beauty możesz zdobyć z dofinansowaniem

Przez BUR finansuje się właściwie cały przekrój kursów beauty. Cztery kierunki, o które pytają najczęściej:

**Makijaż permanentny (PMU).** Najbardziej dochodowy z tej listy i dlatego najczęściej wybierany przez kobiety, które traktują przekwalifikowanie poważnie, jako nowy zawód, a nie dodatek. Pełne szkolenie PMU od podstaw to zwykle kilka tysięcy złotych, więc tu dofinansowanie robi największą różnicę w portfelu.

<!-- TODO wewnętrzny link: [kurs PMU z dofinansowaniem] → podtemat „Kurs makijażu permanentnego z dofinansowaniem" (brief 4) -->

**Stylizacja rzęs.** Niższy próg wejścia, szybki start, klientki wracają regularnie co kilka tygodni - dobry pierwszy zawód, jeśli chcesz sprawdzić, czy praca z klientką „na fotelu" w ogóle Ci leży.

<!-- TODO wewnętrzny link: [kurs stylizacji rzęs z dofinansowaniem] → podtemat „Kurs rzęs z dofinansowaniem" (brief 5) -->

**Stylizacja i laminacja brwi.** Często łączona z rzęsami albo z PMU. Krótkie szkolenia, tanie w wejściu, łatwo dosprzedać istniejącym klientkom.

<!-- TODO wewnętrzny link: [kurs brwi z dofinansowaniem] → podtemat „Kursy brwi z dofinansowaniem" (brief 6) -->

**Stylizacja paznokci (manicure).** Klasyka, największy rynek, ale i największa konkurencja. Dobry wybór, jeśli lubisz precyzyjną pracę i chcesz zawodu z przewidywalnym, stałym popytem.

Nie musisz wybierać jednego na całe życie. Wiele osób zaczyna od tańszego kursu (rzęsy albo brwi), buduje pierwszą bazę klientek, a po roku dokłada PMU z drugiego dofinansowania. Każdy z tych kierunków ma osobne szkolenia dostępne w BUR - do której grupy Ci bliżej, zależy od tego, czy wolisz szybki start czy od razu celujesz w najwyższą stawkę za zabieg.

## Ścieżka krok po kroku: od pomysłu do zapisu na kurs

Cały proces, od decyzji do pierwszego dnia szkolenia, wygląda mniej więcej tak:

1. **Sprawdzasz swoją kwalifikowalność.** Zanim wybierzesz kurs, ustal, czy i na jakich zasadach należy Ci się dofinansowanie w Twoim województwie. Bez tego reszta to wróżenie z fusów.
2. **Wybierasz zawód i trenerkę.** Znajdujesz certyfikowaną trenerkę albo firmę szkoleniową, która ma kurs wpisany do Bazy Usług Rozwojowych. Kurs spoza BUR nie łapie się na to dofinansowanie - to warunek konieczny.
3. **Składasz wniosek u operatora.** Kontaktujesz się z regionalnym operatorem programu i przechodzisz przez formalności: dokumenty, kwalifikacja do projektu, umowa. Brzmi groźnie, w praktyce to kilka papierów.
4. **Zapisujesz się na kurs i dopłacasz wkład własny.** Rezerwujesz miejsce, wpłacasz swoją część (o tym za chwilę), operator pokrywa resztę bezpośrednio szkoleniu albo zwraca Ci ją po zakończeniu.
5. **Kończysz szkolenie i zaczynasz przyjmować klientki.** Certyfikat w ręce, pierwsze modelki, budowanie grafiku.

<!-- TODO wewnętrzny link: [ścieżka krok po kroku do kursu z BUR] → podtemat „Jak zapisać się na kurs z dofinansowaniem - krok po kroku" (brief X) -->

Najczęściej ludzie zacinają się na kroku pierwszym - bo nie wiedzą, gdzie sprawdzić, albo z góry zakładają, że im się nie należy. Tymczasem to krok, który zajmuje najmniej czasu i przesądza o całej reszcie.

## Ile realnie dopłacasz - mit „za darmo" kontra prawda o refundacji

Tu jest mięso, dla którego pewnie tu trafiłaś.

Wyobraź sobie, że kurs stylizacji rzęs kosztuje 1800 zł. Przy standardowym dofinansowaniu z BUR na poziomie 80-90% operator pokrywa 1440-1620 zł, a Ty dokładasz z własnej kieszeni 180-360 zł. Przy droższym szkoleniu PMU za 5000 zł Twój wkład własny to zwykle 500-1000 zł. Zamiast pięciu tysięcy płacisz kilkaset złotych. To jest ta prawdziwa liczba - nie zero, ale ułamek ceny rynkowej.

Skąd biorą się reklamy krzyczące „kurs za 0 zł"? Z dwóch źródeł. Po pierwsze, istnieją nabory, w których dofinansowanie sięga 100% - najczęściej przez KFS dla osób zatrudnionych w mikrofirmach albo w wybranych projektach EFS+ skierowanych do konkretnych grup (na przykład osób z niskimi kwalifikacjami czy w trudnej sytuacji na rynku pracy). To realne przypadki, ale rzadkie i obwarowane warunkami. Po drugie, część reklam po prostu naciąga - pokazuje najlepszy możliwy scenariusz jako regułę, a potem okazuje się, że jednak trzeba dopłacić.

Mechanizm zwrotu też warto rozumieć, bo bywa różny. W jednym modelu płacisz szkoleniu tylko swój wkład własny, a operator rozlicza resztę bezpośrednio z firmą szkoleniową - nie wykładasz pełnej kwoty. W innym modelu (spotykanym częściej przy KFS przez pracodawcę) najpierw finansowana jest całość, a Twój udział jest zerowy albo minimalny. Który wariant Cię dotyczy, zależy od konkretnego naboru i operatora. Dlatego zawsze pytaj o to na etapie składania wniosku - „ile realnie zapłacę z własnej kieszeni i kiedy" to pierwsze pytanie, jakie powinnaś zadać.

Podejdźmy do tego uczciwie: dofinansowanie nie robi z kursu prezentu. Robi z niego wydatek, na który stać znacznie więcej kobiet, niż myśli, że je stać. Kilkaset złotych za zawód, który potrafi zwrócić się po kilku pierwszych klientkach - to jest właściwa rama, w której warto o tym myśleć. Nie „darmo", tylko „opłacalnie".

## Sprawdź, czy należy Ci się dofinansowanie

Cały ten artykuł prowadzi do jednej rzeczy, którą naprawdę warto zrobić: sprawdzić Twoją własną sytuację. Nie przez godzinę czytania regulaminów operatorów, tylko przez krótki test.

**Sprawdź w 2 minuty, czy należy Ci się dofinansowanie na kurs beauty.** Odpowiadasz na kilka pytań o swoją sytuację - czy pracujesz, w jakim jesteś województwie, jaki kierunek Cię interesuje - a my dopasowujemy Cię do trenerki i naboru, w którym możesz się załapać na zwrot. Bez opłat za samo sprawdzenie i bez zobowiązania.

👉 [Wypełnij test kwalifikacji na uniwersytetbeauty.pl](https://uniwersytetbeauty.pl)

Jeśli okaże się, że się kwalifikujesz - masz gotową ścieżkę i trenerkę. Jeśli nie teraz - przynajmniej wiesz, na czym stoisz, zamiast rezygnować z zawodu przez mit, że „dofinansowanie jest tylko dla bezrobotnych".

## Najczęstsze pytania

**Czy dostanę kurs beauty całkowicie za darmo?**
Najczęściej nie - standardowo dopłacasz 10-20% ceny, czyli od kilkuset złotych. Pełne 100% zdarza się w wybranych naborach (m.in. KFS dla zatrudnionych w mikrofirmach), ale to wyjątek, nie reguła. Realny przekaz: kilkaset złotych zamiast kilku tysięcy.

**Czy dofinansowanie należy się, jeśli pracuję na etacie?**
Tak, w większości regionalnych naborów BUR osoby pracujące się kwalifikują. Dofinansowanie nie jest zarezerwowane dla bezrobotnych - to jedno z najczęstszych nieporozumień. Warunki zależą od województwa, dlatego trzeba sprawdzić konkretny nabór.

**Ile trwa zdobycie zawodu w beauty od zera?**
Od kilku dni (podstawowy kurs rzęs czy brwi) do kilku tygodni (pełne szkolenie PMU od podstaw). Po ukończeniu i pierwszych modelkach możesz zacząć przyjmować płacące klientki.

**Czy każdy kurs łapie się na dofinansowanie z BUR?**
Nie. Szkolenie musi być wpisane do Bazy Usług Rozwojowych przez certyfikowaną firmę albo trenerkę. Kurs spoza BUR możesz zrobić, ale bez zwrotu z tego programu.

**Od czego zacząć, jeśli dopiero rozważam zmianę zawodu?**
Od sprawdzenia kwalifikowalności, zanim wybierzesz kurs. To krok, który zajmuje najmniej, a decyduje o całej reszcie - wypełnij test kwalifikacji i zobacz, czy i na jakich zasadach możesz dostać dofinansowanie w swoim regionie.
`;

const POSTS: SeedPost[] = [
  {
    slug: "zawod-beauty-z-dofinansowaniem-jak-zaczac",
    title: "Jak zdobyć zawód w beauty z dofinansowaniem",
    category: "Dofinansowania",
    excerpt:
      "Nie każdy kurs beauty jest \"za darmo\" — najczęściej dostajesz zwrot 80-90% ceny, a resztę dopłacasz. Pokazujemy całą ścieżkę: skąd biorą się pieniądze (BUR, KFS, EFS+), jakie zawody zdobędziesz i ile realnie zapłacisz z własnej kieszeni.",
    content: POST_A1_CONTENT,
    imageUrl: "/images/akademia-sala.jpg",
    metaTitle: "Zawód beauty z dofinansowaniem - jak zacząć niskim kosztem",
    metaDescription:
      "Jak zdobyć zawód beauty z dofinansowaniem z BUR - nawet jeśli pracujesz. Realne widełki dopłaty, ścieżka krok po kroku i szybki test kwalifikacji.",
    author: "Redakcja Uniwersytet Beauty",
    readingMinutes: 9,
    status: "opublikowane",
    publishedAt: new Date("2026-07-15T09:00:00+02:00"),
  },
];

async function main() {
  const { db, close, schema } = await getDb();
  const { blogPosts } = schema;
  const { sql } = await import("drizzle-orm");

  for (const p of POSTS) {
    await db
      .insert(blogPosts)
      .values(p)
      .onConflictDoUpdate({
        target: blogPosts.slug,
        set: {
          title: p.title,
          category: p.category,
          excerpt: p.excerpt,
          content: p.content,
          imageUrl: p.imageUrl,
          metaTitle: p.metaTitle,
          metaDescription: p.metaDescription,
          author: p.author,
          readingMinutes: p.readingMinutes,
          status: p.status,
          publishedAt: p.publishedAt,
        },
      });
    console.log(`✓ upsert: ${p.slug}`);
  }

  const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(blogPosts);
  console.log(`\nBaza bloga: ${c} postów łącznie.`);
  await close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
