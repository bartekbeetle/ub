/**
 * Fabryka wpisów geo-SEO: kategoria × miasto → content/blog/*.md
 *
 * Uruchomienie:
 *   npx tsx scripts/blog-factory/generuj.ts            # generuje wpisy powyżej progu
 *   npx tsx scripts/blog-factory/generuj.ts --prog 10  # schodzi głębiej w long tail
 *   npx tsx scripts/blog-factory/generuj.ts --dry      # pokazuje plan, nic nie zapisuje
 *
 * Potem: npm run db:seed-blog  (idempotentny upsert po slugu)
 *
 * ZASADY WBUDOWANE W MASZYNĘ:
 * 1. Strona powstaje wyłącznie dla frazy ze zweryfikowanym wolumenem (dane/frazy.ts).
 * 2. Wpisy tej samej kategorii dostają różne warianty ujęcia — rotacja po indeksie miasta.
 * 3. Odmiana miast bierze się z danych, nie ze sklejania stringów („we Wrocławiu", nie „w Wrocław").
 * 4. Guardrail ceny: mówimy o wkładzie własnym i procencie, nigdy o „0 zł" ani „za darmo".
 * 5. Nie linkujemy do /kursy?kategoria=... — filtr kategorii na produkcji nie filtruje
 *    (rozjazd słownika kategorii), więc do czasu naprawy kierujemy na /kursy i /konsultacja.
 */

import { mkdirSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { KATEGORIA_PO_SLUGU, type Kategoria } from "./dane/kategorie";
import { LOKALIZACJA_PO_SLUGU, type Lokalizacja } from "./dane/lokalizacje";
import { FRAZY, PROG_WOLUMENU } from "./dane/frazy";

const BLOG_DIR = join(process.cwd(), "content", "blog");
const PREFIX = "geo-";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const progIdx = args.indexOf("--prog");
const prog = progIdx >= 0 ? Number(args[progIdx + 1]) : PROG_WOLUMENU;

/** Slugi zajęte przez wpisy pisane ręcznie — fabryka nie może ich nadpisać. */
function zajeteSlugi(): Set<string> {
  const zajete = new Set<string>();
  for (const plik of readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md") && !f.startsWith(PREFIX))) {
    const m = readFileSync(join(BLOG_DIR, plik), "utf8").match(/^slug:\s*"?([^"\n]+)"?/m);
    if (m) zajete.add(m[1].trim());
  }
  return zajete;
}

function zl(n: number): string {
  return n.toLocaleString("pl-PL").replace(/ /g, " ");
}

function lista(items: string[]): string {
  return items.map((i) => `- ${i}`).join("\n");
}

function czasCzytania(tekst: string): number {
  return Math.max(4, Math.round(tekst.split(/\s+/).length / 200));
}

/**
 * Akapit o poziomie cen zależny od wielkości rynku. To nie jest wariacja dla samej wariacji —
 * stawki w metropolii realnie stoją przy górnej granicy widełek, a w mniejszym mieście przy dolnej,
 * więc ta sama informacja o cenie znaczy co innego w Warszawie i w Płocku.
 */
function akapitCenowy(k: Kategoria, l: Lokalizacja): string {
  if (l.tier === "metropolia") {
    return (
      `${l.nazwa} należy do najdroższych rynków szkoleniowych w kraju, więc ceny kursów ${k.etykietaDopelniacz} układają się tu bliżej ` +
      `górnej granicy widełek. Płacisz w tym za gęstszy kalendarz terminów i większy wybór akademii — przy szkoleniach ` +
      `kilkudniowych to realna wygoda, bo łatwiej dopasować kurs do grafiku pracy.`
    );
  }
  if (l.tier === "duze") {
    return (
      `Stawki ${l.wMiescie} mieszczą się w środku krajowych widełek. Wybór akademii jest wystarczający, żeby porównać ` +
      `co najmniej kilka programów, a różnice w cenie wynikają zwykle z liczby dni praktycznych, nie z samej lokalizacji.`
    );
  }
  return (
    `${l.nazwa} to mniejszy rynek, więc ceny kursów ${k.etykietaDopelniacz} bywają niższe niż w dużych miastach, ale terminów jest mniej ` +
    `i szybciej się zapełniają. Przy porównywaniu ofert warto zestawić kurs na miejscu z droższym szkoleniem w większym ` +
    `mieście powiększonym o dojazd — bilans wychodzi różnie i zależy głównie od liczby dni zajęć.`
  );
}

