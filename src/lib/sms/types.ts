/**
 * Abstrakcja dostawcy SMS. CRM trenerki zna wyłącznie ten interfejs — dostawcę wybiera
 * `getSmsProvider()` po zmiennych środowiskowych, więc zmiana bramki (SMSAPI → inna)
 * to jeden nowy plik w tym katalogu, bez ruszania CRM-u.
 */
export type SmsSendStatus = "sent" | "dry-run" | "failed";

export type SmsSendResult = {
  /** Identyfikator wiadomości po stronie dostawcy (null przy dry-run albo błędzie). */
  id: string | null;
  status: SmsSendStatus;
  /** Czytelny powód, gdy `status === "failed"`. */
  error?: string;
  /** Koszt w punktach dostawcy, jeśli zwrócił (informacyjnie). */
  points?: number;
};

export interface SmsProvider {
  /** `smsapi` | `dryrun` — trafia do `crm_messages.provider`. */
  readonly name: string;
  /** `to` w formacie E.164 z plusem (`+48500600700`), już znormalizowany przez wywołującego. */
  send(to: string, text: string): Promise<SmsSendResult>;
}
