/**
 * Merytoryka kategorii — to jest realna wartość wpisów, warstwa lokalna tylko ją osadza.
 *
 * `warianty` to NIE ozdobnik. Wpisy tej samej kategorii różnią się miastem, więc bez rotacji ujęcia
 * sześć stron „kursu paznokci" byłoby sześcioma kopiami z podmienioną nazwą miasta — czyli
 * duplicate content wyprodukowany własnoręcznie. Generator przypisuje wariant po indeksie miasta,
 * a QA sprawdza, czy teksty faktycznie się rozjechały.
 *
 * GUARDRAIL CENY: nigdzie „0 zł", „za darmo", „bezpłatne szkolenie". Mówimy o dopłacie i o procencie.
 */

export type Wariant = {
  /** Akapit otwierający — inny kąt wejścia w ten sam temat. */
  lead: string;
  /** Tytuł sekcji pogłębiającej, unikalny dla wariantu. */
  sekcjaTytul: string;
  sekcjaTresc: string;
};

export type Kategoria = {
  slug: string;
  /** Mianownik do tytułów: „Kurs stylizacji paznokci". */
  nazwaKursu: string;
  /** Krótka etykieta (mianownik) do meta i nagłówków. */
  etykieta: string;
  /** Dopełniacz: „stylizacji paznokci" — do konstrukcji „ceny kursów ...". */
  etykietaDopelniacz: string;
  /** Gotowa fraza z przyimkiem: „ze stylizacji paznokci" (alternacja z/ze zależy od zbitki spółgłosek). */
  zEtykieta: string;
  godzinyOd: number;
  godzinyDo: number;
  cenaOd: number;
  cenaDo: number;
  dofinansowanieProc: number;
  coObejmuje: string[];
  coPotrafisz: string[];
  dlaKogo: string;
  /** Slug istniejącego wpisu-huba, do którego linkujemy w górę klastra. */
  hubSlug: string;
  hubTytul: string;
  warianty: Wariant[];
  faq: { pytanie: string; odpowiedz: string }[];
};