/** 3 pytania z puli 6, przesuwane wariantem — dwa wpisy tej samej kategorii dostają inny zestaw. */
function wybierzFaq(k: Kategoria, wariant: number) {
  const pula = k.faq;
  return [0, 1, 2].map((i) => pula[(wariant + i) % pula.length]);
}

type Plan = { kategoria: string; lokalizacja: string; fraza: string; wolumen: number; wariant: number };

function zbudujPlan(): Plan[] {
  const wybrane = FRAZY.filter((f) => f.wolumen >= prog).sort((a, b) => b.wolumen - a.wolumen);
  const licznikKategorii = new Map<string, number>();
  return wybrane.map((f) => {
    const i = licznikKategorii.get(f.kategoria) ?? 0;
    licznikKategorii.set(f.kategoria, i + 1);
    return { kategoria: f.kategoria, lokalizacja: f.lokalizacja, fraza: f.fraza, wolumen: f.wolumen, wariant: i };
  });
}

function zbudujWpis(plan: Plan): { slug: string; plik: string; tresc: string } {
  const k = KATEGORIA_PO_SLUGU.get(plan.kategoria);
  const l = LOKALIZACJA_PO_SLUGU.get(plan.lokalizacja);
  if (!k) throw new Error(`Brak kategorii w danych: ${plan.kategoria}`);
  if (!l) throw new Error(`Brak lokalizacji w danych: ${plan.lokalizacja}`);

  const w = k.warianty[plan.wariant % k.warianty.length];
  const slug = `kurs-${k.slug}-${l.slug}`;

  // Wkład własny: dofinansowanie w naborach mieści się zwykle w 80-90%, więc widełki
  // liczymy od dolnej ceny przy 90% do górnej ceny przy 80%. Nigdy nie schodzi do zera.
  const doplataOd = Math.round((k.cenaOd * 0.1) / 10) * 10;
  const doplataDo = Math.round((k.cenaDo * 0.2) / 10) * 10;

  const title = `${k.nazwaKursu} ${l.nazwa} — cena i dofinansowanie`;
  const metaDescription =
    `${k.nazwaKursu} ${l.wMiescie}: rynkowa cena ${zl(k.cenaOd)}-${zl(k.cenaDo)} zł, ` +
    `przy dofinansowaniu z BUR wkład własny zwykle ${zl(doplataOd)}-${zl(doplataDo)} zł. Program i zasady naboru.`;
  const excerpt =
    `Ile kosztuje ${k.nazwaKursu.toLowerCase()} ${l.wMiescie}, co obejmuje program i jak wygląda ścieżka ` +
    `dofinansowania z Bazy Usług Rozwojowych ${l.wWojewodztwie}.`;

  const body = `# ${k.nazwaKursu} ${l.wMiescie} — cena, program i dofinansowanie

${w.lead}

Poniżej rynkowe widełki cen, zakres programu i procedura dofinansowania obowiązująca ${l.wWojewodztwie}.

## Ile kosztuje ${k.nazwaKursu.toLowerCase()} ${l.wMiescie}

Ceny szkoleń ${k.zEtykieta} mieszczą się zwykle w przedziale **${zl(k.cenaOd)}-${zl(k.cenaDo)} zł** za program obejmujący ${k.godzinyOd}-${k.godzinyDo} godzin zajęć. Rozpiętość bierze się z liczby dni praktycznych, liczby uczestniczek przypadających na trenerkę oraz tego, czy materiały wchodzą w cenę.

${akapitCenowy(k, l)}

Przy szkoleniu rozliczanym z dofinansowania płacisz **wkład własny**, nie pełną kwotę. Operatorzy pokrywają najczęściej 80-90% ceny, co przy powyższych widełkach oznacza realną dopłatę rzędu **${zl(doplataOd)}-${zl(doplataDo)} zł**. Dokładny procent zależy od województwa, naboru i Twojej sytuacji zawodowej — dlatego kwotę zawsze potwierdza się przed podpisaniem umowy, nie po.

Szczegółowe rozliczenie znajdziesz we wpisie [${k.hubTytul}](/blog/${k.hubSlug}).

## Co obejmuje program

${lista(k.coObejmuje)}

Po ukończeniu szkolenia na tym poziomie potrafisz:

${lista(k.coPotrafisz)}

Kurs jest kierowany do ${k.dlaKogo}.

## ${w.sekcjaTytul}

${w.sekcjaTresc}

## Dofinansowanie ${l.wWojewodztwie}

Środki rozdziela **operator wyłoniony dla regionu**, a nie PARP centralnie. ${l.nazwa} leży ${l.wWojewodztwie}, więc obowiązuje Cię nabór prowadzony dla tego województwa — i to on wyznacza procent dofinansowania oraz terminy. Operatorzy zmieniają się wraz z kolejnymi naborami, część obsługuje wybrane podregiony, dlatego aktualny stan sprawdza się na [uslugirozwojowe.parp.gov.pl](https://uslugirozwojowe.parp.gov.pl), a nie w artykule sprzed pół roku.

Dwie zasady, które przesądzają o rozliczeniu: dofinansowanie obejmuje wyłącznie usługi **wpisane do Bazy**, a wniosek składa się **przed** szkoleniem, nie po. Całą procedurę rozkładamy w osobnym wpisie: [Dofinansowanie na szkolenie — krok po kroku](/blog/jak-dostac-dofinansowanie-na-kurs-beauty-krok-po-kroku). Jeżeli zakładasz, że dotyczy to tylko osób bezrobotnych — [tak nie jest](/blog/bur-nie-urzad-pracy-dofinansowanie-dla-pracujacych).

## ${l.nazwa} i okolica

Szkolenia ${l.wMiescie} wybierają też mieszkanki mniejszych miejscowości w zasięgu dojazdu — ${l.okolica.join(", ")}. Przy kursach trwających kilka dni pod rząd warto policzyć dojazd i ewentualny nocleg razem z ceną szkolenia, bo przy tańszych programach ta różnica potrafi zrównać koszt z droższym kursem bliżej domu.

Dofinansowanie przyznaje operator właściwy dla Twojego **miejsca zamieszkania**, nie dla miasta, w którym odbywa się szkolenie. Mieszkanie w innej miejscowości nie jest więc przeszkodą: szkolisz się ${l.wMiescie}, a środki rozliczasz w swoim regionie.

## Najczęstsze pytania

${wybierzFaq(k, plan.wariant).map((f) => `**${f.pytanie}**\n\n${f.odpowiedz}`).join("\n\n")}

**Czy szkolenie ${l.wMiescie} można rozliczyć z dofinansowania?**

Tak, o ile konkretna usługa jest wpisana do Bazy Usług Rozwojowych, a operator dla Twojego regionu prowadzi nabór. Obie rzeczy sprawdzamy przed zapisem — to element bezpłatnej konsultacji.

## Następny krok

Zostaw zgłoszenie, a sprawdzimy dwie rzeczy: czy operator ${l.wWojewodztwie} ma otwarty nabór i jaki poziom dofinansowania obejmuje Twoją sytuację zawodową. Następnie dopasujemy trenerkę prowadzącą szkolenia ${k.zEtykieta} w Twoim zasięgu.

[Sprawdź swoje dofinansowanie](/konsultacja) · [Przejrzyj katalog szkoleń](/kursy) · [Jak działają dofinansowania](/dofinansowania)
`;

  const frontmatter = `---
title: "${title}"
slug: "${slug}"
category: "Poradniki"
excerpt: "${excerpt}"
metaTitle: "${title}"
metaDescription: "${metaDescription}"
data: ${new Date().toISOString().slice(0, 10)}
reading_minutes: ${czasCzytania(body)}
target: kursantka (B2C)
fraza_glowna: "${plan.fraza}"
wolumen_frazy: ${plan.wolumen}
zrodlo_frazy: openseo-2026-07-28
generator: blog-factory
wariant: ${plan.wariant}
---

`;

  return { slug, plik: `${PREFIX}${slug}.md`, tresc: frontmatter + body };
}

