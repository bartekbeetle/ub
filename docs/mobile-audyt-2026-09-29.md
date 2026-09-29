# Audyt mobile UB — 2026-09-29

Gałąź: `mobile/optymalizacja`, worktree `~/Projects/ub-wt-mobile`, baza `c3ec530`.
Metoda: CDP (Chrome DevTools Protocol) z prawdziwą emulacją urządzenia
(`Emulation.setDeviceMetricsOverride`, `mobile:true`, dotyk włączony, UA iPhone/Safari 17.4)
— headless Chrome sam z siebie zacina viewport na 500px, więc `--window-size=360` daje kadr
z układu 500px, nie prawdziwy telefon. Skrypt: `narzedzia-marki/cdp.py` (wzięty z repo Rolbud)
+ własny `audit.py` (w scratchpadzie sesji, nie w repo) liczący na żywo: `scrollWidth` vs
`innerWidth`, listę elementów węższych/szerszych niż viewport, cele dotykowe < 44×44 (z hit-boxem
`<label>`, jeśli input jest w środku), font-size/`inputmode`/`autocomplete` na polach formularzy,
oraz `elementFromPoint` (hit-test — czy element pod danym punktem realnie jest tym, na co ma
wyglądać, nie czymś go zasłaniającym).

Lighthouse: 3 przebiegi per strona, **mediana**, na buildzie produkcyjnym (`npm run build && npx next start -p 3010`),
nigdy na `next dev` (dev server współdzieli `.next` z buildem — nie mogą działać równolegle).

## 1. Baza (przed zmianami)

| Strona | 360×780 overflow | 390×844 overflow | Uwagi |
|---|---|---|---|
| `/` | brak | brak | — |
| `/kurs/[slug]` (makijaż permanentny brwi, Katowice) | brak | brak | CTA karty rezerwacji ląduje pod całą treścią na mobile (lg:sticky nie działa < lg) |
| `/blog/[slug]` z tabelą markdown | brak | brak | tabela ma własny `overflow-x:auto` (`.prose-ub table`) — scrolluje się wewnątrz, nie rozpycha strony |
| `/dla-akademii` | brak | brak | — |
| `/aplikacja` (quiz, 7 kroków) | brak | brak | — |
| `/dziekujemy` | brak | brak | — |
| `/poradnik-wlasny-salon` | brak | brak | — |

**Zero poziomego scrolla na starcie** — kod już wcześniej przechodził dużą część checklisty
(dokumentowane komentarze WCAG w `globals.css`, `min-h-[44px]` na `.btn-*`/`.input`, `text-base`
na polach formularzy, `inputMode`/`autoComplete` w Quiz.tsx i LeadForm.tsx). Realna robota tej
sesji to były **cztery konkretne, zmierzone regresje/przeoczenia**, nie generalny remont.

## 2. Znalezione problemy

