/**
 * Podgląd maili transakcyjnych — renderuje szablony z ustawień na przykładowych danych
 * i wypisuje na ekran. NIC nie wysyła i nie zapisuje.
 *
 * Po co: treści maili do kursantek są edytowalne w panelu, a literówka w nazwie zmiennej
 * ({{imie}} vs {{imię}}) nie powoduje błędu — po prostu podstawia pusty ciąg i kursantka
 * dostaje "Dzień dobry ,". Ten skrypt pokazuje dokładnie to, co pójdzie w świat,
 * i sprawdza guardrail ceny z voice.md.
 *
 * Użycie: npm run email:preview
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { renderTemplate } from "../src/lib/template";

// Własne połączenie (jak w scripts/seed-core.ts) — src/lib/settings.ts ma "server-only"
// i nie da się go zaimportować poza runtime Next.js.
async function getDb() {
  const url = process.env.DATABASE_URL;
  const schema = await import("../src/db/schema");
  if (url && url.trim() !== "") {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    return { db: drizzle(new Pool({ connectionString: url }), { schema }), schema };
  }
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  return { db: drizzle(new PGlite(".pglite"), { schema }), schema };
}

const vars = {
  imie: "Gabriela Nowak",
  imie_wolacz: "Gabrielo",
  telefon: "500 100 200",
  email: "gabriela@example.com",
  kategoria: "Stylizacja rzęs",
  wojewodztwo: "śląskie",
  miasto: "Katowice",
  status_zawodowy: "pracująca",
  trenerka: "Akademia La Beauty",
};

function show(label: string, subject: string, body: string) {
  console.log("\n" + "=".repeat(72));
  console.log(label);
  console.log("=".repeat(72));
  console.log(`Temat: ${subject}\n`);
  console.log(body);

  // Niepodstawiona zmienna = literówka w szablonie. Zgłaszamy głośno, bo w gotowym
  // mailu wygląda to jak zwykły brak słowa i łatwo przejść obok.
  const leftovers = [...`${subject}\n${body}`.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
  if (leftovers.length) {
    console.log(`\nNIEPODSTAWIONE ZMIENNE: ${[...new Set(leftovers)].join(", ")}`);
  }
}

async function main() {
  const { db, schema } = await getDb();
  const rows = await db.select().from(schema.settings).where(eq(schema.settings.id, 1)).limit(1);
  const s = rows[0];
  if (!s) {
    console.error("Brak wiersza ustawień (id=1). Odpal najpierw: npm run db:setup");
    process.exit(1);
  }

  show(
    "1. POTWIERDZENIE ZGLOSZENIA -> kursantka (zaraz po formularzu)",
    renderTemplate(s.confirmEmailSubject, vars),
    renderTemplate(s.confirmEmailTemplate, vars)
  );

  show(
    "2. POTWIERDZENIE ZAPISU -> kursantka (po oznaczeniu jako zapisana)",
    renderTemplate(s.signupEmailSubject, vars),
    renderTemplate(s.signupEmailTemplate, vars)
  );

  show(
    "3. NOWY LEAD -> trenerka (istniejacy szablon, bez zmian)",
    renderTemplate(s.leadEmailSubject, vars),
    renderTemplate(s.leadEmailTemplate, vars)
  );

  // Guardrail ceny z voice.md — "0 zł" w mailu do kursantki to obietnica, której
  // nie kontrolujemy (progi zależą od województwa i naboru).
  const all = [s.confirmEmailTemplate, s.signupEmailTemplate].join(" ").toLowerCase();
  const zakazane = ["0 zł", "0zł", "za darmo", "bezpłatn", "gratis"];
  const trafienia = zakazane.filter((f) => all.includes(f));
  console.log("\n" + "=".repeat(72));
  console.log(
    trafienia.length
      ? `GUARDRAIL CENY ZLAMANY — znalezione frazy: ${trafienia.join(", ")}`
      : "OK: guardrail ceny czysty (brak fraz: 0 zl / za darmo / bezplatne / gratis)."
  );
  console.log("=".repeat(72) + "\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Błąd podglądu:", err);
  process.exit(1);
});
