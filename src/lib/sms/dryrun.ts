import type { SmsProvider, SmsSendResult } from "./types";

/**
 * Dostawca testowy: NIC nie wysyła. Używany, gdy brak `SMSAPI_TOKEN` — dzięki temu CRM
 * da się klikać na lokalu i na produkcji przed podpisaniem umowy z bramką, a wiadomość
 * zapisuje się w historii ze statusem „dry-run" i jawną plakietką w interfejsie.
 */
export class DryRunSmsProvider implements SmsProvider {
  readonly name = "dryrun";
  async send(to: string, text: string): Promise<SmsSendResult> {
    console.log(`[sms:dry-run] do ${to.slice(0, 5)}… (${text.length} znaków) — nie wysłano`);
    return { id: null, status: "dry-run" };
  }
}