| # | Strona / komponent | Problem | Ważność | Naprawione |
|---|---|---|---|---|
| 1 | `LeadFormModal.tsx` (przycisk X) | Cel dotykowy 40×40px, pod progiem 44px | 🟡 średnia | ✅ tak — ale **komponent nie jest dziś nigdzie renderowany** (zweryfikowane grepem: `LeadFormModal` używany tylko we własnym pliku). Zero wpływu na produkcję dziś, zabezpieczone na przyszłość. |
| 2 | `LeadFormModal.tsx` | `max-h-[85vh]` zamiast `dvh` — na telefonie z paskiem adresu/dolnym menu treść może wyjść poza realnie widoczny obszar | 🟡 średnia | ✅ tak (jw. — dead code dziś) |
| 3 | `CookieConsent.tsx` na `/aplikacja` (krok 7 quizu) | **Baner cookies zakrywał 42% wysokości przycisku „Aplikuj o dofinansowanie"** przy otwartym banerze na 360×640 — zmierzone przez `getBoundingClientRect`: przycisk 528–604px, baner 249–560px. Środek przycisku (566px) wypadał tuż pod banerem, więc hit-test technicznie przechodził, ale wizualnie widoczne były tylko dwie ostatnie litery napisu. | 🔴 wysoka | ✅ tak |
| 4 | `CookieConsent.tsx` | `max-h-[70vh]` zamiast `dvh` | 🟢 niska | ✅ tak |
| 5 | `CookieConsent.tsx` — „Ustawienia szczegółowe” | Cel dotykowy 143×16px | 🟢 niska | ⚠️ częściowo — 16px → 32px. Nie 44px: to trzeciorzędna akcja (rozwinięcie kategorii cookies) wewnątrz już otwartego banera, nie ścieżka konwersji. Dalsze powiększanie wymagałoby zmiany układu banera. |
| 6 | `StickyConsultationCta.tsx` na `/kurs/[slug]` | Przyklejony pasek na dole pokazywał generyczną „Bezpłatną Konsultację” prowadzącą do **innego** lejka niż CTA karty kursu („Aplikuj o dofinansowanie” → `/aplikacja?kurs=<slug>`). Użytkowniczka czytająca o konkretnym kursie mogła trafić do ogólnej rozmowy zamiast aplikacji na TEN kurs. | 🟡 średnia (konwersja) | ✅ tak |
| 7 | `page.tsx` (FAQ home) i `poradnik-wlasny-salon/page.tsx` (FAQ) | Padding (`py-5`/`py-4`) siedział na `<details>` (nieklikalny wrapper), nie na `<summary>` (jedyny klikalny element) — realny cel dotykowy otwierający pytanie miał ~28px wysokości mimo wizualnego odstępu 40px+ dookoła | 🟡 średnia | ✅ tak — przeniesione na `<summary>` (przed) + `pb` na odpowiedź (po), wizualny odstęp bez zmian (zweryfikowane zrzutem) |
| 8 | `Navbar.tsx` — logo | Cel dotykowy 259×28px w 64px belce nawigacji | 🟢 niska | ✅ tak — `min-h-[44px]`, logo wizualnie w tym samym miejscu |
| 9 | `Footer.tsx` — linki stopki | 36px wysokości (dokumentowana decyzja z przeszłości: WCAG 2.5.8 AA wymaga 24px, tu jest 36px) | 🟢 niska | ❌ nie — zostawione świadomie. Podniesienie do 44px na 9 linkach w stopce znacząco wydłużyłoby stopkę na telefonie bez realnej korzyści konwersyjnej (to nie ścieżka do leada). Już dziś nad progiem WCAG AA. |
| 10 | `Breadcrumbs.tsx` | Linki okruszkowe 28px wysokości | 🟢 niska | ❌ nie — nawigacja pomocnicza, nie ścieżka konwersji, nad progiem WCAG AA (28px > 24px) |
| 11 | Wszystkie strony | Inline text linki (`.link-inline` w akapitach) < 44px | — | ❌ nie — WCAG 2.5.8 wprost wyłącza linki w bloku tekstu z wymogu 44px |
| — | Quiz.tsx, LeadForm.tsx | Font 16px, `inputMode`, `autoComplete`, `min-h-[44px]` na wszystkich polach i pill-buttonach | — | ✅ już wcześniej — zweryfikowane, nie ruszone (poza zakresem: logika `fetch`/`sessionStorage` nietknięta) |

## 3. Lighthouse mobile — przed / po (mediana z 3 przebiegów, build produkcyjny)

| Strona | Performance | Accessibility | Best Practices | LCP | CLS | TBT |
|---|---|---|---|---|---|---|
| `/` — przed | 91 | 100 | 100 | 3453 ms | 0,045 | 4 ms |
| `/` — po | 91 | 100 | 100 | 3453 ms | 0,041 | 5 ms |
| `/kurs/[slug]` — przed | 92 | 100 | 100 | 3377 ms | 0,000 | 2 ms |
| `/kurs/[slug]` — po | 92 | 100 | 100 | 3377 ms | 0,000 | 3 ms |
| `/blog/[slug]` — przed | 92 | 100 | 100 | 3377 ms | 0,000 | 3 ms |
| `/blog/[slug]` — po | 92 | 100 | 100 | 3377 ms | 0,000 | 2 ms |

Accessibility już przed zmianami było 100/100 na wszystkich trzech stronach (kontrasty i etykiety
były już dopięte wcześniej — patrz komentarze WCAG w `globals.css`). Zero regresji performance/CLS,
różnice rzędu 1-2 punktów mieszczą się w szumie pomiarowym Lighthouse.

## 4. Kryteria akceptacji — status

