/**
 * Odczyt parametrów UTM z URL-a, z fallbackiem do sessionStorage.
 * Wspólne dla każdego formularza leadowego (LeadForm, Quiz) — pierwsze wejście
 * na stronę z kampanii zapisuje UTM-y w sessionStorage, żeby przetrwały nawigację
 * między stronami serwisu aż do wysłania formularza.
 */
export function getUtm(): { utmSource: string; utmMedium: string; utmCampaign: string } {
  if (typeof window === "undefined") return { utmSource: "", utmMedium: "", utmCampaign: "" };
  const params = new URLSearchParams(window.location.search);
  const stored = sessionStorage.getItem("ub_utm");
  const fromUrl = {
    utmSource: params.get("utm_source") ?? "",
    utmMedium: params.get("utm_medium") ?? "",
    utmCampaign: params.get("utm_campaign") ?? "",
  };
  if (fromUrl.utmSource || fromUrl.utmMedium || fromUrl.utmCampaign) {
    sessionStorage.setItem("ub_utm", JSON.stringify(fromUrl));
    return fromUrl;
  }
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      /* ignore */
    }
  }
  return fromUrl;
}
