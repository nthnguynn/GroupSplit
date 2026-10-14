"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Button } from "@/components/ui/button";
import { DateRange } from "react-day-picker";
import { format, subDays, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";

interface DashboardFiltersProps {
  from?: string;
  to?: string;
}

export function DashboardFilters({ from, to }: DashboardFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Chuyển string sang Date cho DateRangePicker
  const value: DateRange | undefined =
    from && to
      ? {
          from: new Date(from),
          to: new Date(to),
        }
      : undefined;

  const updateRange = (range: DateRange | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    if (range?.from && range?.to) {
      params.set("from", format(range.from, "yyyy-MM-dd"));
      params.set("to", format(range.to, "yyyy-MM-dd"));
    } else {
      params.delete("from");
      params.delete("to");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const setPreset = (preset: string) => {
    const today = new Date();
    let range: DateRange | undefined;

    switch (preset) {
      case "today":
        range = { from: today, to: today };
        break;
      case "7days":
        range = { from: subDays(today, 6), to: today };
        break;
      case "30days":
        range = { from: subDays(today, 29), to: today };
        break;
      case "thisMonth":
        range = { from: startOfMonth(today), to: endOfMonth(today) };
        break;
      case "lastMonth":
        const lastMonth = subMonths(today, 1);
        range = { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
        break;
      default:
        range = undefined;
    }

    updateRange(range);
  };

  // Xác định nút preset nào đang active
  const isPresetActive = (preset: string) => {
    const today = new Date();
    let pFrom = "";
    let pTo = "";

    switch (preset) {
      case "today":
        pFrom = format(today, "yyyy-MM-dd");
        pTo = format(today, "yyyy-MM-dd");
        break;
      case "7days":
        pFrom = format(subDays(today, 6), "yyyy-MM-dd");
        pTo = format(today, "yyyy-MM-dd");
        break;
      case "30days":
        pFrom = format(subDays(today, 29), "yyyy-MM-dd");
        pTo = format(today, "yyyy-MM-dd");
        break;
      case "thisMonth":
        pFrom = format(startOfMonth(today), "yyyy-MM-dd");
        pTo = format(endOfMonth(today), "yyyy-MM-dd");
        break;
      case "lastMonth":
        const lastMonth = subMonths(today, 1);
        pFrom = format(startOfMonth(lastMonth), "yyyy-MM-dd");
        pTo = format(endOfMonth(lastMonth), "yyyy-MM-dd");
        break;
    }

    return from === pFrom && to === pTo;
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between bg-card p-4 rounded-xl border shadow-sm">
      <div className="flex flex-wrap gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPreset("today")}
          className={cn(
            "text-xs h-8 px-3 cursor-pointer",
            isPresetActive("today") &&
              "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          Hôm nay
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPreset("7days")}
          className={cn(
            "text-xs h-8 px-3 cursor-pointer",
            isPresetActive("7days") &&
              "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          7 ngày qua
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPreset("30days")}
          className={cn(
            "text-xs h-8 px-3 cursor-pointer",
            isPresetActive("30days") &&
              "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          30 ngày qua
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPreset("thisMonth")}
          className={cn(
            "text-xs h-8 px-3 cursor-pointer",
            isPresetActive("thisMonth") &&
              "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          Tháng này
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPreset("lastMonth")}
          className={cn(
            "text-xs h-8 px-3 cursor-pointer",
            isPresetActive("lastMonth") &&
              "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          Tháng trước
        </Button>
      </div>

      <DateRangePicker
        value={value}
        onChange={updateRange}
        placeholder="Chọn khoảng ngày"
      />
    </div>
  );
}
