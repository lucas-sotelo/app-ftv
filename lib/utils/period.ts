import { TZDate } from "@date-fns/tz";
import { addDays, startOfDay, startOfMonth, startOfYear } from "date-fns";
import { DEFAULT_TIMEZONE } from "./format";

export const PERIOD_PRESETS = ["all", "year", "month", "day", "custom"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  all: "Todo o período",
  year: "Ano atual",
  month: "Mês atual",
  day: "Dia específico",
  custom: "Período personalizado",
};

export interface ResolvedPeriod {
  preset: PeriodPreset;
  /** Instante inicial inclusivo, em UTC. `null` = sem limite. */
  from: Date | null;
  /** Instante final EXCLUSIVO, em UTC. `null` = sem limite. */
  to: Date | null;
}

export function isPeriodPreset(value: string | null | undefined): value is PeriodPreset {
  return !!value && (PERIOD_PRESETS as readonly string[]).includes(value);
}

/**
 * Resolve um período para um intervalo semiaberto [from, to) em UTC, calculado
 * no fuso do grupo. Semiaberto evita o clássico bug de perder ou duplicar as
 * partidas do último dia.
 */
function asUtc(value: TZDate | Date): Date {
  return new Date(value.getTime());
}

export function resolvePeriod(
  preset: PeriodPreset,
  options: {
    timeZone?: string;
    from?: string | null;
    to?: string | null;
    now?: Date;
  } = {},
): ResolvedPeriod {
  const timeZone = options.timeZone ?? DEFAULT_TIMEZONE;
  const now = new TZDate(options.now ?? new Date(), timeZone);

  switch (preset) {
    case "year":
      return {
        preset,
        from: asUtc(startOfYear(now)),
        to: asUtc(startOfYear(new TZDate(now.getFullYear() + 1, 0, 1, timeZone))),
      };
    case "month": {
      const start = startOfMonth(now);
      const next = new TZDate(now.getFullYear(), now.getMonth() + 1, 1, timeZone);
      return { preset, from: asUtc(start), to: asUtc(startOfMonth(next)) };
    }
    case "day": {
      // Um único dia de calendário: usa "de" como a data e fecha em +1 dia.
      if (!options.from) return { preset, from: null, to: null };
      const start = plainDateStart(options.from, timeZone);
      return { preset, from: asUtc(start), to: asUtc(addDays(start, 1)) };
    }
    case "custom": {
      const from = options.from ? plainDateStart(options.from, timeZone) : null;
      // `to` do usuário é inclusivo; internamente vira o início do dia seguinte.
      const to = options.to ? addDays(plainDateStart(options.to, timeZone), 1) : null;
      return { preset, from: from ? asUtc(from) : null, to: to ? asUtc(to) : null };
    }
    case "all":
    default:
      return { preset: "all", from: null, to: null };
  }
}

function plainDateStart(isoDate: string, timeZone: string): TZDate {
  const [year, month, day] = isoDate.split("-").map(Number);
  return startOfDay(new TZDate(year, (month ?? 1) - 1, day ?? 1, timeZone));
}

const YEAR_MONTH = /^\d{4}-\d{2}$/;

export function isYearMonth(value: string | null | undefined): value is string {
  return !!value && YEAR_MONTH.test(value);
}

/** "2026-09" no fuso do grupo -> mês civil atual, no formato aceito por resolveMonthPeriod. */
export function currentYearMonth(timeZone: string, now: Date = new Date()): string {
  const zoned = new TZDate(now, timeZone);
  return `${zoned.getFullYear()}-${String(zoned.getMonth() + 1).padStart(2, "0")}`;
}

/** Resolve um mês civil específico ("YYYY-MM") para [from, to) em UTC, no fuso do grupo. */
export function resolveMonthPeriod(yearMonth: string, timeZone: string): ResolvedPeriod {
  const [year, month] = yearMonth.split("-").map(Number);
  const start = startOfMonth(new TZDate(year, month - 1, 1, timeZone));
  const next = startOfMonth(new TZDate(year, month, 1, timeZone));
  return { preset: "month", from: asUtc(start), to: asUtc(next) };
}

/** Serializa para os parâmetros das RPCs (timestamptz ISO ou null). */
export function periodToRpcArgs(period: ResolvedPeriod) {
  return {
    p_from: period.from ? period.from.toISOString() : null,
    p_to: period.to ? period.to.toISOString() : null,
  };
}
