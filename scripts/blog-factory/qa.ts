/**
 * Bramka jakości fabryki wpisów. Uruchomienie: npx tsx scripts/blog-factory/qa.ts
 *
 * Sprawdza WSZYSTKIE wpisy w content/blog (także pisane ręcznie), bo część reguł —
 * guardrail ceny, długości meta — obowiązuje niezależnie od tego, kto pisał.
 * Kod wyjścia 1 przy błędzie, żeby dało się wpiąć w CI albo w skrypt publikacji.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

const BLOG_DIR = join(process.cwd(), "content", "blog");
const MAX_TITLE = 60;
const MAX_META = 158;
/** Powyżej tego progu dwa wpisy są zbyt podobne, żeby traktować je jako osobne strony. */
const PROG_PODOBIENSTWA = 0.75;

/**
 * Guardrail ceny: o SZKOLENIU nie wolno mówić „za darmo" ani „0 zł".
 * „Bezpłatna konsultacja" jest dozwolona — usługa UB dla kursantki faktycznie jest bez opłat.
 */
const ZAKAZANE_CENA = [
  { wzorzec: /\b0\s*(zł|pln)\b/i, opis: '„0 zł" o szkoleniu' },
  { wzorzec: /\bza\s+darmo\b/i, opis: '„za darmo"' },
  { wzorzec: /\bdarmow\w*\s+(kurs|szkolen)\w*/i, opis: '„darmowy kurs/szkolenie"' },
  { wzorzec: /\bbezpłatn\w*\s+(kurs|szkolen)\w*/i, opis: '„bezpłatny kurs/szkolenie"' },
];

/** Kalki i wata z voice.md → DON'T oraz ai-writing-patterns. */
const ZAKAZANE_STYL = [
  /\bwarto zauważyć\b/i,
  /\bpodsumowując\b/i,
  /\bkompleksow\w+\b/i,
  /\bw związku z powyższym\b/i,
  /\bnie owijać w bawełnę\b/i,
  /\bwróżenie z fusów\b/i,
];

/**
 * Mianownik tam, gdzie polszczyzna wymaga przypadka zależnego — klasyczny objaw sklejania
 * stringów w generatorze („w Warszawa", „ceny z stylizacja paznokci", „poza Płocka").
 * Reguła istnieje, bo te błędy realnie wyszły w pierwszym batchu i przeszły przez pozostałe kontrole.
 */
const MIASTA = "Warszawa|Kraków|Wrocław|Poznań|Gdańsk|Łódź|Lublin|Katowice|Szczecin|Opole|Gdynia|Legnica|Płock";
const KATEGORIE_MIAN = "stylizacja paznokci|przedłużanie rzęs|makijaż permanentny|laminacja brwi i rzęs";
const ZLE_ODMIANY = [
  new RegExp(`\\bw(?:e)?\\s+(${MIASTA})\\b`),
  new RegExp(`\\bpoza\\s+(${MIASTA})(a|u|ie)?\\b`),
  new RegExp(`\\b(z|ze|o|po)\\s+(${KATEGORIE_MIAN})\\b`, "i"),
  new RegExp(`\\bprowadząc\\w+\\s+(${KATEGORIE_MIAN})\\b`, "i"),
  new RegExp(`\\bceny\\s+(${KATEGORIE_MIAN})\\b`, "i"),
];

type Wpis = { plik: string; slug: string; title: string; metaDescription: string; excerpt: string; body: string; generator: boolean };

function wczytaj(): Wpis[] {
  return readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((plik) => {
      const { data, content } = matter(readFileSync(join(BLOG_DIR, plik), "utf8"));
      return {
        plik,
        slug: String(data.slug ?? ""),
        title: String(data.title ?? ""),
        metaDescription: String(data.metaDescription ?? data.meta_description ?? ""),
        excerpt: String(data.excerpt ?? ""),
        body: content,
        generator: data.generator === "blog-factory",
      };
    });
}

/** Jaccard na 5-gramach słownych — mierzy realne pokrycie treści, nie podobieństwo tytułów. */
function shingles(tekst: string): Set<string> {
  const slowa = tekst.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const s = new Set<string>();
  for (let i = 0; i + 5 <= slowa.length; i++) s.add(slowa.slice(i, i + 5).join(" "));
  return s;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let wspolne = 0;
  for (const x of a) if (b.has(x)) wspolne++;
  return wspolne / (a.size + b.size - wspolne || 1);
}

