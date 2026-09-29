# Zdarzenia analityczne UB — GA4 + Meta Pixel/CAPI + Google Ads

> Stan po pracy z 29.09.2026 (gałąź `analityka/zdarzenia`). Źródło prawdy w kodzie:
> `src/lib/tracking-events.ts` (mapa zdarzeń + funkcja `trackEvent`), `src/lib/meta-capi-core.ts`
> (hash/payload CAPI — czyste, bez sieci) i `src/lib/meta-capi.ts` (wywołanie sieciowe).

## 0. Co się zepsuło i co naprawiono (audyt paneli 29.09.2026)

Przy pierwszym audycie w panelach okazało się:

- **GA4**: `generate_lead` dochodzi (15 zdarzeń / 8 użytkowników) — problem „0 konwersji" był tylko
  brakiem oznaczenia zdarzenia jako **kluczowe** w GA4 (robi to CEO ręcznie w panelu, nie kod).
- **Meta**: piksel `2307645766669921` (aktywny od 22.09) miał **PageView (133)** i **Contact (5)**,
  ale **ZERO `Lead`**.
- **Google Ads**: akcja konwersji „UB - Lead (formularz kwalifikacyjny)"
  (`AW-10793969605/Mq-qCK6jqPIcEMXP-5oo`) była **„Nieaktywna"** — nigdy nie zarejestrowała konwersji.

**Błąd strukturalny znaleziony w kodzie (realny, ale NIE potwierdzony jako przyczyna produkcyjna —
patrz test rozstrzygający niżej):** stary `TrackEvent.tsx` miał JEDNĄ wspólną flagę `done` na całe
zdarzenie. `fbq` (Meta) i `gtag` (GA4/Ads) ładują się asynchronicznie jako dwa niezależne zewnętrzne
skrypty. Pętla odpytująca kończyła się, gdy TYLKO JEDEN z silników był gotowy — ten silnik strzelał,
drugi (ten, który wstał jako drugi) **nigdy nie dostawał szansy**, bo `done = true` blokowało kolejne
próby. To jest prawdziwy błąd — reprodukowany deterministycznie w `scripts/test-tracking.ts` na
sztucznie opóźnionym `window.fbq`/`window.gtag` — ale **wyścig, który ujawnia, wymaga, żeby drugi
silnik doładował się PO tym, jak pierwszy już zdążył wystrzelić zdarzenie**, czyli PO montowaniu
`TrackEvent`/`LeadConversion`. W realnym przepływie (quiz 7 kroków trwający dziesiątki sekund,
zgoda dana wcześniej) oba skrypty są praktycznie zawsze już załadowane, zanim ktokolwiek trafi na
`/dziekujemy` — okno na wyścig jest bardzo wąskie.

**Test rozstrzygający (wykonany 29.09.2026):** stary kod (`git switch --detach 42999d6`, commit
SPRZED tej gałęzi) na w pełni załadowanej stronie `/dziekujemy` (fbq i gtag gotowe, brak wyścigu)
**WYSŁAŁ `ev=Lead` do Mety I `generate_lead` do Google Ads** — bez żadnej zmiany z tej gałęzi.
Zobaczone w Network: `facebook.com/tr/?...&ev=Lead&cd[content_name]=formularz...` (status 200) oraz
`google.com/ccm/collect?...&en=generate_lead...`. **Wniosek: Hipoteza B (race condition jako JEDYNA
przyczyna) NIE POTWIERDZA SIĘ w warunkach zbliżonych do produkcyjnych.** Błąd race-condition jest
realny i naprawiony jako **wzmocnienie (hardening)** — usuwa realne, choć rzadkie, okno awarii
(np. bardzo szybkie wypełnienie krótkiego `LeadForm` z modala zaraz po wyrażeniu zgody, wolne łącze,
CPU throttling na słabym telefonie) — ale nie jest to potwierdzona przyczyna zera zdarzeń Lead w
Mecie na produkcji. **Hipoteza A (nikt nie daje zgody marketingowej) zostaje otwarta**, tak samo jak
możliwość, że Meta coś filtruje/ogranicza po stronie zdarzenia (patrz akapit niżej — kategoria
„med. estetyczna" w `CATEGORIES` może kwalifikować konto jako reklamodawcę zdrowie/wellness, co
Meta czasem ogranicza; to sprawdza CEO w zakładce Diagnostyka Menedżera zdarzeń, poza zakresem tej
gałęzi kodu).

