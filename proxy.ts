import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

const PUBLIC_PATHS = ["/entrar", "/criar-conta", "/recuperar-senha", "/nova-senha", "/auth"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Renova a sessão do Supabase a cada navegação e barra rotas privadas.
 * A checagem aqui é de conveniência (evita flash de tela): a autorização
 * de verdade continua sendo RLS + as checagens no servidor.
 */
export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Uma falha de rede ao validar a sessão não pode derrubar a navegação
  // inteira: o pior caso é a página tratar o usuário como anônimo, e a RLS
  // continua sendo quem decide o acesso aos dados.
  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    return response;
  }

  const { pathname, search } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/entrar";
    redirect.search = "";
    // Preserva o destino para voltar depois do login — sempre um caminho
    // relativo, nunca uma URL absoluta vinda de fora (open redirect).
    redirect.searchParams.set("proximo", `${pathname}${search}`);
    return NextResponse.redirect(redirect);
  }

  if (user && (pathname === "/entrar" || pathname === "/criar-conta")) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  matcher: [
    // Tudo, menos assets estáticos, imagens públicas, ícones e o service
    // worker. `images/` faltava aqui: sem ela, o banner da tela de login
    // (sempre pedido por um visitante ainda anônimo) caía no redirect para
    // /entrar, e o próprio next/image quebrava ao tentar otimizar um HTML
    // de redirecionamento como se fosse imagem.
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|images/|offline).*)",
  ],
};