const MARKER_START = "<!-- geo-links:start (blok zarządzany przez blog-factory — nie edytuj ręcznie) -->";
const MARKER_END = "<!-- geo-links:end -->";

/**
 * Dopisuje do wpisów-filarów listę linków W DÓŁ, do wpisów kategoria × miasto.
 *
 * Powód: wpisy geo linkują w górę do filara, ale filar nie linkował do nich wcale. Nowe strony
 * były osiągalne tylko z sitemapy i z paginowanej listy bloga, co spowalnia indeksację i marnuje
 * link equity filara. Klaster ma działać w obie strony.
 *
 * Blok jest ograniczony markerami i przepisywany w całości przy każdym uruchomieniu, więc ręcznie
 * pisana treść filara pozostaje nietknięta.
 */
function podlinkujFilary(plan: Plan[]): void {
  const wgFilara = new Map<string, { tytul: string; sciezka: string }[]>();
  for (const p of plan) {
    const k = KATEGORIA_PO_SLUGU.get(p.kategoria)!;
    const l = LOKALIZACJA_PO_SLUGU.get(p.lokalizacja)!;
    const lista = wgFilara.get(k.hubSlug) ?? [];
    lista.push({ tytul: `${k.nazwaKursu} ${l.nazwa}`, sciezka: `/blog/kurs-${k.slug}-${l.slug}` });
    wgFilara.set(k.hubSlug, lista);
  }

  const pliki = readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md") && !f.startsWith(PREFIX));
  for (const [hubSlug, linki] of wgFilara) {
    const plik = pliki.find((f) => {
      const m = readFileSync(join(BLOG_DIR, f), "utf8").match(/^slug:\s*"?([^"\n]+)"?/m);
      return m?.[1].trim() === hubSlug;
    });
    if (!plik) {
      console.warn(`⚠ nie znalazłem filara o slugu "${hubSlug}" — pomijam linkowanie`);
      continue;
    }

    linki.sort((a, b) => a.tytul.localeCompare(b.tytul, "pl"));
    const blok = [
      MARKER_START,
      "",
      "## Kursy w konkretnych miastach",
      "",
      "Ceny, terminy i ścieżka dofinansowania różnią się między regionami — poniżej rozpisane osobno:",
      "",
      ...linki.map((l) => `- [${l.tytul}](${l.sciezka})`),
      "",
      MARKER_END,
    ].join("\n");

    const sciezka = join(BLOG_DIR, plik);
    const tresc = readFileSync(sciezka, "utf8");
    const wzorzec = new RegExp(`${MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${MARKER_END}`);
    const nowa = wzorzec.test(tresc) ? tresc.replace(wzorzec, blok) : `${tresc.trimEnd()}\n\n${blok}\n`;
    if (nowa !== tresc) {
      writeFileSync(sciezka, nowa, "utf8");
      console.log(`  ↳ filar ${plik}: ${linki.length} linków w dół`);
    }
  }
}