**Co NAPRAWDĘ jest zweryfikowane i naprawione (niezależnie od tego, która hipoteza wyjaśnia zero
na produkcji):**
1. `scripts/test-tracking.ts` — dwa scenariusze wyścigu symulowane na fałszywym `window`
   (gtag gotowe pierwsze / fbq gotowe pierwsze) + test deduplikacji. Stary kod NIE przeszedłby
   żadnego z dwóch scenariuszy wyścigu — to jest dowód na błąd w kodzie, nie na przyczynę w danych.
2. Ręcznie na dev (localhost:3011, NOWY kod, zgoda na wszystko, ID testowe): quiz → `/dziekujemy`.
   Zobaczone w Network:
   - `facebook.com/tr/?...&ev=QuizStart&...` (status 200) — `trackCustom`, poprawnie NIE `track`.
   - `facebook.com/tr/?...&ev=Lead&...&cd[wojewodztwo]=slaskie&cd[kategoria]=PMU&cd[content_name]=quiz-kwalifikacyjny&...&eid=<eventId>` —
     `eid` to deduplikacja Meta (ten sam `eventId`, który idzie do CAPI).
   - `region1.google-analytics.com/g/collect?...&en=generate_lead&ep.lead_source=quiz&ep.wojewodztwo=slaskie&ep.kategoria=PMU`.
   - `window.dataLayer` zawierał, w tej kolejności: `consent default` (wszystko denied) →
     `consent update` (granted zgodnie ze zgodą) → `set user_data {email, phone_number: E.164}` →
     `event conversion {send_to:"AW-.../<etykieta>", transaction_id:"<eventId>"}` — to jest
     dowód NA POZIOMIE KODU, że wywołanie konwersji Ads i enhanced conversions dzieje się poprawnie
     (nie zweryfikowano, czy prawdziwe konto Google Ads faktycznie ZAREJESTRUJE tę konwersję —
     wymaga realnego `AW-`/etykiety i Tag Assistant, patrz §7).
3. Zgoda TYLKO `analytics` (bez `marketing`): `window.fbq === undefined` (Pixel nigdy się nie
   ładuje), `window.__ubAnalytics.pixel/adsId/adsLeadLabel === null`, `dataLayer` zawiera TYLKO
   `config G-TESTTEST1` — żadnego wpisu `AW-`. Zero żądań do `connect.facebook.net`/`facebook.com`.
   Kryterium akceptacji #2 zweryfikowane bezpośrednio.
4. Odświeżenie `/dziekujemy` (segment już skasowany z `sessionStorage`) → **zero** kolejnych
   żądań `ev=Lead`/`generate_lead` na NOWYM kodzie — a na STARYM kodzie (test rozstrzygający wyżej)
   każde odświeżenie wysyłało kolejny `Lead` i konwersję Ads bezwarunkowo. To jest realna poprawka,
   niezależna od tego, która hipoteza (A/B) wyjaśnia produkcyjne zero.

**Nierozstrzygnięte — „Contact (5)" w Meta:** sprawdzone dwoma sposobami:
- `git log --all -G "fbq\(.*Contact" --oneline` (CAŁA historia, wszystkie gałęzie, nie tylko ta) —
  jedyny wynik to własny commit dokumentacji z tej gałęzi. Czyli **żadna wersja kodu w tym repo,
  na żadnej gałęzi, nigdy nie wysyłała `fbq(...,'Contact',...)`** przed tą pracą — `ContactForm.tsx`
  zaczyna to robić dopiero tutaj (patrz §1).
- `grep -rl 2307645766669921 ~/Projects` (poza `node_modules`) — jedyne trafienia to pliki z tej
  gałęzi (`tracking-events.ts`, ten dokument). **Żaden inny projekt na tej maszynie nie współdzieli
  tego ID pikselu** — hipoteza „inne wdrożenie na innej domenie" nie ma potwierdzenia TUTAJ (ale to
  sprawdza tylko lokalne repozytoria, nie wyklucza wdrożenia poza tym komputerem, np. wklejonego
  ręcznie na inną stronę).

