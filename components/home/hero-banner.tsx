import { HomeUserMenu } from "@/components/home/home-user-menu";

export function HeroBanner({
  greetingName,
  avatarUrl,
  profileHref,
}: {
  greetingName: string;
  avatarUrl: string | null;
  /** Perfil vive dentro de um grupo — sem grupo ainda, não há para onde ir. */
  profileHref: string | null;
}) {
  return (
    <div className="relative flex min-h-64 flex-col justify-between overflow-hidden rounded-3xl shadow-lg sm:min-h-72">
      <div
        aria-hidden
        className="absolute inset-0 bg-[url('/images/imagem_ftv.jpg')] bg-cover bg-center"
      />
      <div aria-hidden className="absolute inset-0 bg-black/40 mix-blend-overlay" />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent"
      />

      <div className="relative flex items-center justify-end p-3">
        <div className="rounded-full bg-white/15 p-0.5 ring-1 ring-white/25 backdrop-blur-md">
          <HomeUserMenu
            displayName={greetingName}
            avatarUrl={avatarUrl}
            profileHref={profileHref}
          />
        </div>
      </div>

      <div className="relative flex flex-col gap-1 px-5 pb-6">
        <p className="text-sm font-medium text-white/85">Bora pra areia,</p>
        <h1 className="text-2xl leading-tight font-extrabold tracking-tight text-balance text-white sm:text-3xl">
          {greetingName}?
        </h1>
      </div>
    </div>
  );
}
