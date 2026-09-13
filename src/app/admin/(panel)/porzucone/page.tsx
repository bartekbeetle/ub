import { desc, eq, isNotNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { formatDateTime, maskEmail, maskPhone } from "@/lib/utils";
import { voivodeshipName } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * PORZUCONE QUIZY — kto zaczął wypełniać i na którym kroku przerwał.
 *
 * 🔴 Najważniejsza kolumna na tym ekranie to NIE e-mail, tylko „zgoda marketingowa".
 * Do osoby, która porzuciła quiz, wolno napisać **wyłącznie** jeśli zaznaczyła zgodę
 * na kroku 1. Bez niej rekord służy do dwóch rzeczy: statystyki (gdzie sypie się formularz)
 * i remarketingu przez piksel Meta — nie do maila.
 * Podstawa: art. 398 Prawa komunikacji elektronicznej. UOKiK 24.07.2026 ukarał za to
 * spółkę na 308 728 zł, a prezesa osobiście na 100 000 zł.
 */

const KROKI = [
  "1. Imię i e-mail",
  "2. Szkolenie i region",
  "3. Sytuacja zawodowa",
  "4. Cel",
  "5. Wiek i dojazd",
  "6. Telefon",
  "7. Zgody",
];

export default async function PorzuconePage() {
  const db = await getDb();
  const { quizSessions } = schema;

  const sesje = await db
    .select()
    .from(quizSessions)
    .orderBy(desc(quizSessions.updatedAt))
    .limit(300);

  const porzucone = sesje.filter((s) => !s.completed);
  const dokonczone = sesje.filter((s) => s.completed);
  const doMaila = porzucone.filter((s) => s.marketingConsentAt && s.email);

  // Ile osób odpadło na którym kroku — pokazuje, które pytanie zabija konwersję.
  const lejek = KROKI.map((etykieta, i) => {
    const krok = i + 1;
    const doszlo = sesje.filter((s) => s.maxStepReached >= krok).length;
    const odpadlo = porzucone.filter((s) => s.maxStepReached === krok).length;
    return { etykieta, krok, doszlo, odpadlo };
  });
  const start = lejek[0]?.doszlo || 1;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Porzucone quizy</h1>
        <p className="mt-1 text-sm text-muted">
          Kto zaczął wypełniać i gdzie przerwał. Ostatnie 300 sesji.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { etykieta: "Rozpoczęte", wartosc: sesje.length },
          { etykieta: "Dokończone", wartosc: dokonczone.length },
          { etykieta: "Porzucone", wartosc: porzucone.length },
          { etykieta: "Wolno napisać maila", wartosc: doMaila.length },
        ].map((k) => (
          <div key={k.etykieta} className="card p-4">
            <p className="text-sm text-muted">{k.etykieta}</p>
            <p className="mt-1 text-2xl font-bold">{k.wartosc}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="text-lg font-bold">Gdzie odpadają</h2>
        <div className="card mt-3 divide-y">
          {lejek.map((l) => (
            <div key={l.krok} className="flex items-center gap-4 p-3">
              <span className="w-48 shrink-0 text-sm">{l.etykieta}</span>
              <div className="h-2 flex-1 overflow-hidden rounded bg-sand-100">
                <div
                  className="h-full bg-sand-700"
                  style={{ width: `${Math.round((l.doszlo / start) * 100)}%` }}
                />
              </div>
              <span className="w-28 shrink-0 text-right text-sm text-muted">
                {l.doszlo} doszło
              </span>
              <span className="w-28 shrink-0 text-right text-sm font-medium text-red-700">
                {l.odpadlo > 0 ? `−${l.odpadlo} tutaj` : "—"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold">Lista porzuconych</h2>
        {porzucone.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nikt jeszcze nie porzucił quizu.</p>
        ) : (
          <div className="card mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sand-50 text-left">
                <tr>
                  <th className="p-3">Kiedy</th>
                  <th className="p-3">Imię</th>
                  <th className="p-3">Kontakt</th>
                  <th className="p-3">Szkolenie / region</th>
                  <th className="p-3">Przerwała na</th>
                  <th className="p-3">Można pisać?</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {porzucone.map((s) => (
                  <tr key={s.id}>
                    <td className="whitespace-nowrap p-3 text-muted">{formatDateTime(s.updatedAt)}</td>
                    <td className="p-3">{s.name || <span className="text-muted">—</span>}</td>
                    <td className="p-3">
                      {s.email ? maskEmail(s.email) : <span className="text-muted">—</span>}
                      {s.phone && <div className="text-muted">{maskPhone(s.phone)}</div>}
                    </td>
                    <td className="p-3">
                      {s.category || <span className="text-muted">—</span>}
                      {s.voivodeship && (
                        <div className="text-muted">
                          {voivodeshipName(s.voivodeship)}
                          {s.city ? `, ${s.city}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="p-3">{KROKI[s.maxStepReached - 1] ?? `krok ${s.maxStepReached}`}</td>
                    <td className="p-3">
                      {s.marketingConsentAt && s.email ? (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">
                          tak — zgoda marketingowa
                        </span>
                      ) : (
                        <span className="rounded bg-red-100 px-2 py-0.5 text-red-700">
                          nie — tylko remarketing
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted">
          🔴 Kolumna „Można pisać?" nie jest podpowiedzią, tylko granicą prawną. Wysyłka
          do rekordów oznaczonych na czerwono to marketing bez zgody (art. 398 Prawa komunikacji
          elektronicznej) — kara do 3% przychodu albo 1 mln zł, plus odpowiedzialność osobista.
          Tych osób nie odzyskujemy mailem, tylko remarketingiem przez piksel.
        </p>
      </section>
    </div>
  );
}