Automatyczne zdarzenia Meta (Automatic Advanced Matching / Automatic Events) są w panelu wyłączone
— jeśli to prawda, **źródło tych 5 zdarzeń „Contact" pozostaje niewyjaśnione**. Kandydaci do
sprawdzenia przez CEO (poza zakresem tej gałęzi — brak dostępu do panelu Meta i do historii
wdrożeń naffy): (a) integracja płatności naffy (sklep poszedł live 28.09) mogła wgrać własny
snippet Pixela z tym samym ID, (b) wbudowana heurystyka Pixela na `tel:`/`mailto:` w stopce mimo
wyłączonych „Automatic Events", (c) ślad z ręcznego testowania 22.09 w konsoli przeglądarki.

## 1. Mapa zdarzeń (stan faktyczny w kodzie)

Źródło: `src/lib/tracking-events.ts` (`TRACK_EVENTS`). Kolumna „Gdzie w kodzie" wskazuje
wywołanie — komponent (`<TrackEvent event="…">`) albo import (`trackEvent(key, …)`).

| Działanie | Meta | GA4 | Google Ads | Gdzie w kodzie |
|---|---|---|---|---|
| Lead kursantki (quiz/formularz → `/dziekujemy`) | `Lead` + **CAPI** | `generate_lead` (`lead_source`, `wojewodztwo`, `kategoria`) | konwersja `AW-10793969605/Mq-qCK6jqPIcEMXP-5oo` + enhanced conversions | `LeadConversion.tsx` |
| Start quizu (pierwsza odpowiedź) | `trackCustom QuizStart` | `quiz_start` | — | `Quiz.tsx` → `set()` (imperatywnie, bez zmian w JSX) |
| Rozpoczęcie formularza leada (pierwszy focus) | — | **ŚWIADOMIE NIE dodane** | — | GA4 Enhanced Measurement już to zbiera automatycznie (`form_start`/`form_submit` — 74/21 zdarzeń w panelu 29.09). Własna implementacja zdublowałaby nazwę zarezerwowaną przez pomiar zaawansowany. |
| Widok kursu | `ViewContent` | `view_item` | — | `kurs/[slug]/page.tsx` |
| Rejestracja akademii B2B | `SubmitApplication` + **CAPI** | `sign_up` (`method: akademia`) | — | `AcademyRegistrationForm.tsx` (imperatywnie po `res.ok`) |
| Formularz kontaktowy | `Contact` | `contact` | — | `ContactForm.tsx` (imperatywnie po `res.ok`) |
| Poradnik BUR (darmowy) | `CompleteRegistration` | `lead_magnet` (`content_name`) | — | `poradnik/dziekujemy/page.tsx` |
| Klik „kup" poradnika 28 zł (wyjście do naffy) | `InitiateCheckout` | `begin_checkout` (`value`, `currency: PLN`) | — | `CheckoutLink.tsx` (nowy komponent, `onClick`) na `poradnik-wlasny-salon/page.tsx` |

`view_item` na `poradnik-wlasny-salon/page.tsx` był już wcześniej (pod nazwą Meta `ViewContent`) —
przemianowany na klucz wewnętrzny, treść bez zmian, żeby nie dublować.

## 2. Jak działa deduplikacja Meta (Pixel przeglądarka ↔ Conversions API)

1. Klient (`LeadForm.tsx`, `Quiz.tsx`, `AcademyRegistrationForm.tsx`) generuje `crypto.randomUUID()`
   **przed** wysyłką i wysyła go w body jako `eventId`.
2. Serwer (`/api/lead`, `/api/akademia/rejestracja`) używa **DOKŁADNIE TEGO SAMEGO** `eventId` w
   wywołaniu CAPI — nigdy nie generuje własnego w zastępstwie (`shouldSendCapi` w
   `meta-capi-core.ts` zwraca `false`, gdy `eventId` brakuje — lepiej nie wysłać CAPI wcale, niż
   wysłać z innym ID i zdublować zdarzenie w raportach Mety).
3. Dla `Lead`: `eventId` leci do `sessionStorage` (`LeadForm.tsx`/`Quiz.tsx` → `LEAD_SEGMENT_KEY`),
   `LeadConversion.tsx` na `/dziekujemy` go odczytuje i przekazuje do `fbq(...,{eventID})`
   oraz jako `transaction_id` konwersji Google Ads (Ads ma WŁASNY, niezależny mechanizm dedup —
   ten sam numer spina oba systemy, ale to nie jest to samo pole ani ten sam mechanizm).
