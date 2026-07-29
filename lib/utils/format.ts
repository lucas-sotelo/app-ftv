import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

function toZoned(value: Date | string, timeZone: string): TZDate {
  const date = typeof value === "string" ? new Date(value) : value;
  return new TZDate(date, timeZone);
}

/** Padrão do produto: dd/MM/yyyy. */
export function formatDate(value: Date | string, timeZone = DEFAULT_TIMEZONE): string {
  return format(toZoned(value, timeZone), "dd/MM/yyyy", { locale: ptBR });
}

export function formatDateTime(value: Date | string, timeZone = DEFAULT_TIMEZONE): string {
  return format(toZoned(value, timeZone), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatTime(value: Date | string, timeZone = DEFAULT_TIMEZONE): string {
  return format(toZoned(value, timeZone), "HH:mm", { locale: ptBR });
}

/** "sábado, 05/07/2026" — usado nos cabeçalhos de rodada. */
export function formatLongDate(value: Date | string, timeZone = DEFAULT_TIMEZONE): string {
  return format(toZoned(value, timeZone), "EEEE',' dd/MM/yyyy", { locale: ptBR });
}

/**
 * Converte "2026-07-05" (date puro do Postgres) sem passar por fuso: um
 * `played_on` é um dia de calendário, não um instante.
 */
export function formatPlainDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

export function plainDateToDate(isoDate: string, timeZone = DEFAULT_TIMEZONE): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(new TZDate(year, month - 1, day, 12, 0, 0, timeZone).getTime());
}

/** Aproveitamento em texto. Nunca só cor — o número aparece sempre. */
export function formatPercent(value: number, fractionDigits = 1): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** Formato da planilha legada, usado nos relatórios de verificação. */
export function formatPercentPrecise(value: number): string {
  const scaled = value * 100;
  const isExact = Math.abs(scaled - Math.round(scaled * 100) / 100) < 1e-9;
  const digits = isExact ? 2 : 6;
  return `${scaled.toFixed(digits).replace(".", ",")}%`;
}

export function formatInteger(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

/** "3 jogos" / "1 jogo" — o tamanho da amostra nunca fica escondido. */
export function formatGames(games: number): string {
  return games === 1 ? "1 jogo" : `${formatInteger(games)} jogos`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toLocaleUpperCase("pt-BR")).join("") || "?";
}
