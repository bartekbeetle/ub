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

// ── PILLAR A #3 (podtemat: mit „tylko dla bezrobotnych") ───────────────────
const POST_A3_CONTENT = `Zrezygnujesz z kursu beauty, bo „przecież pracuję, więc dofinansowanie mi się nie należy"? Zatrzymaj się na chwilę. To zdanie kosztuje polskie kobiety więcej niż jakikolwiek wkład własny do szkolenia - bo przez nie tysiące osób nawet nie sprawdza, czy kwalifikuje się do zwrotu 80-90% ceny kursu.

Dofinansowanie z BUR nie jest nagrodą pocieszenia dla osób bez pracy. W większości regionalnych naborów mogą z niego korzystać kobiety na etacie, na własnej działalności, mamy wracające po urlopie wychowawczym i studentki. Zaraz Ci pokażę, komu dokładnie i na jakich zasadach - a także kiedy faktycznie zwrotu nie dostaniesz, bo takie sytuacje też istnieją i nie będę tego owijać w bawełnę.

## Najczęstszy mit: „dofinansowanie jest tylko dla bezrobotnych"

Skąd się to bierze? Z pomieszania dwóch zupełnie różnych instytucji.

Kiedy słyszysz „kurs z dofinansowania", odruchowo myślisz o urzędzie pracy - bo tam faktycznie trzeba być zarejestrowaną jako bezrobotna, żeby dostać skierowanie na szkolenie. Urząd pracy działa dla osób, które pracy nie mają i jej szukają. Kropka. I gdyby BUR działał tak samo, ten artykuł nie miałby sensu.

Ale BUR to nie urząd pracy. To zupełnie inny mechanizm, finansowany z innej kieszeni, według innych zasad. Baza Usług Rozwojowych to platforma prowadzona przez PARP, przez którą płyną pieniądze z funduszy unijnych (głównie EFS+), rozdzielane regionalnie przez operatorów w każdym województwie. Te programy powstały nie po to, żeby ratować bezrobotnych, tylko żeby podnosić kwalifikacje osób aktywnych zawodowo. Czyli między innymi Twoje - jeśli pracujesz.

To rozróżnienie jest sercem całej sprawy. Konkurencja go nie komunikuje, bo „za darmo dla bezrobotnych" brzmi prościej w reklamie. Problem w tym, że przez to prostsze hasło odsiewa się kobiety, które są idealnymi kandydatkami do dofinansowania - tylko o tym nie wiedzą.

## Komu naprawdę należy się BUR - pracujące, na etacie, na działalności, mamy, studentki

Zasady różnią się między województwami i konkretnymi naborami, więc nie napiszę Ci „każdy dostanie". To byłaby lipa. Ale mogę pokazać grupy, które w praktyce najczęściej się kwalifikują - i pewnie jesteś w którejś z nich.

**Pracujesz na etacie.** Umowa o pracę nie wyklucza Cię z niczego. Wręcz przeciwnie - duża część naborów BUR jest kierowana właśnie do osób zatrudnionych, które chcą się przekwalifikować albo dołożyć nową umiejętność. Możesz robić kurs po godzinach i przyjmować pierwsze klientki obok etatu, zanim zdecydujesz się na skok na własne.

**Prowadzisz działalność gospodarczą.** Jednoosobowa firma czy mikroprzedsiębiorstwo to jedna z najlepiej obsługiwanych grup - i tu wchodzi też KFS (o różnicy za chwilę), który potrafi pokryć nawet całość kosztów. Jeśli masz salon fryzjerski i chcesz dołożyć PMU do oferty, ta ścieżka jest dla Ciebie skrojona.

**Jesteś mamą wracającą na rynek pracy.** Wiele regionalnych projektów szczególnie zachęca kobiety po urlopie macierzyńskim czy wychowawczym. Powód jest prosty: to grupa, którą programy unijne chcą aktywizować zawodowo, a beauty daje elastyczność, jakiej mama z małym dzieckiem realnie potrzebuje - pracę na własnych godzinach, blisko domu albo mobilnie.

**Studiujesz.** Studentki też się kwalifikują w części naborów, zwłaszcza te powyżej pewnego wieku albo łączące studia z pracą. Kurs beauty bywa dla studentki pierwszym realnym zawodem, który zaczyna zarabiać, zanim jeszcze skończy uczelnię.

Widzisz wzór? W każdej z tych sytuacji masz coś wspólnego - jesteś aktywna, chcesz się rozwijać, a nie siedzisz zarejestrowana w pośredniaku. I dokładnie takich osób szuka większość programów.

### Case: pracująca kobieta zmienia branżę na beauty

Weźmy konkret. Ania, 34 lata, pracuje w księgowości na etacie w średnim mieście. Od dwóch lat myśli o stylizacji rzęs - lubi precyzyjną pracę, marzy o własnym gabinecie, ale kwota za porządny kurs (powiedzmy 1800 zł) i strach przed rzuceniem stabilnej pensji trzymały ją w miejscu. Dorzuć do tego przekonanie „mam etat, więc żadne dofinansowanie mnie nie obejmuje" - i mamy gotowy przepis na kolejny rok stania w miejscu.

Kiedy Ania w końcu sprawdziła swoją sytuację, okazało się, że w jej województwie trwa nabór obejmujący osoby pracujące, które planują przekwalifikowanie. Wkład własny przy tym kursie wyniósł około 270 zł zamiast pełnych 1800. Zrobiła szkolenie w dwa weekendy, nie rzucając pracy. Pierwsze modelki złapała wśród koleżanek z biura, potem poszło z polecenia. Po kilku miesiącach przyjmowała klientki po godzinach i odkładała na sprzęt do własnego stanowiska.

Nie każda historia wygląda tak gładko - czasem nabór akurat się zamknął, czasem wkład własny jest wyższy. Ale sedno jest takie: Ania omal nie odpuściła przez mit, który był po prostu nieprawdziwy. Etat jej nie wykluczał. Wykluczało ją tylko przekonanie, że wyklucza.

## BUR vs urząd pracy vs KFS - czym się różnią

Trzy źródła, trzy różne zasady. Ta tabela porządkuje, co jest czym - bo połowa nieporozumień bierze się z mylenia ich ze sobą.

| Cecha | BUR (Baza Usług Rozwojowych) | Urząd pracy | KFS (Krajowy Fundusz Szkoleniowy) |
|-------|------------------------------|-------------|-----------------------------------|
| Dla kogo | Osoby aktywne zawodowo: etat, działalność, często mamy i studentki | Osoby bezrobotne zarejestrowane w PUP | Osoby zatrudnione i pracodawcy (w tym jednoosobowe firmy) |
| Trzeba być bezrobotną? | Nie | Tak | Nie |
| Kto składa wniosek | Ty (przez operatora regionalnego) | Ty (przez urząd pracy) | Pracodawca (lub Ty, jeśli masz działalność) |
| Poziom dofinansowania | Zwykle 80-90% | Zależnie od programu | Nawet 100% dla mikrofirm, 80% dla większych |
| Skąd pieniądze | Fundusze unijne (EFS+), regionalnie | Fundusz Pracy | Fundusz Pracy (część na kształcenie) |
| Typowa droga dla kursantki beauty | Główna ścieżka | Rzadziej | Gdy masz działalność lub przychylnego pracodawcę |

Dla większości kobiet, które piszą do nas z pytaniem o zawód w beauty od zera, właściwą drogą jest BUR. KFS wchodzi w grę, kiedy prowadzisz własną firmę albo masz szefa gotowego podpisać wniosek. Urząd pracy - tylko jeśli faktycznie jesteś bez pracy i zarejestrowana. Trzy różne bramki, a mit „tylko dla bezrobotnych" wrzuca je wszystkie do jednego worka.

## Kiedy faktycznie NIE dostaniesz dofinansowania (uczciwe wyjątki)

Nie sprzedaję Ci bajki, że pieniądze leżą na ulicy i wystarczy się schylić. Są sytuacje, w których zwrotu nie będzie - i lepiej, żebyś wiedziała o nich teraz niż po wypełnieniu papierów.

**Kurs nie jest wpisany do BUR.** To warunek konieczny. Jeśli wybierzesz trenerkę albo szkołę, która nie ma szkolenia w Bazie Usług Rozwojowych, żaden operator nie zrefunduje Ci ani złotówki z tego programu. Kurs możesz zrobić - ale za pełną cenę. Dlatego zawsze sprawdzaj, czy dane szkolenie jest w BUR, zanim się zapiszesz.

**W Twoim województwie akurat nie ma otwartego naboru.** Nabory ruszają i zamykają się w cyklach, a pula pieniędzy bywa ograniczona. Zdarza się, że trafiasz w moment między naborami albo środki na dany kwartał już się rozeszły. To nie znaczy „nigdy" - to znaczy „nie teraz, sprawdź termin następnego".

**Nie łapiesz się na kryteria konkretnego projektu.** Jeden operator kieruje program tylko do osób o niskich kwalifikacjach, inny do mieszkańców jednego powiatu, jeszcze inny wyłącznie do kobiet po 30. roku życia. Możesz być aktywna zawodowo i mimo to nie pasować do akurat tego naboru - ale pasować do innego. Dlatego jedno „nie" u jednego operatora nie zamyka tematu.

**Przekroczyłaś limit pomocy albo już korzystałaś niedawno.** W niektórych programach jest limit korzystania z dofinansowania w danym okresie. Jeśli rok temu robiłaś kurs z BUR, drugi od ręki może się nie udać - choć często wystarczy odczekać do kolejnej puli.

Uczciwie: dofinansowanie to nie automat, który wypluwa zniżkę każdemu. To system z zasadami. Ale te zasady są znacznie szersze, niż sugeruje mit o bezrobotnych - i najczęstszym powodem, dla którego kobieta nie dostaje zwrotu, nie jest to, że pracuje. Jest to, że w ogóle nie sprawdziła.

## Sprawdź swoją sytuację w 2 minuty

Cały ten artykuł prowadzi do jednej rzeczy, którą naprawdę warto zrobić: sprawdzić własną sytuację pod aktualne nabory w Twoim regionie. Nie przez godzinę czytania regulaminów operatorów, tylko przez krótki test.

**Sprawdź w 2 minuty, czy należy Ci się dofinansowanie na kurs beauty.** Odpowiadasz na kilka pytań - czy pracujesz, w jakim jesteś województwie, jaki kierunek Cię interesuje - a my dopasowujemy Cię do trenerki i naboru, w którym możesz się załapać na zwrot. Bez opłat za samo sprawdzenie i bez zobowiązania.

👉 [Wypełnij test kwalifikacji na uniwersytetbeauty.pl](https://uniwersytetbeauty.pl)

Jeśli się kwalifikujesz - masz gotową ścieżkę i trenerkę, a zamiast kilku tysięcy złotych dopłacasz zwykle kilkaset. Jeśli nie teraz - przynajmniej wiesz, na czym stoisz i kiedy sprawdzić ponownie, zamiast odpuszczać zawód przez zdanie, które nigdy nie było prawdą: „dofinansowanie jest tylko dla bezrobotnych".

## Najczęstsze pytania

**Czy dostanę dofinansowanie, jeśli pracuję na etacie?**
Tak, w większości regionalnych naborów BUR osoby pracujące się kwalifikują. Etat Cię nie wyklucza - to jedno z najczęstszych nieporozumień. Warunki zależą od województwa i konkretnego naboru, dlatego trzeba sprawdzić Twoją sytuację indywidualnie.

**Czy muszę być zarejestrowana w urzędzie pracy?**
Nie. To urząd pracy wymaga statusu osoby bezrobotnej. BUR działa inaczej - jest kierowany głównie do osób aktywnych zawodowo. Mylenie tych dwóch instytucji to źródło całego mitu.

**Ile realnie dopłacę z własnej kieszeni?**
Przy standardowym dofinansowaniu z BUR na poziomie 80-90% Twój wkład własny to zwykle 10-20% ceny kursu - czyli od kilkuset złotych. Zamiast 1800 zł za kurs rzęs płacisz w okolicach 200-360 zł. Pełne 100% (zero dopłaty) zdarza się głównie przez KFS dla zatrudnionych w mikrofirmach - to wyjątek, nie reguła.

**Czy jako mama na urlopie wychowawczym się kwalifikuję?**
Bardzo często tak - mamy wracające na rynek pracy to grupa, którą wiele projektów wprost zachęca do udziału. Trzeba sprawdzić aktualny nabór w Twoim regionie, bo zasady się różnią, ale sam status mamy Cię nie wyklucza.

**Czy każdy kurs beauty łapie się na BUR?**
Nie. Szkolenie musi być wpisane do Bazy Usług Rozwojowych przez certyfikowaną trenerkę albo firmę. Kurs spoza BUR możesz zrobić, ale bez zwrotu z tego programu - dlatego wybór trenerki z bazy jest warunkiem koniecznym.
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
  {
    slug: "bur-nie-urzad-pracy-dofinansowanie-dla-pracujacych",
    title: "Dofinansowanie BUR - nie musisz być bezrobotna",
    category: "Dofinansowania",
    excerpt:
      "Największy mit o dofinansowaniu na kurs beauty: że jest tylko dla bezrobotnych. Nieprawda - BUR obejmuje pracujące, mamy, studentki i osoby na działalności. Sprawdź, komu naprawdę się należy.",
    content: POST_A3_CONTENT,
    imageUrl: "/images/akademia-sala.jpg",
    metaTitle: "Dofinansowanie BUR - nie musisz być bezrobotna",
    metaDescription:
      "Dofinansowanie BUR dla osoby pracującej istnieje - nie musisz być bezrobotna. Kto się kwalifikuje, czym różni się od urzędu pracy i KFS, kiedy zwrotu nie dostaniesz.",
    author: "Redakcja Uniwersytet Beauty",
    readingMinutes: 9,
    status: "opublikowane",
    publishedAt: new Date("2026-07-17T09:00:00+02:00"),
  },
];

// Poglądowe posty demo (scripts/seed.ts) zastąpione realnymi artykułami SEO.
// Kasujemy je po slugu przy każdym odpaleniu — idempotentnie, lokalnie i na prod.
const DEPRECATED_SLUGS = [
  "jak-zdobyc-dofinansowanie-na-szkolenie-beauty-przewodnik",
  "ile-zarabia-linergistka-w-polsce",
  "bur-nie-tylko-dla-bezrobotnych-5-mitow",
  "microblading-czy-ombre-brows-co-wybrac",
  "przebranzowienie-na-beauty-po-30-od-czego-zaczac",
  "trendy-beauty-2026-jakie-uslugi-beda-zarabiac",
];

async function main() {
  const { db, close, schema } = await getDb();
  const { blogPosts } = schema;
  const { sql, inArray } = await import("drizzle-orm");

  if (DEPRECATED_SLUGS.length > 0) {
    await db.delete(blogPosts).where(inArray(blogPosts.slug, DEPRECATED_SLUGS));
    console.log(`✓ usunięto poglądowe posty: ${DEPRECATED_SLUGS.length}`);
  }

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