4. Dla `SubmitApplication`: strona się nie przeładowuje, więc `eventId` zostaje w pamięci
   komponentu i `trackEvent("sign_up", …, {eventId})` leci od razu po `res.ok`.
5. Meta dopasowuje po parze `(event_name, event_id)` w oknie 48h — `event_name` musi się zgadzać
   między Pixelem a CAPI (obie strony wysyłają dosłownie `"Lead"`/`"SubmitApplication"`).

## 3. Zgoda marketingowa — DWA RÓŻNE POLA, świadoma decyzja nazewnicza

🔴 **Odstępstwo od pierwotnego brief-u, do potwierdzenia przez CEO:** brief nazwał pole „przekazane
w body jako `marketingConsent`, odczytane z `readConsent()`". W `leadSchema` **już istniało** pole
`marketingConsent` — to zgoda kursantki na **newsletter e-mailowy** (zapisywana jako
`marketingConsentAt`, inna podstawa prawna: dobrowolna zgoda na komunikację handlową, niezależna
od zgody na przekazanie danych trenerce). Użycie tej samej nazwy dla zgody z BANERA COOKIES
(`readConsent().marketing` — zgoda na profilowanie reklamowe Meta/Google) albo skorumpowałoby ten
rekord, albo uzależniłoby CAPI od tego, czy ktoś chce newsletter (bez związku z celem CAPI).

**Rozwiązanie:** nowe pole **`adConsent`** (`leadSchema`, `academyRegistrationSchema`) —
wypełniane po stronie klienta z `readConsent()?.marketing === true`, gate'uje WYŁĄCZNIE wysyłkę do
Meta Conversions API. `marketingConsent` (newsletter) zostaje bez zmian.

## 4. Zmienne środowiskowe (Coolify)

| Zmienna | Skąd wziąć | Bez niej |
|---|---|---|
| `META_CAPI_TOKEN` | Meta Events Manager → dataset `2307645766669921` → Ustawienia → Conversions API → „Wygeneruj token dostępu" | CAPI po cichu wyłączone — jedna linia w logu przy pierwszym wywołaniu (`[meta-capi] … wyłączone`), `/api/lead` i `/api/akademia/rejestracja` działają normalnie (Pixel przeglądarkowy nadal śle zdarzenia) |
| `META_PIXEL_ID` (albo istniejące `NEXT_PUBLIC_META_PIXEL_ID`) | to samo `2307645766669921` | jak wyżej — CAPI wyłączone (brak ID = brak endpointu) |
| `META_CAPI_TEST_EVENT_CODE` | Events Manager → zakładka „Testowanie zdarzeń" (kod widoczny tylko gdy ta zakładka jest otwarta) | brak — CAPI po prostu leci na produkcyjny strumień zdarzeń zamiast do podglądu testowego |
| `META_CAPI_API_VERSION` | opcjonalne — domyślnie `v23.0` (patrz §6) | używana wartość domyślna |

Reszta zmiennych (`GA4_ID`, `GOOGLE_ADS_ID`, `GOOGLE_ADS_LEAD_LABEL`) już istnieje — bez zmian,
czytane przez `/api/analytics-config` (wzorzec opisany w tamtym pliku, nie dotknięty tą gałęzią).

## 5. Poprawka podwójnego strzału na `/dziekujemy` (kryterium akceptacji #6)