function main() {
  mkdirSync(BLOG_DIR, { recursive: true });
  const zajete = zajeteSlugi();
  const plan = zbudujPlan();

  console.log(`Próg wolumenu: ${prog}/mies. → ${plan.length} wpisów do wygenerowania\n`);

  let zapisane = 0;
  for (const p of plan) {
    const wpis = zbudujWpis(p);
    if (zajete.has(wpis.slug)) {
      console.warn(`⚠ POMIJAM ${wpis.slug} — slug zajęty przez wpis pisany ręcznie`);
      continue;
    }
    const kat = p.kategoria.padEnd(20);
    const lok = p.lokalizacja.padEnd(10);
    console.log(`${dry ? "[plan]" : "  ✓  "} ${kat} ${lok} wol:${String(p.wolumen).padStart(4)}  wariant:${p.wariant}  ${wpis.plik}`);
    if (!dry) {
      writeFileSync(join(BLOG_DIR, wpis.plik), wpis.tresc, "utf8");
      zapisane++;
    }
  }

  if (!dry) podlinkujFilary(plan);

  console.log(
    dry
      ? `\nTryb --dry: nic nie zapisano.`
      : `\nZapisano ${zapisane} plików w content/blog/.\nNastępny krok: npx tsx scripts/blog-factory/qa.ts && npm run db:seed-blog`
  );
}

main();
