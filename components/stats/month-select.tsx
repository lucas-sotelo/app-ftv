"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMonthYear } from "@/lib/utils/format";

/**
 * Seletor de mês da aba Individual (visão Mensal). Estado vive na URL
 * (`mes=YYYY-MM`), mesmo padrão dos demais filtros da tela de estatísticas.
 */
export function MonthSelect({ value, months }: { value: string; months: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("mes", next);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      }}
    >
      <SelectTrigger aria-label="Selecionar mês" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {months.map((month) => (
          <SelectItem key={month} value={month.slice(0, 7)}>
            {formatMonthYear(month)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