export const KATEGORIE: Kategoria[] = [
  {
    slug: "stylizacja-paznokci",
    nazwaKursu: "Kurs stylizacji paznokci",
    etykieta: "stylizacja paznokci",
    etykietaDopelniacz: "stylizacji paznokci",
    zEtykieta: "ze stylizacji paznokci",
    godzinyOd: 24,
    godzinyDo: 40,
    cenaOd: 1200,
    cenaDo: 2500,
    dofinansowanieProc: 90,
    coObejmuje: [
      "przygotowanie płytki i opracowanie skórek narzędziami frezarskimi",
      "aplikacja lakieru hybrydowego i korekta typowych błędów",
      "przedłużanie metodą żelową na formie i na tipsie",
      "budowa łuku i architektura paznokcia",
      "dezynfekcja, sterylizacja i zasady BHP w gabinecie",
      "rozpoznawanie przeciwwskazań i zmian chorobowych płytki",
    ],
    coPotrafisz: [
      "samodzielnie wykonać manicure hybrydowy od początku do końca",
      "przedłużyć paznokcie żelem i wyrównać architekturę",
      "dobrać produkty i skompletować pierwsze stanowisko pracy",
      "policzyć koszt jednej usługi i ustawić cennik",
    ],
    dlaKogo:
      "osób bez doświadczenia, które chcą wejść do branży od podstaw, oraz stylistek pracujących wyłącznie na hybrydzie, które chcą dołożyć przedłużanie",
    hubSlug: "kurs-paznokci-z-dofinansowaniem",
    hubTytul: "Kurs paznokci z dofinansowaniem — ile dopłacasz",
    warianty: [
      {
        lead: "Stylizacja paznokci to najczęściej wybierane wejście do branży beauty — próg wiedzy jest niższy niż przy makijażu permanentnym, a pierwsze zarabiające usługi wykonuje się już kilka tygodni po szkoleniu.",
        sekcjaTytul: "Ile realnie trwa dojście do pierwszej płacącej klientki",
        sekcjaTresc:
          "Sam kurs to kilka dni. Dojście do powtarzalnej jakości zajmuje zwykle od sześciu do dwunastu tygodni ćwiczeń na modelkach — i to ten etap decyduje o tym, czy stanowisko zacznie zarabiać. Trenerki, które prowadzą kurs uczciwie, mówią o tym na pierwszych zajęciach i planują wsparcie po szkoleniu.",
      },
      {
        lead: "Kurs stylizacji paznokci kosztuje zwykle tyle, co dwa miesiące najmu małego stanowiska — dlatego pytanie o dofinansowanie pada w tej kategorii częściej niż w jakiejkolwiek innej.",
        sekcjaTytul: "Na czym najczęściej wykłada się początkująca stylistka",
        sekcjaTresc:
          "Nie na zdobieniu, tylko na przygotowaniu płytki. Źle opracowana skórka i zbyt agresywne frezowanie kończą się odparzeniami i odklejaniem materiału po kilku dniach. Dobre szkolenie poświęca na to więcej czasu niż na efektowne wzory, choć w portfolio widać wyłącznie te drugie.",
      },
      {
        lead: "Zapotrzebowanie na stylistki paznokci jest stabilne — usługa jest powtarzalna co trzy, cztery tygodnie, więc klientka raz zdobyta wraca kilkanaście razy w roku.",
        sekcjaTytul: "Dlaczego ta usługa buduje dochód szybciej niż inne",
        sekcjaTresc:
          "Rytm uzupełnień. Klientka makijażu permanentnego wraca po roku, klientka stylizacji paznokci co miesiąc. Przy dwudziestu stałych klientkach kalendarz wypełnia się sam, a przychód daje się przewidzieć — to rzadkość na starcie w usługach.",
      },
      {
        lead: "Wybór między kursem podstawowym a rozszerzonym o przedłużanie decyduje o cenniku, jaki ustawisz po szkoleniu — i o tym, ile realnie zarobisz na jednej wizycie.",
        sekcjaTytul: "Podstawowy czy z przedłużaniem — czym to się różni w praktyce",
        sekcjaTresc:
          "Kurs sam hybrydy daje usługę wycenianą zwykle w widełkach stu kilkudziesięciu złotych. Przedłużanie żelem podnosi cenę jednej wizyty mniej więcej o połowę przy podobnym czasie pracy. Jeżeli budżet pozwala tylko na jedno szkolenie, wersja z przedłużaniem zwraca się szybciej.",
      },
      {
        lead: "Reklamy obiecujące kurs paznokci „za zero złotych” pojawiają się w tej kategorii najczęściej i najczęściej są skrótem myślowym — realny mechanizm wygląda inaczej.",
        sekcjaTytul: "Skąd biorą się hasła o kursie bez opłat",
        sekcjaTresc:
          "Z dofinansowania rozliczanego po fakcie. Podpisujesz umowę na pełną cenę, operator refunduje jej większość, a Ty pokrywasz wkład własny. To wciąż różnica między kilkuset złotymi a kilkoma tysiącami, ale nie jest to szkolenie bez kosztu i żaden operator tak tego nie nazywa.",
      },
      {
        lead: "Kurs stylizacji paznokci daje zawód wykonalny w mniejszym mieście — nie wymaga dużego rynku, bo wystarczy stała baza kilkudziesięciu klientek z okolicy.",
        sekcjaTytul: "Ile kosztuje uruchomienie stanowiska po kursie",
        sekcjaTresc:
          "Lampa, frezarka, komplet żeli, baza narzędzi i sterylizacja to wydatek porównywalny z samym szkoleniem. Warto policzyć obie kwoty razem, zanim złożysz wniosek o dofinansowanie — część operatorów rozlicza wyłącznie usługę szkoleniową, sprzęt zostaje po Twojej stronie.",
      },
    ],
    faq: [
      {
        pytanie: "Czy kurs stylizacji paznokci wymaga wcześniejszego doświadczenia?",
        odpowiedz:
          "Nie. Szkolenia podstawowe zaczynają się od anatomii płytki i obsługi narzędzi, więc są projektowane dla osób, które nie miały wcześniej kontaktu z branżą.",
      },
      {
        pytanie: "Czy po kursie dostanę certyfikat?",
        odpowiedz:
          "Tak, szkolenia kończą się zaświadczeniem. Przy usłudze rozliczanej z dofinansowania dokument wystawia podmiot wpisany do Bazy Usług Rozwojowych, a jego zakres wynika z karty usługi.",
      },
      {
        pytanie: "Ile trzeba ćwiczyć po szkoleniu, żeby przyjmować klientki?",
        odpowiedz:
          "Najczęściej od sześciu do dwunastu tygodni pracy na modelkach. Skrócenie tego etapu kończy się reklamacjami, które kosztują więcej niż dodatkowy miesiąc ćwiczeń.",
      },
      {
        pytanie: "Czy lepiej wybrać kurs stacjonarny czy online?",
        odpowiedz:
          "Przy stylizacji paznokci praktyka pod okiem trenerki jest trudna do zastąpienia — frezarką uczy się pracować rękami, nie z nagrania. Materiały online sprawdzają się jako uzupełnienie po szkoleniu stacjonarnym.",
      },
      {
        pytanie: "Ile kosztuje wyposażenie stanowiska po kursie?",
        odpowiedz:
          "Lampa, frezarka, komplet żeli i narzędzia to wydatek porównywalny z ceną samego szkolenia. Część operatorów rozlicza wyłącznie usługę szkoleniową, więc sprzęt planuje się w osobnym budżecie.",
      },
      {
        pytanie: "Czy trzeba mieć działalność gospodarczą, żeby pójść na kurs?",
        odpowiedz:
          "Na sam kurs nie. Warunki dofinansowania bywają jednak różne dla osób prowadzących działalność i pracujących na etacie — status zawodowy sprawdza się na etapie wniosku.",
      },
    ],
  },

  {
    slug: "przedluzanie-rzes",
    nazwaKursu: "Kurs przedłużania rzęs",
    etykieta: "przedłużanie rzęs",
    etykietaDopelniacz: "przedłużania rzęs",
    zEtykieta: "z przedłużania rzęs",
    godzinyOd: 16,
    godzinyDo: 24,
    cenaOd: 1200,
    cenaDo: 2500,
    dofinansowanieProc: 90,
    coObejmuje: [
      "budowa i cykl życia rzęsy naturalnej",
      "metoda 1:1 oraz objętościowa 2D-5D",
      "dobór krzywizny, grubości i długości do oka klientki",
      "izolacja rzęsy naturalnej i praca pęsetami",
      "przeciwwskazania, reakcje alergiczne i praca z klejem",
      "zdejmowanie i uzupełnianie stylizacji",
    ],
    coPotrafisz: [
      "wykonać pełną stylizację metodą 1:1 w czasie zbliżonym do rynkowego",
      "zbudować wachlarze objętościowe i dobrać efekt do kształtu oka",
      "rozpoznać przeciwwskazania i odmówić usługi, gdy jest to konieczne",
      "prowadzić uzupełnienia jako powtarzalną, comiesięczną usługę",
    ],
    dlaKogo:
      "osób startujących w beauty oraz stylistek brwi i paznokci, które chcą poszerzyć gabinet o usługę z comiesięcznym rytmem wizyt",
    hubSlug: "kurs-rzes-brwi-z-dofinansowaniem-ile-doplacasz",
    hubTytul: "Kurs rzęs i brwi z dofinansowaniem — ile dopłacasz",
    warianty: [
      {
        lead: "Przedłużanie rzęs jest usługą, którą klientka uzupełnia co trzy do czterech tygodni — dlatego stylistka buduje przewidywalny kalendarz szybciej niż w kategoriach opartych na jednorazowych zabiegach.",
        sekcjaTytul: "Dlaczego czas pracy decyduje o opłacalności",
        sekcjaTresc:
          "Początkująca stylistka robi pełną stylizację w trzy, czasem cztery godziny. Doświadczona schodzi poniżej dwóch. Cena usługi jest w obu przypadkach podobna, więc cała różnica w zarobku bierze się z tempa — i to tempo, a nie efekt na zdjęciu, jest realnym celem pierwszych miesięcy po kursie.",
      },
      {
        lead: "Kurs przedłużania rzęs kosztuje mniej niż szkolenie z makijażu permanentnego, a wejście w zawód jest szybsze — przy porównywalnej wartości jednej wizyty.",
        sekcjaTytul: "Metoda 1:1 czy od razu objętościowa",
        sekcjaTresc:
          "Objętość bez opanowanej izolacji kończy się sklejonymi kępkami i uszkodzeniem rzęs naturalnych. Szkolenia, które w dwa dni obiecują obie metody, zwykle przechodzą przez izolację powierzchownie. Jeśli wybierasz między krótszym a dłuższym kursem, dłuższy zwraca się na reklamacjach, których nie będzie.",
      },
      {
        lead: "Rzęsy to kategoria, w której klientki wybierają stylistkę na podstawie zdjęć i opinii, a nie ceny — co daje przestrzeń na podnoszenie stawek szybciej niż w innych usługach.",
        sekcjaTytul: "Co musi się znaleźć w portfolio, żeby telefon dzwonił",
        sekcjaTresc:
          "Zdjęcia z tego samego ustawienia światła, oko otwarte i zamknięte, efekt bezpośrednio po zabiegu i po trzech tygodniach. Ten ostatni kadr robi największą różnicę, bo pokazuje trwałość — i prawie nikt go nie publikuje.",
      },
      {
        lead: "Praca z klejem cyjanoakrylowym wymaga wentylacji i świadomości przeciwwskazań — to część zawodu, którą programy szkoleń traktują bardzo różnie.",
        sekcjaTytul: "Bezpieczeństwo pracy, o które warto zapytać przed zapisem",
        sekcjaTresc:
          "Zapytaj wprost, ile czasu kurs poświęca na reakcje alergiczne, wentylację stanowiska i procedurę przy podrażnieniu. Jeżeli odpowiedź brzmi „to omawiamy na bieżąco”, program prawdopodobnie tego nie zawiera, a odpowiedzialność za zabieg spoczywa na Tobie.",
      },
      {
        lead: "Stylizacja rzęs pozwala pracować w modelu mobilnym albo z jednego stanowiska wynajmowanego na godziny — koszt startu jest niższy niż w większości usług beauty.",
        sekcjaTytul: "Ile kosztuje wyposażenie na start",
        sekcjaTresc:
          "Leżanka, lampa, pęsety, zestaw rzęs w kilku krzywiznach i kleje to wydatek rzędu jednej trzeciej ceny samego szkolenia. To jedna z niższych barier wejścia w branży, ale trzeba doliczyć koszt modelek w okresie ćwiczeń.",
      },
      {
        lead: "Uzupełnienia stanowią z czasem większość kalendarza stylistki rzęs — i to one, a nie nowe klientki, decydują o stabilności przychodu.",
        sekcjaTytul: "Jak liczyć przychód z uzupełnień",
        sekcjaTresc:
          "Uzupełnienie zajmuje mniej więcej połowę czasu pełnej stylizacji i jest wyceniane zwykle na dwie trzecie ceny. Przy stałej bazie klientek to najbardziej dochodowa godzina pracy w tym zawodzie — pod warunkiem, że stylizacja bazowa była wykonana poprawnie i jest co uzupełniać.",
      },
    ],
    faq: [
      {
        pytanie: "Czy kurs przedłużania rzęs jest odpowiedni dla początkujących?",
        odpowiedz:
          "Tak. Szkolenia bazowe zakładają brak doświadczenia i zaczynają od budowy rzęsy naturalnej oraz izolacji, czyli od umiejętności, na której opiera się cała reszta.",
      },
      {
        pytanie: "Ile trwa szkolenie z przedłużania rzęs?",
        odpowiedz:
          "Zwykle od dwóch do trzech dni zajęć praktycznych. Programy rozszerzone o metody objętościowe trwają dłużej i kosztują odpowiednio więcej.",
      },
      {
        pytanie: "Czy na kursie pracuje się na modelkach?",
        odpowiedz:
          "Na dobrym kursie tak, i to jest kryterium wyboru. Szkolenie prowadzone wyłącznie na główkach treningowych nie przygotowuje do pracy z żywym okiem, ruchem powieki i łzawieniem.",
      },
      {
        pytanie: "Czy po kursie od razu można przyjmować klientki?",
        odpowiedz:
          "Technicznie tak, ale pierwsze stylizacje trwają dwa razy dłużej niż docelowo. Większość stylistek przez pierwsze tygodnie pracuje na modelkach w niższej cenie, zanim wejdzie w pełny cennik.",
      },
      {
        pytanie: "Czy przedłużanie rzęs niszczy rzęsy naturalne?",
        odpowiedz:
          "Przy poprawnej izolacji i dobranej wadze nie. Uszkodzenia biorą się ze sklejania kilku rzęs naturalnych i z przeciążenia — czyli z błędu wykonania, nie z samej metody.",
      },
      {
        pytanie: "Jaka jest różnica między metodą 1:1 a objętościową?",
        odpowiedz:
          "W metodzie 1:1 na jedną rzęsę naturalną przypada jedna sztuczna. W objętościowej aplikuje się wachlarz z kilku cieńszych włókien, co daje gęstszy efekt przy zbliżonym obciążeniu.",
      },
    ],
  },

  {
    slug: "makijaz-permanentny",
    nazwaKursu: "Kurs makijażu permanentnego",
    etykieta: "makijaż permanentny",
    etykietaDopelniacz: "makijażu permanentnego",
    zEtykieta: "z makijażu permanentnego",
    godzinyOd: 24,
    godzinyDo: 40,
    cenaOd: 3500,
    cenaDo: 7000,
    dofinansowanieProc: 90,
    coObejmuje: [
      "anatomia i budowa skóry, gojenie pigmentu",
      "dobór pigmentów i teoria koloru pod podtony skóry",
      "projektowanie i wizaż brwi, wyznaczanie proporcji",
      "techniki: ombre, cieniowanie, kreska, usta",
      "obsługa urządzenia, głębokość i tempo pracy",
      "przeciwwskazania, dokumentacja zabiegowa i zgody klientki",
      "korekta i praca na zagojonym pigmencie",
    ],
    coPotrafisz: [
      "przeprowadzić konsultację i zaprojektować kształt pod twarz klientki",
      "wykonać zabieg brwi wybraną techniką wraz z dopigmentowaniem",
      "prowadzić dokumentację zabiegową i zgody zgodnie z wymogami",
      "wycenić usługę uwzględniając koszt pigmentów i wizyty kontrolnej",
    ],
    dlaKogo:
      "osób z doświadczeniem w beauty oraz starannie prowadzonych początkujących — to zabieg inwazyjny, więc dobre szkolenia weryfikują gotowość kandydatki",
    hubSlug: "kurs-pmu-z-dofinansowaniem-ile-zaplacisz",
    hubTytul: "Kurs PMU z dofinansowaniem — ile realnie zapłacisz",
    warianty: [
      {
        lead: "Makijaż permanentny jest najdroższym szkoleniem w beauty i jednocześnie najwyżej wycenianą usługą — dlatego rachunek opłacalności wygląda tu inaczej niż w pozostałych kategoriach.",
        sekcjaTytul: "Po ilu zabiegach kurs się zwraca",
        sekcjaTresc:
          "Przy rynkowej cenie zabiegu brwi zwrot kosztu szkolenia następuje zwykle po kilkunastu klientkach. Z dofinansowaniem pokrywającym większość ceny ta liczba spada do kilku. To najkrótszy okres zwrotu spośród szkoleń beauty, ale dochodzi do niego czas potrzebny na zbudowanie portfolio.",
      },
      {
        lead: "Pigment w skórze zostaje na lata, a poprawka po źle wykonanym zabiegu kosztuje więcej niż sam zabieg — dlatego wybór szkolenia z PMU jest decyzją innej wagi niż przy usługach odwracalnych.",
        sekcjaTytul: "Czego wymagać od programu szkolenia",
        sekcjaTresc:
          "Pracy na żywych modelkach pod nadzorem, nie wyłącznie na skórze syntetycznej. Wizyty kontrolnej po zagojeniu, bo dopiero zagojony pigment pokazuje, czy technika była poprawna. Oraz jasnej odpowiedzi, co kurs obejmuje po zakończeniu — brak wsparcia na etapie pierwszych klientek jest najczęstszym powodem porzucenia zawodu.",
      },
      {
        lead: "Zabieg brwi jest najczęściej wybieraną usługą PMU, ale to usta i kreska decydują o tym, czy gabinet wychodzi poza jedną grupę klientek.",
        sekcjaTytul: "Od czego zacząć, jeśli budżet starcza na jeden kurs",
        sekcjaTresc:
          "Od brwi. Popyt jest największy, projekt najłatwiej pokazać na zdjęciu, a technika stanowi bazę dla pozostałych obszarów. Usta wymagają innej pracy z kolorem i osobnego szkolenia, na które warto wrócić po zbudowaniu portfolio.",
      },
      {
        lead: "Makijaż permanentny wykonuje się z naruszeniem ciągłości tkanek, co nakłada obowiązki sanitarne wykraczające poza standardowy gabinet kosmetyczny.",
        sekcjaTytul: "Wymogi formalne, o których mówi się za późno",
        sekcjaTresc:
          "Stanowisko podlega wymaganiom sanitarnym, a dokumentacja zabiegowa i zgody klientki nie są formalnością — przy reklamacji stanowią jedyny dowód, że zabieg wykonano prawidłowo. Zapytaj, czy szkolenie przekazuje gotowe wzory dokumentów, czy zostawia ten temat Tobie.",
      },
      {
        lead: "Cena szkoleń z makijażu permanentnego rozciąga się od kilku do kilkunastu tysięcy złotych, a różnica nie zawsze wynika z jakości — czasem z liczby uczestniczek na jedną trenerkę.",
        sekcjaTytul: "Co realnie odróżnia kurs drogi od taniego",
        sekcjaTresc:
          "Liczba modelek przypadających na kursantkę i liczba kursantek przypadających na trenerkę. Szkolenie w grupie ośmioosobowej z jedną modelką na osobę daje inne przygotowanie niż zajęcia w trójkę. Pytaj o te dwie liczby, zanim porównasz ceny — bez nich porównanie nic nie znaczy.",
      },
      {
        lead: "Dofinansowanie z BUR obejmuje szkolenia z makijażu permanentnego na tych samych zasadach co pozostałe usługi rozwojowe, a przy tej cenie zabiegu robi największą różnicę w budżecie.",
        sekcjaTytul: "Dlaczego akurat w tej kategorii dofinansowanie waży najwięcej",
        sekcjaTresc:
          "Bo procent liczy się od najwyższej podstawy w branży. Ta sama zasada zwrotu przy szkoleniu za kilkaset złotych oznacza oszczędność rzędu kilkuset, a przy kursie PMU — kilku tysięcy. To zwykle różnica między odłożeniem decyzji na kolejny rok a zapisem w tym miesiącu.",
      },
    ],
    faq: [
      {
        pytanie: "Czy na kurs makijażu permanentnego można iść bez doświadczenia w beauty?",
        odpowiedz:
          "Formalnie tak, ale to zabieg inwazyjny i część akademii prowadzi wstępną weryfikację kandydatek. Osobom bez żadnego kontaktu z branżą zwykle rekomenduje się dłuższy program z rozbudowaną częścią praktyczną.",
      },
      {
        pytanie: "Ile kosztuje kurs makijażu permanentnego?",
        odpowiedz:
          "Rynkowe widełki to kilka tysięcy złotych za szkolenie bazowe, zależnie od liczby dni, liczby modelek i tego, czy urządzenie oraz pigmenty wchodzą w cenę.",
      },
      {
        pytanie: "Czy w cenie kursu jest urządzenie do PMU?",
        odpowiedz:
          "Bywa różnie i to jedna z głównych przyczyn rozbieżności cenowych. Pytaj wprost, bo zestaw startowy to wydatek porównywalny z częścią ceny samego szkolenia.",
      },
      {
        pytanie: "Jak długo utrzymuje się makijaż permanentny?",
        odpowiedz:
          "Zwykle od roku do trzech lat, zależnie od techniki, typu skóry i pielęgnacji. Po tym czasie wykonuje się odświeżenie, co dla gabinetu oznacza powracającą klientkę.",
      },
      {
        pytanie: "Czy w cenie kursu jest wizyta kontrolna po zagojeniu?",
        odpowiedz:
          "W dobrych programach tak i jest to istotne kryterium wyboru. Dopiero zagojony pigment pokazuje, czy głębokość pracy była prawidłowa — bez tej wizyty nie masz informacji zwrotnej.",
      },
      {
        pytanie: "Ile modelek przypada na jedną kursantkę?",
        odpowiedz:
          "To pytanie warto zadać przed zapisem. Liczba modelek i liczba kursantek na trenerkę tłumaczą większość różnic w cenie szkoleń z tej kategorii.",
      },
    ],
  },

  {
    slug: "laminacja-brwi-rzes",
    nazwaKursu: "Kurs laminacji brwi i rzęs",
    etykieta: "laminacja brwi i rzęs",
    etykietaDopelniacz: "laminacji brwi i rzęs",
    zEtykieta: "z laminacji brwi i rzęs",
    godzinyOd: 8,
    godzinyDo: 16,
    cenaOd: 800,
    cenaDo: 1800,
    dofinansowanieProc: 90,
    coObejmuje: [
      "chemia preparatów i mechanizm działania na włos",
      "dobór czasów ekspozycji do grubości i kondycji włosa",
      "laminacja brwi z regulacją i koloryzacją",
      "lifting i laminacja rzęs, dobór wałeczków",
      "odżywianie i pielęgnacja po zabiegu",
      "przeciwwskazania, próba uczuleniowa i dokumentacja",
    ],
    coPotrafisz: [
      "wykonać laminację brwi wraz z regulacją i henną",
      "przeprowadzić lifting rzęs z dobraniem wałeczka do oka",
      "rozpoznać przetrenowany włos i odmówić zabiegu",
      "połączyć zabieg z innymi usługami w jednej wizycie",
    ],
    dlaKogo:
      "kosmetyczek i stylistek, które chcą dołożyć krótką i dochodową usługę, oraz osób szukających najtańszego wejścia do branży",
    hubSlug: "kurs-rzes-brwi-z-dofinansowaniem-ile-doplacasz",
    hubTytul: "Kurs rzęs i brwi z dofinansowaniem — ile dopłacasz",
    warianty: [
      {
        lead: "Laminacja brwi i rzęs jest najkrótszym szkoleniem w tym zestawieniu, a zabieg trwa niecałą godzinę — co czyni z niej jedną z najbardziej dochodowych usług w przeliczeniu na godzinę pracy.",
        sekcjaTytul: "Dlaczego ta usługa dobrze uzupełnia inne",
        sekcjaTresc:
          "Mieści się w oknie, w którym i tak czekasz — na przykład przy pracy z pigmentem albo między dłuższymi zabiegami. Wiele gabinetów sprzedaje ją jako dodatek do wizyty, co podnosi wartość koszyka bez wydłużania kalendarza.",
      },
      {
        lead: "Preparaty do laminacji działają na strukturę włosa, więc dobór czasu ekspozycji jest tu ważniejszy niż technika ręki — i to na nim wykłada się większość początkujących.",
        sekcjaTytul: "Skąd biorą się przepalone brwi i proste rzęsy",
        sekcjaTresc:
          "Z trzymania preparatu na oko zamiast z oceny grubości włosa. Ten sam czas na cienkiej i grubej brwi daje dwa różne efekty, a nadmierna ekspozycja niszczy włos na tygodnie. Dobre szkolenie uczy tego na kilku typach włosa, nie na jednej modelce.",
      },
      {
        lead: "Niski koszt szkolenia i sprzętu sprawia, że laminacja bywa pierwszym zawodowym krokiem osób, które nie chcą od razu inwestować kilku tysięcy w kurs PMU.",
        sekcjaTytul: "Realny koszt wejścia w tę usługę",
        sekcjaTresc:
          "Poza szkoleniem potrzebujesz zestawu preparatów, wałeczków, kleju i podstawowego wyposażenia stanowiska. To najniższa bariera wejścia spośród usług opisywanych na tym portalu, co ma drugą stronę: konkurencja lokalna jest odpowiednio większa.",
      },
      {
        lead: "Efekt laminacji utrzymuje się od czterech do sześciu tygodni, więc usługa wraca w kalendarzu regularnie — podobnie jak stylizacja paznokci, ale przy krótszym czasie pracy.",
        sekcjaTytul: "Jak wygląda rytm powrotów klientki",
        sekcjaTresc:
          "Po zabiegu włos stopniowo wraca do naturalnego układu, a klientki umawiają się ponownie zwykle po miesiącu z okładem. Przy usłudze trwającej niecałą godzinę oznacza to gęsty, ale przewidywalny grafik, który da się układać wokół dłuższych zabiegów.",
      },
      {
        lead: "Laminacja i lifting rzęs bywają mylone, także w opisach szkoleń — a różnica dotyczy tego, co dostaje klientka i ile możesz za to policzyć.",
        sekcjaTytul: "Lifting a laminacja — co kupujesz na kursie",
        sekcjaTresc:
          "Lifting podnosi rzęsy od nasady, laminacja dokłada odżywienie i pracę na strukturze włosa. Część akademii sprzedaje jedno pod nazwą drugiego. Przed zapisem sprawdź w programie, czy szkolenie obejmuje obie procedury i pracę na obu obszarach — brwiach i rzęsach.",
      },
      {
        lead: "Krótkie szkolenia rzadziej trafiają do Bazy Usług Rozwojowych niż duże kursy zawodowe, ale te wpisane podlegają dokładnie tym samym zasadom dofinansowania.",
        sekcjaTytul: "Na co zwrócić uwagę przy krótkiej usłudze rozwojowej",
        sekcjaTresc:
          "Na liczbę godzin w karcie usługi — od niej zależy, czy szkolenie mieści się w wymaganiach konkretnego naboru. Przy zabiegach jednodniowych zdarza się, że operator wymaga minimalnego wymiaru godzin, którego kurs nie spełnia. Warto to sprawdzić przed złożeniem wniosku, nie po.",
      },
    ],
    faq: [
      {
        pytanie: "Ile trwa kurs laminacji brwi i rzęs?",
        odpowiedz:
          "Najczęściej jeden lub dwa dni. Programy obejmujące oba obszary oraz koloryzację są dłuższe niż szkolenia z samego liftingu rzęs.",
      },
      {
        pytanie: "Czy laminacja jest bezpieczna dla rzęs?",
        odpowiedz:
          "Przy prawidłowo dobranym czasie ekspozycji tak. Uszkodzenia wynikają z przetrzymania preparatu i z powtarzania zabiegu zbyt często — obie rzeczy są po stronie osoby wykonującej, nie samej metody.",
      },
      {
        pytanie: "Czy można łączyć laminację z innymi usługami?",
        odpowiedz:
          "Tak i na tym polega jej wartość w gabinecie. Najczęściej łączy się ją z regulacją i henną brwi albo dokłada do wizyty stylizacyjnej.",
      },
      {
        pytanie: "Jak długo utrzymuje się efekt laminacji?",
        odpowiedz:
          "Od czterech do sześciu tygodni, zależnie od tempa wzrostu włosa i pielęgnacji. Po tym czasie włos wraca do naturalnego układu i zabieg się powtarza.",
      },
      {
        pytanie: "Czy laminację można wykonywać w ciąży?",
        odpowiedz:
          "Wiele producentów preparatów wskazuje ciążę jako przeciwwskazanie względne. Decyzję podejmuje się indywidualnie, a informacja o niej powinna znaleźć się w dokumentacji zabiegowej.",
      },
      {
        pytanie: "Czy ten kurs wystarczy, żeby otworzyć własny gabinet?",
        odpowiedz:
          "Jako jedyna usługa raczej nie — zabieg jest krótki i tani, więc utrzymanie gabinetu wymaga uzupełnienia go o inne pozycje w cenniku. Jako dodatek do istniejącej oferty sprawdza się bardzo dobrze.",
      },
    ],
  },
];

export const KATEGORIA_PO_SLUGU = new Map(KATEGORIE.map((k) => [k.slug, k]));
