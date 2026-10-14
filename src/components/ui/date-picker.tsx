"use client";

import * as React from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  className?: string;
  value: Date | undefined;
  onChange: (value: Date | undefined) => void;
  placeholder?: string;
}

export function DatePicker({
  className,
  value,
  onChange,
  placeholder = "Chọn ngày",
}: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-full justify-start text-left font-normal h-11 text-sm gap-2 select-none cursor-pointer",
          !value && "text-muted-foreground",
          className
        )}
      >
        <CalendarIcon className="h-4 w-4 shrink-0 opacity-80" />
        <span className="truncate">
          {value ? format(value, "dd/MM/yyyy", { locale: vi }) : placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-50 bg-popover border border-border shadow-md rounded-lg" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          locale={vi}
        />
      </PopoverContent>
    </Popover>
  );
}
