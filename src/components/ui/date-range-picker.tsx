"use client";

import * as React from "react";
import { format, subDays, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { vi } from "date-fns/locale";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
  className?: string;
  value: DateRange | undefined;
  onChange: (value: DateRange | undefined) => void;
  placeholder?: string;
}

export function DateRangePicker({
  className,
  value,
  onChange,
  placeholder = "Chọn khoảng thời gian",
}: DateRangePickerProps) {
  const [numberOfMonths, setNumberOfMonths] = React.useState(2);

  React.useEffect(() => {
    const checkMobile = () => {
      setNumberOfMonths(window.innerWidth < 640 ? 1 : 2);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const presets = [
    {
      label: "Hôm nay",
      getValue: () => {
        const today = new Date();
        return { from: today, to: today };
      },
    },
    {
      label: "7 ngày qua",
      getValue: () => {
        const today = new Date();
        return { from: subDays(today, 6), to: today };
      },
    },
    {
      label: "30 ngày qua",
      getValue: () => {
        const today = new Date();
        return { from: subDays(today, 29), to: today };
      },
    },
    {
      label: "Tháng này",
      getValue: () => {
        const today = new Date();
        return { from: startOfMonth(today), to: endOfMonth(today) };
      },
    },
    {
      label: "Tháng trước",
      getValue: () => {
        const today = new Date();
        const lastMonth = subMonths(today, 1);
        return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
      },
    },
  ];

  const isPresetActive = (presetVal: DateRange) => {
    if (!value || !value.from || !value.to || !presetVal.from || !presetVal.to) return false;
    const formatStr = "yyyy-MM-dd";
    return (
      format(value.from, formatStr) === format(presetVal.from, formatStr) &&
      format(value.to, formatStr) === format(presetVal.to, formatStr)
    );
  };

  return (
    <div className={cn("grid gap-2 w-full sm:w-auto", className)}>
      <Popover>
        <PopoverTrigger
          id="date"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "w-full sm:w-[260px] justify-start text-left font-normal h-9 text-xs gap-2 select-none cursor-pointer",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-80" />
          <span className="truncate flex-1">
            {value?.from ? (
              value.to ? (
                <>
                  {format(value.from, "dd/MM/yyyy", { locale: vi })} -{" "}
                  {format(value.to, "dd/MM/yyyy", { locale: vi })}
                </>
              ) : (
                format(value.from, "dd/MM/yyyy", { locale: vi })
              )
            ) : (
              <span>{placeholder}</span>
            )}
          </span>
          {value && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
              }}
              className="h-4 w-4 rounded-full flex items-center justify-center hover:bg-muted-foreground/20 text-muted-foreground transition-all shrink-0 cursor-pointer"
              title="Xóa khoảng ngày"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-50 bg-popover border border-border shadow-md rounded-lg" align="start">
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border">
            {/* Presets List */}
            <div className="p-3 flex flex-row sm:flex-col gap-1 overflow-x-auto sm:overflow-x-visible shrink-0 sm:w-36 bg-muted/20">
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "justify-start text-[11px] font-medium h-8 px-2 w-auto sm:w-full shrink-0 select-none cursor-pointer",
                    isPresetActive(preset.getValue()) && "bg-primary/10 text-primary hover:bg-primary/15"
                  )}
                  onClick={() => onChange(preset.getValue())}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            {/* Calendar */}
            <div className="p-1">
              <Calendar
                mode="range"
                defaultMonth={value?.from}
                selected={value}
                onSelect={onChange}
                numberOfMonths={numberOfMonths}
                locale={vi}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
