import { TZDate } from "@date-fns/tz";

export function todayInZone(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Instante da partida a partir da data da rodada.
 *
 * Se a rodada é hoje, usa o horário real — assim a ordem das partidas do dia
 * fica correta. Para datas passadas, ancora ao meio-dia no fuso do grupo, que
 * é imune a virada de dia por fuso.
 */
export function composePlayedAt(
  playedOn: string,
  timeZone: string,
  now: Date = new Date(),
): string {
  if (playedOn === todayInZone(timeZone, now)) return now.toISOString();
  const [year, month, day] = playedOn.split("-").map(Number);
  return new Date(
    new TZDate(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0, timeZone).getTime(),
  ).toISOString();
}
