/**
 * Test warstwy uprawnień super-admina na PGlite w pamięci — BEZ sieci, BEZ Next.js, BEZ ./.pglite.
 *
 * Migracje lecą z katalogu ./drizzle DOKŁADNIE tak jak na produkcji (jedna transakcja, wszystkie
 * oczekujące pliki), więc test łapie też błąd typu „ADD VALUE użyte w tej samej migracji".
 *
 * Sprawdza:
 *  1. migracje: enum ma `superadmin`, istnieje `admin_audit_log`;
 *  2. bramki ról (`src/lib/roles.ts`): superadmin przechodzi KAŻDĄ bramkę admina, admin jest
 *     zablokowany na rozliczeniach / ustawieniach / zespole (też podstronach), trenerka wszędzie;
 *  3. konto wyłączone nie ma prawa się zalogować, a wyłączenie kasuje sesje;
 *  4. zespół: tworzenie, duplikat, wyłączanie/włączanie, reset hasła, odebranie dostępu;
 *  5. superadmin nietykalny, ostatni superadmin nigdy nie znika;
 *  6. dziennik: wpis się zapisuje, najnowsze na górze, filtr po koncie, paginacja;
 *  7. straż strukturalna: żadnego `role === "admin"` w kodzie aplikacji (zamiast `isAdminRole`)
 *     i każda trasa/strona tylko-dla-superadmina nadal woła swoją bramkę.
 *
 * Użycie: npm run test:superadmin
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { eq } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../src/db/schema";
import {
  isAdminRole,
  isSuperadminRole,
  canAccessAdminPath,
  canSignIn,
  isSuperadminOnlyPath,
  stripBilling,
} from "../src/lib/roles";
import { applyTeamAction, countActiveSuperadmins, createAdminUser, listTeam } from "../src/lib/team";
import { AUDIT_PAGE_SIZE, readAdminAudit, writeAdminAudit } from "../src/lib/admin-audit-core";

let failed = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "OK  " : "BLAD"}  ${label}${ok ? "" : ` — oczekiwano ${JSON.stringify(expected)}, jest ${JSON.stringify(actual)}`}`);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}

async function main() {
  const client = new PGlite();
  const db = drizzle(client, { schema });

  // 1. Migracje jak na produkcji
  await migrate(db, { migrationsFolder: "./drizzle" });
  const enumVals = await client.query<{ enumlabel: string }>(
    "select e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'user_role' order by e.enumsortorder",
  );
  check("enum user_role zawiera superadmin", enumVals.rows.map((r) => r.enumlabel).includes("superadmin"), true);
  const tbl = await client.query("select to_regclass('public.admin_audit_log') as t");
  check("tabela admin_audit_log istnieje", (tbl.rows[0] as { t: string | null }).t, "admin_audit_log");

  // 2. Bramki ról
  check("isAdminRole(admin)", isAdminRole("admin"), true);
  check("isAdminRole(superadmin) — superadmin przechodzi bramkę admina", isAdminRole("superadmin"), true);
  check("isAdminRole(trenerka)", isAdminRole("trenerka"), false);
  check("isAdminRole(null)", isAdminRole(null), false);
  check("isSuperadminRole(admin)", isSuperadminRole("admin"), false);
  check("isSuperadminRole(superadmin)", isSuperadminRole("superadmin"), true);

  const superOnly = [
    "/admin/rozliczenia",
    "/admin/ustawienia",
    "/admin/zespol",
    "/admin/zespol/log",
    "/admin/rozliczenia/cokolwiek",
  ];
  const shared = ["/admin", "/admin/leady", "/admin/kursantki/5", "/admin/trenerki", "/admin/skrzynka/INBOX", "/admin/mailing", "/admin/blog", "/admin/haslo"];
  for (const p of superOnly) {
    check(`superadmin wchodzi na ${p}`, canAccessAdminPath("superadmin", p), true);
    check(`admin ZABLOKOWANY na ${p}`, canAccessAdminPath("admin", p), false);
    check(`trenerka zablokowana na ${p}`, canAccessAdminPath("trenerka", p), false);
  }
  for (const p of shared) {
    check(`admin wchodzi na ${p}`, canAccessAdminPath("admin", p), true);
    check(`superadmin wchodzi na ${p}`, canAccessAdminPath("superadmin", p), true);
  }
  check("prefiks nie łapie sąsiada (/admin/zespolowe nie jest zespołem)", isSuperadminOnlyPath("/admin/zespolowe"), false);

  // 3. Konto wyłączone
  const now = Date.now();
  const mk = async (email: string, role: "admin" | "superadmin" | "trenerka", isActive = true) => {
    const [u] = await db
      .insert(schema.users)
      .values({ email, passwordHash: "x", role, isActive })
      .returning();
    return u;
  };
  const owner = await mk("owner@test.pl", "superadmin");
  const helper = await mk("helper@test.pl", "admin");
  const disabled = await mk("off@test.pl", "admin", false);
  check("canSignIn(aktywne)", canSignIn(helper), true);
  check("canSignIn(wyłączone) — nie może się zalogować", canSignIn(disabled), false);
  check("canSignIn(brak konta)", canSignIn(null), false);

  const hdb = db as unknown as Parameters<typeof applyTeamAction>[0];

  // 4. Cykl życia admina
  await db.insert(schema.sessions).values({ id: "s-helper", userId: helper.id, expiresAt: new Date(now + 3600_000) });
  const created = await createAdminUser(hdb, { email: "  Nowy@Test.PL ", passwordHash: "hash" });
  check("createAdminUser ok", created.ok, true);
  const dup = await createAdminUser(hdb, { email: "nowy@test.pl", passwordHash: "hash" });
  check("duplikat adresu odrzucony (409)", dup.ok ? null : dup.status, 409);
  const [fresh] = await db.select().from(schema.users).where(eq(schema.users.email, "nowy@test.pl"));
  check("nowe konto: rola admin + wymuszona zmiana hasła", [fresh.role, fresh.mustChangePassword, fresh.isActive], ["admin", true, true]);

  const off = await applyTeamAction(hdb, helper.id, "disable");
  check("disable ok", off.ok, true);
  const [h1] = await db.select().from(schema.users).where(eq(schema.users.id, helper.id));
  check("po disable: isActive=false → canSignIn=false", canSignIn(h1), false);
  const sess = await db.select().from(schema.sessions).where(eq(schema.sessions.userId, helper.id));
  check("po disable: sesje skasowane (cookie przestaje działać od razu)", sess.length, 0);
  await applyTeamAction(hdb, helper.id, "enable");
  const [h2] = await db.select().from(schema.users).where(eq(schema.users.id, helper.id));
  check("enable przywraca konto", canSignIn(h2), true);

  const noPw = await applyTeamAction(hdb, helper.id, "reset_password");
  check("reset_password bez hasła odrzucony (400)", noPw.ok ? null : noPw.status, 400);
  await applyTeamAction(hdb, helper.id, "reset_password", { passwordHash: "nowy-hash" });
  const [h3] = await db.select().from(schema.users).where(eq(schema.users.id, helper.id));
  check("reset_password: nowy hash + wymuszona zmiana", [h3.passwordHash, h3.mustChangePassword], ["nowy-hash", true]);

  const revoked = await applyTeamAction(hdb, helper.id, "revoke");
  check("revoke ok", revoked.ok, true);
  const [h4] = await db.select().from(schema.users).where(eq(schema.users.id, helper.id));
  check("po revoke: nie-admin, wyłączony, bez trainerId", [isAdminRole(h4.role), h4.isActive, h4.trainerId], [false, false, null]);
  check("po revoke: znika z listy zespołu", (await listTeam(hdb)).some((m) => m.id === helper.id), false);

  const ghost = await applyTeamAction(hdb, 999999, "disable");
  check("nieistniejące konto → 404", ghost.ok ? null : ghost.status, 404);
  const trainerAcc = await mk("trenerka@test.pl", "trenerka");
  const onTrainer = await applyTeamAction(hdb, trainerAcc.id, "disable");
  check("konta trenerki nie da się ruszyć przez zespół (404)", onTrainer.ok ? null : onTrainer.status, 404);

  // 5. Superadmin nietykalny, ostatni nie znika
  check("aktywnych superadminów: 1", await countActiveSuperadmins(hdb), 1);
  for (const action of ["disable", "revoke", "reset_password"] as const) {
    const r = await applyTeamAction(hdb, owner.id, action, { passwordHash: "x" });
    check(`ostatni superadmin: ${action} odrzucony`, r.ok ? null : [r.status, /ostatni/i.test(r.error)], [409, true]);
  }
  const [o1] = await db.select().from(schema.users).where(eq(schema.users.id, owner.id));
  check("ostatni superadmin nietknięty (rola, aktywny, hasło)", [o1.role, o1.isActive, o1.passwordHash], ["superadmin", true, "x"]);
  const second = await mk("owner2@test.pl", "superadmin");
  const r2 = await applyTeamAction(hdb, second.id, "revoke");
  check("drugi superadmin też nietykalny z panelu", r2.ok ? null : r2.status, 409);
  check("superadminów nadal 2", await countActiveSuperadmins(hdb), 2);

  // 6. Dziennik
  await writeAdminAudit(hdb, { id: owner.id, role: "superadmin" }, { action: "test_akcja", entityType: "lead", entityId: 42, details: { a: 1 } });
  const one = await readAdminAudit(hdb, { actorUserId: owner.id });
  check("wpis dziennika zapisany", [one.total, one.rows[0].entry.action, one.rows[0].entry.actorRole, one.rows[0].entry.entityId, one.rows[0].actorEmail], [1, "test_akcja", "superadmin", 42, "owner@test.pl"]);
  await writeAdminAudit(hdb, null, { action: "z_systemu", entityType: "user" });
  const sys = await db.select().from(schema.adminAuditLog).where(eq(schema.adminAuditLog.action, "z_systemu"));
  check("wpis bez konta (skrypt): actor_user_id=null, rola=system", [sys[0].actorUserId, sys[0].actorRole], [null, "system"]);
  for (let i = 0; i < 55; i++) {
    await writeAdminAudit(hdb, { id: fresh.id, role: "admin" }, { action: `seria_${i}`, entityType: "lead", entityId: i });
  }
  const p1 = await readAdminAudit(hdb, { page: 1 });
  const p2 = await readAdminAudit(hdb, { page: 2 });
  check("paginacja: pełna strona 1", p1.rows.length, AUDIT_PAGE_SIZE);
  check("paginacja: reszta na stronie 2", p2.rows.length, p1.total - AUDIT_PAGE_SIZE);
  check("najnowsze na górze", p1.rows[0].entry.action, "seria_54");
  const byActor = await readAdminAudit(hdb, { actorUserId: fresh.id });
  check("filtr po koncie", [byActor.total, byActor.rows.every((r) => r.entry.actorUserId === fresh.id)], [55, true]);

  // 6b. Odpowiedzi API bez pól rozliczeniowych dla zwykłego admina
  const przydzial = { id: 1, leadId: 2, status: "przydzielony", amount: 500, billingStatus: "do_zafakturowania" };
  check("stripBilling: admin nie dostaje amount/billingStatus", stripBilling(przydzial, "admin"), { id: 1, leadId: 2, status: "przydzielony" });
  check("stripBilling: superadmin dostaje komplet", stripBilling(przydzial, "superadmin"), przydzial);
  check("stripBilling: trenerka bez stawki", stripBilling({ id: 3, name: "X", rate: 100, billingModel: "per_lead" }, "admin"), { id: 3, name: "X" });
  check("stripBilling: brak roli = bez pól", Object.keys(stripBilling(przydzial, null)).includes("amount"), false);
  check("straż: każda odpowiedź admina z .returning() przydziału/trenerki przechodzi przez stripBilling",
    ["src/app/api/admin/leads/[id]/assign/route.ts", "src/app/api/admin/assignments/[id]/route.ts", "src/app/api/admin/trenerki/route.ts", "src/app/api/admin/trenerki/[id]/route.ts", "src/app/api/admin/prospekty/[id]/awansuj/route.ts"]
      .filter((f) => !readFileSync(f, "utf8").includes("stripBilling(")),
    []);

  // 7. Straż strukturalna
  const src = walk("src");
  // roles.ts i team.ts to jedyne miejsca, które świadomie porównują z konkretną rolą.
  const leftovers = src
    .filter((f) => !/src\/lib\/(roles|team)\.ts$/.test(f))
    .filter((f) => /role\s*[!=]==\s*"admin"/.test(readFileSync(f, "utf8")));
  check('brak `role === "admin"` / `!== "admin"` w src (zamiast isAdminRole)', leftovers, []);

  const mustHave: Record<string, string> = {
    "src/app/admin/(panel)/rozliczenia/page.tsx": "requireSuperadminPage",
    "src/app/admin/(panel)/ustawienia/page.tsx": "requireSuperadminPage",
    "src/app/admin/(panel)/zespol/page.tsx": "requireSuperadminPage",
    "src/app/admin/(panel)/zespol/log/page.tsx": "requireSuperadminPage",
    "src/app/api/admin/ustawienia/route.ts": "requireSuperadmin",
    "src/app/api/admin/smtp-test/route.ts": "requireSuperadmin",
    "src/app/api/admin/rozliczenia/export/route.ts": "requireSuperadmin",
    "src/app/api/admin/zespol/route.ts": "requireSuperadmin",
    "src/app/api/admin/zespol/[id]/route.ts": "requireSuperadmin",
  };
  for (const [file, gate] of Object.entries(mustHave)) {
    check(`${file} woła ${gate}`, readFileSync(file, "utf8").includes(gate), true);
  }
  const unguarded = walk("src/app/api/admin")
    .filter((f) => f.endsWith("route.ts"))
    .filter((f) => !/(login|logout|change-password)\//.test(f))
    .filter((f) => !/requireAdmin|requireSuperadmin/.test(readFileSync(f, "utf8")));
  check("każda trasa /api/admin (poza login/logout/change-password) ma bramkę", unguarded, []);

  await client.close();
  console.log(failed === 0 ? "\nWSZYSTKO OK" : `\n${failed} BŁĘDÓW`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