| # | Kryterium | Status |
|---|---|---|
| 1 | Zero poziomego scrolla na 360px na wszystkich stronach z punktu 2 | ✅ — `scrollWidth <= innerWidth` na wszystkich 7 stronach × 2 viewporty (14/14) |
| 2 | Pola formularza/quizu: font ≥16px, poprawne `type`/`inputMode`/`autoComplete` | ✅ — zweryfikowane CDP na krokach 1 i 2 quizu (imię, e-mail, kategoria, województwo, miasto, kod pocztowy) |
| 3 | Przycisk wysyłki i przyciski quizu widoczne/klikalne przy otwartym banerze na 360×640 | ✅ — naprawione (problem #3), potwierdzone hit-testem `elementFromPoint` i zrzutem przed/po |
| 4 | Lighthouse: accessibility ≥95 i CLS ≤0,1 na 3 stronach, performance bez regresji | ✅ — 100/100 a11y, CLS ≤0,045, performance identyczne |
| 5 | `tsc` bez błędów, build produkcyjny przechodzi | ✅ |
| 6 | Żaden plik z listy „nie ruszaj” nie ma zmian względem `main` | ✅ — zweryfikowane `git diff` (patrz §6) |

## 5. Czego NIE naprawiono i dlaczego

- **Footer i Breadcrumbs (36px / 28px)** — nad progiem WCAG AA (24px), nie na ścieżce konwersji
  (lead → quiz → dziękujemy). Podniesienie do 44px wymagałoby powiększenia stopki na każdej
  stronie kosztem miejsca, bez dowodu że to dziś coś blokuje. Zostawione świadomie.
- **„Ustawienia szczegółowe” w banerze cookies** — poprawione z 16px do 32px, nie do 44px:
  dalsze powiększanie wymagałoby przebudowy układu przycisków w banerze, a to trzeciorzędna
  akcja (rozwinięcie kategorii), nie ścieżka konwersji.
- **Occlusion klawiaturą ekranową** — nie da się tego zmierzyć w headless Chrome (nie ma
  prawdziwej klawiatury systemowej). Sprawdzone tylko na małej wysokości viewportu (640px),
  co symuluje część efektu (mniej miejsca), ale nie 1:1 z realną klawiaturą iOS/Android.
  Rekomendacja: sprawdzić ręcznie na fizycznym telefonie przed startem kampanii FB.
- **`LeadFormModal.tsx` jako całość** — komponent jest dziś martwym kodem (nieużywany nigdzie
  w aplikacji, zweryfikowane grepem). Poprawiony na wszelki wypadek, ale nie testowany
  end-to-end w realnym flow, bo takiego flow dziś nie ma.
- **Sticky CTA na `/poradnik-wlasny-salon`** — strona ma własny przycisk zakupu (naffy),
  sticky bar jest tam celowo wyłączony od dawna (komentarz w kodzie) — nie ruszane.

## 6. Merge hygiene

```
git diff c3ec530 --stat -- src/components/{TrackEvent,Analytics,LeadConversion}.tsx src/app/api 'src/lib/consent*'
→ pusto

git diff c3ec530 -- src/components/{Quiz,LeadForm}.tsx | grep -E 'fetch|sessionStorage|res\.|await'
→ pusto (Quiz.tsx i LeadForm.tsx w ogóle nietknięte)
```

⚠️ **Uwaga dla scalającego:** gałąź `mobile/optymalizacja` odgałęziona z `c3ec530`. W międzyczasie
`main` w `~/Projects/uniwersytet-beauty-v2` poszedł do przodu o commit `42999d6` (link do
`/poradnik-wlasny-salon` w stopce i na `/poradnik`) — **niezwiązany z tą pracą**, zrobiony przez
kogoś innego w trakcie tej sesji. `git diff main` pokaże te linie jako „usunięte” w tej gałęzi —
to fałszywy alarm wynikający z tego, że main uciekł do przodu, nie regresja mojej roboty. Scalaj
przez `git merge` (nie fast-forward nadpisujący), a nie zniknie link w stopce. Zweryfikowane
osobno przez `git diff c3ec530` (merge-base), patrz wynik czysty wyżej.

## 7. Zrzuty ekranu

Wszystkie w `docs/mobile-zrzuty/`, emulacja 390×844 (lub 360×640 tam gdzie porównanie dotyczy
tego viewportu), DPR 3, iOS Safari UA, dotyk włączony:

| Plik | Co pokazuje |
|---|---|
| `01-quiz-krok7-baner-PRZED.jpg` | Problem #3 — przycisk „Aplikuj o dofinansowanie” w 42% zakryty banerem cookies (360×640) |
| `02-quiz-krok7-baner-PO.jpg` | Po naprawie — przycisk w pełni widoczny pod banerem |
| `03-home-baner-sticky-PO.jpg` | Strona bez zmiany (bottom-20 niedotknięty) — sticky „Bezpłatna Konsultacja” nadal w pełni widoczna pod banerem, potwierdza brak regresji |
| `04-kurs-sticky-cta-PO.jpg` | Problem #6 po naprawie — sticky bar na `/kurs/[slug]` pokazuje „Aplikuj o dofinansowanie” zamiast generycznej konsultacji |
| `05-blog-sticky-konsultacja-referencja.jpg` | Referencja — na stronie bloga (nie-kurs) sticky bar poprawnie nadal pokazuje generyczną „Bezpłatną Konsultację” |
| `06-home-faq-otwarte-PO.jpg` | Problem #7 po naprawie — wizualny odstęp akordeonu FAQ identyczny jak przed zmianą, mimo przeniesienia paddingu |

## 8. Zmienione pliki (poza zakresem „nie ruszaj”)

- `src/components/LeadFormModal.tsx`
- `src/components/CookieConsent.tsx`
- `src/components/layout/StickyConsultationCta.tsx`
- `src/components/layout/Navbar.tsx`
- `src/app/(public)/page.tsx`
- `src/app/(public)/poradnik-wlasny-salon/page.tsx`

`src/components/Quiz.tsx` i `src/components/LeadForm.tsx` — **nietknięte, zero zmian** (były już
zgodne z checklistą: `text-base`, `min-h-[44px]`, `inputMode`, `autoComplete` na wszystkich polach).
