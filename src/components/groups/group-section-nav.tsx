import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle2, Coins, Receipt, Settings, Users, Wallet } from "lucide-react";

export const GROUP_SECTIONS = [
  "expenses",
  "settle",
  "group-fund",
  "funds",
  "members",
  "settings",
] as const;

export type GroupSection = (typeof GROUP_SECTIONS)[number];

export function parseGroupSection(value: string | string[] | undefined): GroupSection {
  return typeof value === "string" && GROUP_SECTIONS.includes(value as GroupSection)
    ? (value as GroupSection)
    : "expenses";
}

const sections = [
  { value: "expenses", label: "Hóa đơn", icon: Receipt },
  { value: "settle", label: "Trả nợ", icon: CheckCircle2 },
  { value: "group-fund", label: "Quỹ nhóm", icon: Wallet },
  { value: "funds", label: "Cấp quỹ", icon: Coins },
  { value: "members", label: "Thành viên", icon: Users },
  { value: "settings", label: "Cài đặt", icon: Settings },
] as const satisfies ReadonlyArray<{
  value: GroupSection;
  label: string;
  icon: typeof Receipt;
}>;

interface GroupSectionNavProps {
  groupId: string;
  activeSection: GroupSection;
  pendingCount: number;
  searchParams: Record<string, string | string[] | undefined>;
}

export function GroupSectionNav({
  groupId,
  activeSection,
  pendingCount,
  searchParams,
}: GroupSectionNavProps) {
  const hrefFor = (section: GroupSection) => {
    const params = new URLSearchParams();
    for (const [key, rawValue] of Object.entries(searchParams)) {
      const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
      if (value !== undefined) params.set(key, value);
    }
    if (section === "expenses") params.delete("tab");
    else params.set("tab", section);
    const query = params.toString();
    return `/groups/${groupId}${query ? `?${query}` : ""}`;
  };

  return (
    <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0 scrollbar-none pb-1">
      <nav
        aria-label="Nội dung nhóm"
        className="grid grid-cols-6 w-full min-w-[560px] sm:min-w-0 lg:w-[720px] h-9 rounded-lg bg-muted p-1"
      >
        {sections.map(({ value, label, icon: Icon }) => {
          const active = value === activeSection;
          return (
            <Link
              key={value}
              href={hrefFor(value)}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-full items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-xs sm:text-sm font-medium whitespace-nowrap transition-all",
                active
                  ? "bg-background text-foreground shadow-sm dark:bg-background/80"
                  : "text-foreground/60 hover:text-foreground dark:text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              {value === "expenses" && pendingCount > 0 && (
                <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-[10px]">
                  {pendingCount}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
