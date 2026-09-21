import { NextResponse, type NextRequest } from "next/server";

/**
 * Dokłada nagłówek `x-pathname` do żądań panelu.
 *
 * Po co: layout w App Routerze nie wie, która strona się w nim renderuje, a musi to
 * wiedzieć, żeby przy wymuszonej zmianie hasła przekierować **wszędzie poza** stronę
 * zmiany hasła (inaczej powstaje pętla przekierowań).
 *
 * ⛔ Tu NIE MA logiki uprawnień. Sesje siedzą w bazie, a middleware chodzi na runtime
 * brzegowym — sprawdzanie tu czegokolwiek oznaczałoby albo zapytanie do bazy z brzegu,
 * albo ufanie ciasteczku bez weryfikacji. Autoryzacja zostaje w layoutach i w `requireAdmin`
 * / `requireTrainer`, które czytają sesję z bazy.
 */
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/admin/:path*", "/panel/:path*"],
};
