"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatVND } from "@/lib/utils/format";

interface CategoryData {
  id: string;
  name: string;
  icon: string;
  amount: number;
  percentage: number;
}

interface SpendingDonutChartProps {
  data: CategoryData[];
}

// Bảng màu hiện đại cho các danh mục
const COLORS = [
  "hsl(var(--primary))",
  "#3b82f6", // xanh dương
  "#10b981", // lục bảo
  "#f59e0b", // hổ phách
  "#ef4444", // đỏ
  "#8b5cf6", // tím
  "#ec4899", // hồng
  "#06b6d4", // lam
  "#14b8a6", // ngọc lục bảo
  "#f97316", // cam
  "#6b7280", // xám
];

export function SpendingDonutChart({ data }: SpendingDonutChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Chưa có dữ liệu chi tiêu theo danh mục
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      {/* Vòng tròn biểu đồ */}
      <div className="h-44 w-44 shrink-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              formatter={(value) => [formatVND(value as number), "Chi tiêu"]}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.5rem",
                fontSize: "12px",
              }}
            />
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
              dataKey="amount"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Nhãn ở giữa vòng tròn */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Tổng cộng</span>
          <span className="text-sm font-bold truncate max-w-[120px]">
            {formatVND(total)}
          </span>
        </div>
      </div>

      {/* Danh sách chú giải */}
      <div className="flex-1 w-full max-h-[180px] overflow-y-auto pr-1 space-y-2 scrollbar-thin">
        {data.map((item, index) => {
          const color = COLORS[index % COLORS.length];
          return (
            <div key={item.id} className="flex items-center justify-between text-xs gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-base leading-none shrink-0">{item.icon}</span>
                <span className="font-medium truncate text-muted-foreground">
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-semibold">{formatVND(item.amount)}</span>
                <span className="text-muted-foreground font-mono text-[10px] w-8 text-right">
                  {item.percentage.toFixed(0)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
