/**
 * CRM trenerki (`/panel/leady` w wersji z etapami, szablony, trasy `/api/panel/crm/*`,
 * karta CRM w apce mobilnej) jest zbudowane, ale WYŁĄCZONE do czasu świadomego wdrożenia.
 * Włączenie: zmienna `CRM_TRENERKI_ENABLED=true` w Coolify + redeploy.
 */
export function crmTrenerkiEnabled(): boolean {
  return process.env.CRM_TRENERKI_ENABLED === "true";
}