Stary `LeadConversion.tsx` renderował `<TrackEvent event="Lead">` **bezwarunkowo** — nawet gdy w
`sessionStorage` nie było segmentu (bo poprzedni odczyt go już skasował). Efekt: **każde**
odświeżenie albo powrót na `/dziekujemy` (np. przycisk „wstecz" w przeglądarce) wysyłał drugi
`Lead` do Mety i drugą konwersję do Google Ads. Teraz: brak segmentu **ALBO** brak w nim `eventId`
→ `LeadConversion` nic nie wysyła. Zweryfikowane ręcznie (patrz §0, „Weryfikacja", ostatni punkt).

## 6. Wersja Graph API (Meta)

Sprawdzone 29.09.2026 na `developers.facebook.com/docs/graph-api/changelog/versions/`:

| Wersja | Wydana | Wygasa |
|---|---|---|
| v26.0 (najnowsza) | 29.07.2026 | — |
| v25.0 | 18.02.2026 | 29.07.2028 |
| v24.0 | 08.10.2025 | 18.02.2028 |
| **v23.0 (domyślna w kodzie)** | 29.05.2025 | **08.10.2027** |
| v22.0 | 21.01.2025 | 20.05.2027 |
| v21.0 | 02.10.2024 | 21.01.2027 |

Wybrano **v23.0**, nie najnowszą v26.0 — to projekt, który Bartek odpala w cyklach binge i może
nie dotknąć miesiącami; v23.0 ma ponad rok zapasu do wygaśnięcia i jest przetestowaną, stabilną
wersją. Nadpisywalne przez `META_CAPI_API_VERSION`, gdyby CEO chciał wymusić inną.

## 7. Jak przetestować po deployu

1. **Meta**: Events Manager → dataset `2307645766669921` → zakładka „Testowanie zdarzeń" →
   skopiuj kod testowy do `META_CAPI_TEST_EVENT_CODE` w Coolify → redeploy → wyślij testowy lead →
   zdarzenie `Lead` powinno pojawić się w podglądzie z dwoma źródłami: „Przeglądarka" i „Serwer" —
   to jest widoczne potwierdzenie, że deduplikacja działa (jedno zdarzenie, dwa źródła, ten sam
   `event_id`).
2. **GA4**: Admin → DebugView (albo rozszerzenie „Google Analytics Debugger") → wyślij testowy
   lead → `generate_lead` powinien pojawić się w czasie rzeczywistym z parametrami
   `lead_source`/`wojewodztwo`/`kategoria`. **Do zrobienia przez CEO w panelu**: oznaczyć
   `generate_lead` jako zdarzenie kluczowe (Admin → Zdarzenia) — to jest cała przyczyna „0
   konwersji" sprzed tej pracy, kod już wysyła zdarzenie poprawnie.
   `lead_source`, `wojewodztwo`, `kategoria` to **własne parametry** — żeby były widoczne w
   raportach (nie tylko w DebugView), trzeba je zarejestrować jako **niestandardowe wymiary**
   (Admin → Niestandardowe definicje).
3. **Google Ads**: zainstaluj rozszerzenie „Tag Assistant Legacy" albo „Google Tag Assistant" →
   wyślij testowy lead na `/dziekujemy` → sprawdź, czy tag `AW-10793969605` zarejestrował
   zdarzenie `conversion` z `send_to` zawierającym etykietę `Mq-qCK6jqPIcEMXP-5oo`. Po kilku
   testowych konwersjach status akcji w Google Ads powinien zmienić się z „Nieaktywna" na
   „Brak ostatnich konwersji" → „Aktywna".

## 8. Co jest pewne / co jest hipotezą / czego nie sprawdzono

**Pewne (zweryfikowane testem albo w realnej przeglądarce):**
- Mapa zdarzeń i budowa payloadu CAPI (`npm run test:tracking`, 50/50 testów OK).
- Hash e-maila/telefonu — wektor niezależny od własnej implementacji (`shasum -a 256` w shellu).
- Niezależność kanałów Meta/GA4/Ads na SZTUCZNYM wyścigu (symulacja w `scripts/test-tracking.ts`
  + potwierdzenie w realnym Chrome, że NOWY kod poprawnie wysyła `QuizStart`/`Lead` do Mety
  (z `eid`), do GA4 (`generate_lead` z `lead_source`, nie `content_name`) i do Ads
  (`dataLayer`: `set user_data` → `event conversion` z `transaction_id`).
- Kryterium akceptacji #2: zgoda tylko `analytics` → `fbq` nigdy się nie definiuje, `dataLayer`
  bez żadnego wpisu `AW-`, zero żądań do domen Mety. Zweryfikowane bezpośrednio w przeglądarce.
- Poprawka podwójnego strzału na `/dziekujemy`: na STARYM kodzie każde odświeżenie wysyłało
  kolejny `Lead`/konwersję Ads; na NOWYM — zero. Zweryfikowane na obu wersjach kodu.
- **Test rozstrzygający (`git switch --detach` na commit sprzed gałęzi, patrz §0): stary kod, na
  w pełni załadowanej stronie (bez wyścigu), POPRAWNIE wysyłał `Lead` do Mety i Ads.** Czyli
  race-condition w starym `TrackEvent.tsx` jest realnym błędem (reprodukowanym na sztucznie
  opóźnionych skryptach), ale NIE jest potwierdzoną przyczyną zera na produkcji.
- Zgodność z gałęzią `mobile/optymalizacja` (drugi deweloper): `git merge-tree --write-tree
  analityka/zdarzenia mobile/optymalizacja` — **brak konfliktów**. Ta gałąź dziś dotyka
  `LeadFormModal.tsx`, `CookieConsent.tsx`, `Navbar.tsx`, `StickyConsultationCta.tsx`,
  `src/app/(public)/page.tsx` i FAQ w `poradnik-wlasny-salon/page.tsx` (padding pod cel dotykowy,
  poza obszarem, który tu zmieniłem) — **NIE `Quiz.tsx` ani `LeadForm.tsx`** wbrew opisowi w
  brief-ie (być może jeszcze nie doszła do tych plików w chwili pisania brief-u). Zmiany w tej
  gałęzi na `Quiz.tsx`/`LeadForm.tsx` i tak zostały ograniczone do logiki poza JSX-em, więc
  ryzyko konfliktu zostaje niskie nawet gdyby tamta gałąź dotarła tam później.
- `npx tsc --noEmit`, `npm run test:tracking`, `npm run build` — zielone.

**Hipoteza (logicznie wynika z kodu, nie zweryfikowana na produkcyjnym ruchu):**
- **Hipoteza A (nikt/mało kto daje zgodę marketingową) POZOSTAJE OTWARTA i jest dziś bardziej
  prawdopodobnym wyjaśnieniem niż race-condition** — patrz test rozstrzygający wyżej. Do
  zweryfikowania: odsetek `marketing:true` wśród realnych decyzji banera (dziś nie mierzony —
  proponowana jedna linia w `logAudit` przy `lead_utworzony` z `adConsent`, żeby to liczyć
  z własnych danych zamiast zgadywać, patrz commit z tej gałęzi).
- Trzecia możliwość, niezależna od A i B: Meta może ograniczać/filtrować zdarzenia dla kont
  zaklasyfikowanych jako zdrowie/wellness — kategoria „med. estetyczna" jest w `CATEGORIES`.
  To sprawdza CEO w zakładce Diagnostyka Menedżera zdarzeń (ta sama karta, którą CEO miał otwartą
  podczas tej sesji) — poza zasięgiem kodu.
- Poprawiona niezależność kanałów i tak jest czystym usunięciem realnego ryzyka (LeadForm z modala
  wypełniony bardzo szybko zaraz po zgodzie, wolne łącze, słaby telefon) — zostaje w kodzie
  niezależnie od tego, która hipoteza wygra.

**Niesprawdzone / poza zakresem tej pracy:**
- Źródło 5 zdarzeń „Contact" w Meta sprzed tej gałęzi (patrz §0) — historia repo i pixel ID
  sprawdzone lokalnie (obie ścieżki czyste), ale to nie obejmuje panelu Meta ani integracji
  naffy, do których nie mam dostępu z tej gałęzi.
- Realny wskaźnik zgody marketingowej wśród użytkowniczek UB — do sprawdzenia w Google
  Analytics/Meta po tygodniu ruchu, albo z audytu `logAudit` po dodaniu `adConsent` (patrz wyżej).
- Zachowanie na produkcyjnym Coolify (build w Dockerze, zmienne env wstrzykiwane w runtime) —
  przetestowane lokalnie (`npm run build` na tym samym Node 20-kompatybilnym kodzie), ale nie na
  faktycznym kontenerze.
- Czy `allow_enhanced_conversions` trzeba dodatkowo ustawić w `gtag('config', adsId, …)` — kod
  wysyła `gtag('set','user_data',...)` zgodnie z aktualną dokumentacją Google (obsługiwane bez tej
  flagi w standardowym tagu strony), ale nie zweryfikowano tego w panelu Google Ads (wymaga
  realnego konta z FID/kontem reklamowym) — **do zrobienia przez CEO**: sprawdzić w ustawieniach
  akcji konwersji `Mq-qCK6jqPIcEMXP-5oo`, czy enhanced conversions dla leadów jest włączone.
- Czy prawdziwe konto Google Ads faktycznie zarejestruje konwersję wysłaną przez `dataLayer`
  (kod wywołuje `gtag('event','conversion',...)` poprawnie — zweryfikowane; przyjęcie przez
  serwery Google z realnym `AW-10793969605` nie było testowane, wymaga Tag Assistant po deployu).