function main() {
  const wpisy = wczytaj();
  const bledy: string[] = [];
  const ostrzezenia: string[] = [];

  const slugi = new Map<string, string>();
  for (const w of wpisy) {
    const gdzie = w.plik;
    if (!w.slug) bledy.push(`${gdzie}: brak slug`);
    if (slugi.has(w.slug)) bledy.push(`${gdzie}: slug "${w.slug}" duplikuje ${slugi.get(w.slug)}`);
    slugi.set(w.slug, gdzie);

    if (w.title.length > MAX_TITLE) bledy.push(`${gdzie}: title ${w.title.length} zn. (limit ${MAX_TITLE})`);
    if (!w.metaDescription) bledy.push(`${gdzie}: brak metaDescription`);
    if (w.metaDescription.length > MAX_META) bledy.push(`${gdzie}: metaDescription ${w.metaDescription.length} zn. (limit ${MAX_META})`);
    if (!w.excerpt) bledy.push(`${gdzie}: brak excerpt`);

    const pelny = `${w.title} ${w.metaDescription} ${w.excerpt} ${w.body}`;
    for (const { wzorzec, opis } of ZAKAZANE_CENA) {
      const m = pelny.match(wzorzec);
      // Wpisy pisane ręcznie omawiają mit „kursu za 0 zł" świadomie — tam to temat, nie obietnica.
      if (m && w.generator) bledy.push(`${gdzie}: GUARDRAIL CENY — ${opis} („${m[0]}")`);
      else if (m) ostrzezenia.push(`${gdzie}: ${opis} („${m[0]}") — wpis ręczny, sprawdź kontekst`);
    }
    for (const wz of ZAKAZANE_STYL) {
      const m = pelny.match(wz);
      if (m) ostrzezenia.push(`${gdzie}: kalka stylistyczna „${m[0]}"`);
    }
    if (/\$\{|undefined|NaN/.test(pelny)) bledy.push(`${gdzie}: nierozwinięty placeholder w treści`);
    for (const wz of ZLE_ODMIANY) {
      const odm = pelny.match(wz);
      if (odm) bledy.push(`${gdzie}: zła odmiana — „${odm[0]}"`);
    }
  }

  // Podobieństwo liczymy tylko między wpisami z generatora — to tam istnieje ryzyko duplikatów.
  const gen = wpisy.filter((w) => w.generator);
  const sh = new Map(gen.map((w) => [w.plik, shingles(w.body)]));
  const pary: { a: string; b: string; v: number }[] = [];
  for (let i = 0; i < gen.length; i++) {
    for (let j = i + 1; j < gen.length; j++) {
      const v = jaccard(sh.get(gen[i].plik)!, sh.get(gen[j].plik)!);
      pary.push({ a: gen[i].plik, b: gen[j].plik, v });
      if (v > PROG_PODOBIENSTWA) bledy.push(`Duplikat: ${gen[i].plik} ↔ ${gen[j].plik} = ${(v * 100).toFixed(0)}%`);
    }
  }
  pary.sort((x, y) => y.v - x.v);

  console.log(`Sprawdzono ${wpisy.length} wpisów (${gen.length} z generatora).\n`);
  if (pary.length) {
    const sr = pary.reduce((s, p) => s + p.v, 0) / pary.length;
    console.log(`Podobieństwo treści (5-gramy, Jaccard): max ${(pary[0].v * 100).toFixed(0)}%, średnie ${(sr * 100).toFixed(0)}%`);
    console.log("Najbardziej podobne pary:");
    for (const p of pary.slice(0, 5)) console.log(`  ${(p.v * 100).toFixed(0)}%  ${p.a} ↔ ${p.b}`);
    console.log();
  }

  if (ostrzezenia.length) {
    console.log(`⚠ Ostrzeżenia (${ostrzezenia.length}):`);
    for (const o of ostrzezenia.slice(0, 20)) console.log(`  ${o}`);
    console.log();
  }

  if (bledy.length) {
    console.error(`✖ BŁĘDY (${bledy.length}):`);
    for (const b of bledy) console.error(`  ${b}`);
    process.exit(1);
  }
  console.log("✅ QA przeszło — wpisy gotowe do seedowania.");
}

main();
