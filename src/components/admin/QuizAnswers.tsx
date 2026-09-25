import type { ReactNode } from "react";

/**
 * Czytelny render pola `message` leada / zgłoszenia.
 *
 * Quiz (`src/components/Quiz.tsx`, `messageParts`) skleja odpowiedzi w linie
 * `Etykieta: wartość` rozdzielone `\n`, a ostrzeżenie dla admina zaczyna od „⚠️".
 * Świadomie NIE trzymamy tych pól w osobnych kolumnach (patrz `validators.ts`),
 * więc czytelność musi powstać tu — przy wyświetlaniu, nie w bazie.
 *
 * Wolny tekst (formularz kontaktowy, poradnik, ręczna notatka) nie ma tej
 * struktury — wtedy komponent oddaje go jako zwykły akapit, bez zgadywania.
 */

type Row =
  | { kind: "pair"; label: string; value: string }
  | { kind: "warning"; text: string }
  | { kind: "text"; text: string };

/** Etykiety z quizu są pisane „dla parsera w głowie" — na ekranie skracamy. */
const LABEL_DISPLAY: Record<string, string> = {
  "Forma zatrudnienia (dosłownie)": "Forma zatrudnienia",
  "Interesuje ją też (multi-sell)": "Interesuje ją też",
};

/** Wartości, które quiz skleja separatorem — rozbijamy na listę / chipy. */
const LIST_SEPARATORS: Record<string, { sep: string; as: "chips" | "list" }> = {
  "Interesuje ją też (multi-sell)": { sep: ", ", as: "chips" },
  "Kryteria wyższego dofinansowania": { sep: "; ", as: "list" },
};

const PAIR_RE = /^([^:\n]{2,60}):\s+(.+)$/;

export function parseQuizMessage(message: string): Row[] {
  return message
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map<Row>((line) => {
      if (line.startsWith("⚠️")) return { kind: "warning", text: line.replace(/^⚠️\s*/, "") };
      const m = PAIR_RE.exec(line);
      if (m) return { kind: "pair", label: m[1].trim(), value: m[2].trim() };
      return { kind: "text", text: line };
    });
}

function renderValue(label: string, value: string): ReactNode {
  const listing = LIST_SEPARATORS[label];
  if (listing && value.includes(listing.sep)) {
    const items = value.split(listing.sep).map((v) => v.trim()).filter(Boolean);
    if (listing.as === "chips") {
      return (
        <span className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span key={item} className="badge-tag">{item}</span>
          ))}
        </span>
      );
    }
    return (
      <ul className="list-disc space-y-0.5 pl-4">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  return value;
}

export function QuizAnswers({ message }: { message: string }) {
  const rows = parseQuizMessage(message);
  const pairs = rows.filter((r) => r.kind === "pair").length;

  // Bez ani jednej pary „Etykieta: wartość" to nie jest dump z quizu — zwykły tekst.
  if (pairs === 0) {
    return <p className="whitespace-pre-line">{message}</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((row, i) => {
        if (row.kind === "warning") {
          return (
            <div
              key={i}
              className="flex items-start gap-2 rounded-[10px] border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900"
            >
              <span aria-hidden="true">⚠️</span>
              <span>{row.text}</span>
            </div>
          );
        }
        if (row.kind === "text") {
          return (
            <p key={i} className="whitespace-pre-line text-sm">
              {row.text}
            </p>
          );
        }
        return null;
      })}

      <dl className="divide-y divide-sand-200 overflow-hidden rounded-[10px] border border-sand-200 bg-sand-50/60">
        {rows
          .filter((r): r is Extract<Row, { kind: "pair" }> => r.kind === "pair")
          .map((row, i) => (
            <div key={i} className="grid gap-x-4 gap-y-0.5 px-3 py-2 sm:grid-cols-[minmax(0,170px)_1fr]">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                {LABEL_DISPLAY[row.label] ?? row.label}
              </dt>
              <dd className="text-sm text-ink">{renderValue(row.label, row.value)}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}
