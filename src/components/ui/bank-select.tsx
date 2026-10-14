"use client";

import { useState, useEffect, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronDown, Check, Zap, Building2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BankInfo {
  id: number;
  name: string;
  code: string;
  bin: string;
  shortName: string;
  logo: string;
  isSepaySupported?: boolean;
}

// SePay supported bank codes / shortNames
const SEPAY_SUPPORTED_CODES = new Set([
  "VCB", "VIETCOMBANK",
  "ICB", "VIETINBANK",
  "BIDV",
  "VBA", "AGRIBANK",
  "MB", "MBBANK",
  "TCB", "TECHCOMBANK",
  "ACB",
  "VPB", "VPBANK",
  "TPB", "TPBANK",
  "STB", "SACOMBANK",
  "MSB",
  "OCB",
  "VIB",
  "NAB", "NAMABANK",
  "EIB", "EXIMBANK",
  "LPB", "LPBANK",
  "BAB", "BACABANK",
  "ABB", "ABBANK",
  "SEAB", "SEABANK",
  "CAKE"
]);

// Local fallback bank list in case API call fails or slow
const FALLBACK_BANKS: BankInfo[] = [
  { id: 43, name: "Ngân hàng TMCP Ngoại Thương Việt Nam", code: "VCB", bin: "970436", shortName: "Vietcombank", logo: "https://cdn.vietqr.io/img/VCB.png" },
  { id: 17, name: "Ngân hàng TMCP Công thương Việt Nam", code: "ICB", bin: "970415", shortName: "VietinBank", logo: "https://cdn.vietqr.io/img/ICB.png" },
  { id: 4, name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam", code: "BIDV", bin: "970418", shortName: "BIDV", logo: "https://cdn.vietqr.io/img/BIDV.png" },
  { id: 21, name: "Ngân hàng TMCP Quân đội", code: "MB", bin: "970422", shortName: "MBBank", logo: "https://cdn.vietqr.io/img/MB.png" },
  { id: 38, name: "Ngân hàng TMCP Kỹ thương Việt Nam", code: "TCB", bin: "970407", shortName: "Techcombank", logo: "https://cdn.vietqr.io/img/TCB.png" },
  { id: 2, name: "Ngân hàng TMCP Á Châu", code: "ACB", bin: "970416", shortName: "ACB", logo: "https://cdn.vietqr.io/img/ACB.png" },
  { id: 47, name: "Ngân hàng TMCP Việt Nam Thịnh Vượng", code: "VPB", bin: "970432", shortName: "VPBank", logo: "https://cdn.vietqr.io/img/VPB.png" },
  { id: 39, name: "Ngân hàng TMCP Tiên Phong", code: "TPB", bin: "970423", shortName: "TPBank", logo: "https://cdn.vietqr.io/img/TPB.png" },
  { id: 36, name: "Ngân hàng TMCP Sài Gòn Thương Tín", code: "STB", bin: "970403", shortName: "Sacombank", logo: "https://cdn.vietqr.io/img/STB.png" },
  { id: 45, name: "Ngân hàng TMCP Quốc tế Việt Nam", code: "VIB", bin: "970441", shortName: "VIB", logo: "https://cdn.vietqr.io/img/VIB.png" },
  { id: 42, name: "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam", code: "VBA", bin: "970405", shortName: "Agribank", logo: "https://cdn.vietqr.io/img/VBA.png" },
  { id: 26, name: "Ngân hàng TMCP Phương Đông", code: "OCB", bin: "970448", shortName: "OCB", logo: "https://cdn.vietqr.io/img/OCB.png" },
  { id: 22, name: "Ngân hàng TMCP Hàng Hải Việt Nam", code: "MSB", bin: "970426", shortName: "MSB", logo: "https://cdn.vietqr.io/img/MSB.png" },
  { id: 35, name: "Ngân hàng TMCP Sài Gòn - Hà Nội", code: "SHB", bin: "970443", shortName: "SHB", logo: "https://cdn.vietqr.io/img/SHB.png" },
];

interface BankSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function BankSelect({ value, onChange, className }: BankSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [banks, setBanks] = useState<BankInfo[]>(FALLBACK_BANKS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBanks() {
      try {
        const res = await fetch("https://api.vietqr.io/v2/banks");
        if (res.ok) {
          const json = await res.json();
          if (json.data && Array.isArray(json.data)) {
            const fetched = json.data.map((b: any) => ({
              id: b.id,
              name: b.name,
              code: b.code,
              bin: b.bin,
              shortName: b.shortName || b.short_name || b.code,
              logo: b.logo,
              isSepaySupported:
                SEPAY_SUPPORTED_CODES.has(b.code?.toUpperCase()) ||
                SEPAY_SUPPORTED_CODES.has(b.shortName?.toUpperCase()),
            }));
            setBanks(fetched);
          }
        }
      } catch (err) {
        console.error("Failed to fetch VietQR banks:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchBanks();
  }, []);

  const enrichedBanks = useMemo(() => {
    return banks.map((b) => ({
      ...b,
      isSepaySupported:
        SEPAY_SUPPORTED_CODES.has(b.code?.toUpperCase()) ||
        SEPAY_SUPPORTED_CODES.has(b.shortName?.toUpperCase()),
    }));
  }, [banks]);

  const selectedBank = useMemo(() => {
    if (!value) return null;
    const valUpper = value.toUpperCase();
    return (
      enrichedBanks.find(
        (b) =>
          b.shortName.toUpperCase() === valUpper ||
          b.code.toUpperCase() === valUpper ||
          b.name.toUpperCase() === valUpper
      ) ?? null
    );
  }, [value, enrichedBanks]);

  const filteredBanks = useMemo(() => {
    if (!search.trim()) return enrichedBanks;
    const q = search.trim().toUpperCase();
    return enrichedBanks.filter(
      (b) =>
        b.shortName.toUpperCase().includes(q) ||
        b.code.toUpperCase().includes(q) ||
        b.name.toUpperCase().includes(q)
    );
  }, [search, enrichedBanks]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium transition-all hover:border-ring focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer select-none",
          className
        )}
      >
        {selectedBank ? (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <img
              src={selectedBank.logo}
              alt={selectedBank.shortName}
              className="h-6 w-9 object-contain rounded bg-white p-0.5 border shrink-0"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <div className="flex items-center gap-2 truncate text-left">
              <span className="font-bold text-foreground text-sm">
                {selectedBank.shortName}
              </span>
              <span className="text-xs text-muted-foreground font-mono truncate hidden sm:inline">
                ({selectedBank.code})
              </span>
              {selectedBank.isSepaySupported && (
                <Badge variant="outline" className="h-4 text-[9px] px-1 font-bold bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-0.5 shrink-0">
                  <Zap className="h-2.5 w-2.5 fill-emerald-500 text-emerald-500" />
                  SePay
                </Badge>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-normal">
            <Building2 className="h-4 w-4 opacity-50" />
            <span>{value || "Chọn ngân hàng thụ hưởng..."}</span>
          </div>
        )}
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
      </PopoverTrigger>

      <PopoverContent className="w-[var(--anchor-width)] min-w-[280px] p-0 shadow-lg border rounded-xl" align="start">
        {/* Search Header */}
        <div className="p-2 border-b bg-muted/30 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />
          <Input
            placeholder="Tìm theo tên ngân hàng hoặc viết tắt (VD: VCB, MB)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 border-0 bg-transparent focus-visible:ring-0 text-xs shadow-none"
          />
        </div>

        {/* Bank List */}
        <div className="max-h-[300px] overflow-y-auto p-1 divide-y divide-border/40 scrollbar-thin">
          {loading && banks.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-xs text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Đang tải danh sách ngân hàng...
            </div>
          ) : filteredBanks.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Không tìm thấy ngân hàng khớp với từ khóa "{search}"
            </div>
          ) : (
            filteredBanks.map((bank) => {
              const isSelected =
                selectedBank?.id === bank.id ||
                value?.toUpperCase() === bank.shortName.toUpperCase() ||
                value?.toUpperCase() === bank.code.toUpperCase();

              return (
                <div
                  key={bank.id}
                  onClick={() => {
                    onChange(bank.shortName);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition-colors select-none",
                    isSelected
                      ? "bg-primary/10 text-primary font-semibold"
                      : "hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                    <img
                      src={bank.logo}
                      alt={bank.shortName}
                      className="h-7 w-11 object-contain rounded bg-white p-0.5 border shrink-0"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-foreground text-xs">
                          {bank.shortName}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ({bank.code})
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                        {bank.name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {bank.isSepaySupported && (
                      <Badge variant="outline" className="h-5 text-[9px] px-1.5 font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-0.5">
                        <Zap className="h-3 w-3 fill-emerald-500 text-emerald-500" />
                        SePay
                      </Badge>
                    )}
                    {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
