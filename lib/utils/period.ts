import { TZDate } from "@date-fns/tz";
import { addDays, startOfDay, startOfMonth, startOfYear } from "date-fns";
import { DEFAULT_TIMEZONE } from "./format";

export const PERIOD_PRESETS = ["all", "year", "month", "custom"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  all: "Todo o período",
  year: "Ano atual",
  month: "Mês atual",
  custom: "Personalizado",
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

  const asUtc = (value: TZDate | Date): Date => new Date(value.getTime());

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

/** Serializa para os parâmetros das RPCs (timestamptz ISO ou null). */
export function periodToRpcArgs(period: ResolvedPeriod) {
  return {
    p_from: period.from ? period.from.toISOString() : null,
    p_to: period.to ? period.to.toISOString() : null,
  };
}
