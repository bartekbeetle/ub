import type { SmsProvider, SmsSendResult } from "./types";

/**
 * Sterownik SMSAPI.pl — https://www.smsapi.pl/docs (sprawdzone 02.10.2026).
 *
 * - `POST https://api.smsapi.pl/sms.do`, autoryzacja `Authorization: Bearer <token OAuth>`.
 * - `to`: `48XXXXXXXXX` (bez plusa), `message`, `from` = zweryfikowane pole nadawcy (opcjonalne:
 *   puste = domyślne konta, na nowym koncie „Test"), `format=json`.
 * - `encoding=utf-8`: domyślnym kodowaniem bramki jest windows-1250, a my wysyłamy JSON/UTF-8.
 *   Bez tego polskie litery mogłyby dojść jako krzaki.
 * - NIE używamy `normalize=1` (zamienia ą→a): polskie znaki zostają, kosztem limitu 70 znaków.
 * - NIE używamy `fast=1`: dokumentacja zabrania go przy wysyłkach marketingowych.
 * - Sukces: `{count, list:[{id, points, status:"QUEUE", ...}]}`; błąd: `{error:<kod>, message, invalid_numbers?}`
 *   (HTTP 200 także przy błędzie biznesowym — dlatego czytamy pole `error`, nie tylko status HTTP).
 * - `api2.smsapi.pl` to backup: przy błędzie sieciowym próbujemy go jednokrotnie.
 */
const ENDPOINTS = ["https://api.smsapi.pl/sms.do", "https://api2.smsapi.pl/sms.do"];
const TIMEOUT_MS = 10_000;

type FetchFn = typeof fetch;

export class SmsapiProvider implements SmsProvider {
  readonly name = "smsapi";
  constructor(
    private readonly token: string,
    private readonly senderName?: string,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  async send(to: string, text: string): Promise<SmsSendResult> {
    const body = new URLSearchParams({
      to: to.replace(/^\+/, ""),
      message: text,
      format: "json",
      encoding: "utf-8",
      // Wiadomość dłuższa niż nasz limit nie pójdzie nawet przy błędzie walidacji po naszej stronie.
      max_parts: "3",
    });
    if (this.senderName) body.set("from", this.senderName);

    let lastError = "Brak odpowiedzi bramki SMS.";
    for (const url of ENDPOINTS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await this.fetchFn(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
          signal: controller.signal,
        });
        const json = (await res.json().catch(() => null)) as
          | {
              error?: number;
              message?: string;
              list?: { id?: string; points?: number; status?: string; error?: number }[];
              invalid_numbers?: { message?: string }[];
            }
          | null;
        if (!json) {
          lastError = `Bramka SMS zwróciła nieczytelną odpowiedź (HTTP ${res.status}).`;
          if (res.status >= 500) continue;
          return { id: null, status: "failed", error: lastError };
        }
        if (json.error) {
          // Błąd biznesowy (zły token, zły nadawca, zły numer, brak środków) — ponawianie nic nie da.
          const detail = json.invalid_numbers?.[0]?.message ?? json.message ?? "nieznany błąd";
          return { id: null, status: "failed", error: `SMSAPI ${json.error}: ${detail}` };
        }
        const first = json.list?.[0];
        if (!first?.id) {
          return { id: null, status: "failed", error: "SMSAPI nie zwróciło identyfikatora wiadomości." };
        }
        return { id: String(first.id), status: "sent", points: first.points };
      } catch (err) {
        lastError = err instanceof Error ? `Błąd połączenia z bramką SMS: ${err.message}` : "Błąd połączenia z bramką SMS.";
        // spróbuj backupu
      } finally {
        clearTimeout(timer);
      }
    }
    return { id: null, status: "failed", error: lastError };
  }
}
