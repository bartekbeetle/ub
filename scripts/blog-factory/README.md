# Fabryka wpisów geo-SEO

Maszyna do produkcji wpisów blogowych pod frazy **kategoria × miasto** („kurs przedłużania rzęs Wrocław").
Cel: zbierać long tail — pojedyncze kliknięcia z dziesiątek małych fraz, których nie opłaca się obsługiwać ręcznie.

## Uruchomienie

```bash
npm run blog:generuj          # wygeneruj wpisy do content/blog/geo-*.md
npm run blog:qa               # bramka jakości (kod wyjścia 1 = nie publikuj)
npm run blog:build            # generuj + QA + seed do bazy, jedną komendą

npx tsx scripts/blog-factory/generuj.ts --dry        # tylko plan, nic nie zapisuje
npx tsx scripts/blog-factory/generuj.ts --prog 10    # zejdź głębiej w long tail
```

Pliki generowane mają prefiks `geo-` i pole `generator: blog-factory` we frontmatterze.
Wpisy pisane ręcznie (`ub-blog-*.md`) są nietykalne — generator sprawdza zajęte slugi i je omija.

## Jak dodać nowe wpisy

Nie pisząc kodu — same dane:

1. **Nowe miasto** → `dane/lokalizacje.ts`. Wymagane formy odmienione (`wMiescie`, `dopelniacz`)
   i `tier` (metropolia / duze / mniejsze) sterujący akapitem o poziomie cen.
2. **Nowa kategoria** → `dane/kategorie.ts`. Potrzebuje merytoryki (`coObejmuje`, `coPotrafisz`),
   **6 wariantów ujęcia**, **6 pytań FAQ**, widełek cen i slugu wpisu-huba do linkowania w górę.
3. **Nowa fraza** → `dane/frazy.ts` wraz z wolumenem i źródłem.
4. `npm run blog:build`.

## Zasady wbudowane w maszynę

1. **Strona powstaje tylko dla zweryfikowanej frazy.** Nie generujemy 16 województw × 8 kategorii
   „na wszelki wypadek" — to wzorzec stron-wrót (doorway pages), za który Google karze.
   Fraza bez wolumenu w `dane/frazy.ts` = brak strony.
2. **Rotacja wariantów.** Wpisy tej samej kategorii dostają inny akapit otwierający, inną sekcję
   pogłębiającą i inny zestaw 3 pytań FAQ z puli 6. Bez tego sześć stron „kursu paznokci"
   byłoby sześcioma kopiami z podmienioną nazwą miasta.
3. **Odmiana z danych, nie ze sklejania.** „we Wrocławiu", nie „w Wrocław"; „ze stylizacji paznokci",
   nie „z stylizacja paznokci". QA ma osobną regułę na tę klasę błędów, bo wyszły w pierwszym batchu.
4. **Guardrail ceny.** Nigdy „0 zł", „za darmo", „bezpłatny kurs" o szkoleniu — tylko wkład własny
   i procent dofinansowania. QA traktuje złamanie tego jako błąd blokujący.
5. **Fakty zmienne nie wchodzą w treść.** Operatorzy BUR i nabory zmieniają się co kilka miesięcy,
   więc wpisy nie podają nazw operatorów ani kwot naboru — odsyłają do PARP i do konsultacji.
   To jednocześnie jest usługa UB, więc zmienność działa na naszą korzyść.
6. **Nie linkujemy do `/kursy?kategoria=...`** dopóki filtr kategorii na produkcji nie filtruje
   (rozjazd słownika: baza ma `Makijaż permanentny`, aplikacja zna `PMU / Makijaż permanentny`).

## Bramka jakości sprawdza

- długości `title` (≤60) i `metaDescription` (≤158), obecność `excerpt`
- guardrail ceny (błąd dla wpisów z generatora, ostrzeżenie dla ręcznych)
- błędy odmiany po przyimkach
- nierozwinięte placeholdery, duplikaty slugów
- **podobieństwo treści** między wpisami generatora (Jaccard na 5-gramach); >75% = błąd

Stan przy pierwszym batchu (21 wpisów): max 62%, średnie 35%. Reszta pokrycia to opis samego
kursu, który dla jednej kategorii jest z definicji wspólny.

## Czego maszyna NIE robi

- nie wymyśla danych o operatorach ani o dostępności trenerek w mieście
- nie twierdzi, że mamy trenerkę w danym mieście (nie mamy — poza Tychami)
- nie publikuje sama: `blog:qa` musi przejść, seed i deploy są osobnym krokiem

## Po publikacji

Pierwszy batch to hipoteza, nie pewnik. Po 3-4 tygodniach sprawdź w Search Console, które wpisy
weszły do indeksu i zbierają wyświetlenia. Wpisy, które nie łapią nic, są sygnałem, że warstwa
lokalna jest za cienka — wtedy albo pogłębiamy treść, albo kasujemy stronę. Nie zostawiamy
w indeksie stron, które nic nie robią.
