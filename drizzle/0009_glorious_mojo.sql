ALTER TABLE "email_queue" ADD COLUMN "kind" varchar(40) DEFAULT 'inne' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_queue" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "confirm_email_subject" text DEFAULT 'Mamy Twoje zgłoszenie — {{kategoria}}' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "confirm_email_template" text DEFAULT 'Dzień dobry {{imie}},

potwierdzamy, że otrzymaliśmy Twoje zgłoszenie na szkolenie z zakresu: {{kategoria}} ({{wojewodztwo}}).

Co dzieje się dalej:

1. Dobieramy akademię w Twoim regionie, która prowadzi ten kurs i ma wpis do Bazy Usług Rozwojowych.
2. Osoba z akademii kontaktuje się z Tobą telefonicznie — zwykle w ciągu 1-2 dni roboczych.
3. Podczas rozmowy ustalacie termin, zakres szkolenia i to, jakie dofinansowanie możesz uzyskać.

O dofinansowaniu: wsparcie z Bazy Usług Rozwojowych sięga 90% ceny szkolenia, a jego wysokość zależy od województwa, aktualnego naboru i Twojej sytuacji zawodowej. Dokładną kwotę poznasz po weryfikacji — akademia przeprowadzi Cię przez formalności.

Jeśli zgłoszenie było pomyłką albo chcesz wycofać zgodę na kontakt, po prostu odpisz na tę wiadomość.

Pozdrawiamy,
Zespół Uniwersytet Beauty
biuro@uniwersytetbeauty.pl · uniwersytetbeauty.pl' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "signup_email_subject" text DEFAULT 'Potwierdzenie zapisu na szkolenie — {{kategoria}}' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "signup_email_template" text DEFAULT 'Dzień dobry {{imie}},

akademia {{trenerka}} potwierdziła Twój zapis na szkolenie z zakresu: {{kategoria}}.

Od tej chwili wszystkie sprawy organizacyjne — termin, miejsce, materiały i formalności dofinansowania — ustalasz bezpośrednio z akademią. To ona prowadzi szkolenie i wystawia dokumenty.

Gdyby coś poszło nie tak albo szkolenie nie doszło do skutku, daj nam znać na biuro@uniwersytetbeauty.pl. Chcemy o tym wiedzieć.

Powodzenia na kursie,
Zespół Uniwersytet Beauty' NOT NULL;--> statement-breakpoint
CREATE INDEX "email_queue_status_idx" ON "email_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_queue_lead_kind_idx" ON "email_queue" USING btree ("lead_id","kind");