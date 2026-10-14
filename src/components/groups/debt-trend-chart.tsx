"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatVND, formatDate } from "@/lib/utils/format";

interface Member {
  userId: string;
  user: {
    id: string;
    displayName: string;
  };
}

interface Settlement {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  isConfirmed: boolean;
  createdAt: string;
  note: string | null;
}

interface DebtTrendChartProps {
  members: Member[];
  expenses: Array<{
    id: string;
    title: string;
    amount: number;
    paidById: string;
    date: string;
    splits: Array<{
      userId: string;
      amount: number;
    }>;
    category: string;
  }>;
  settlements: Settlement[];
  currentUserId: string;
}

const LINE_COLORS = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f43f5e", // rose
  "#eab308", // yellow
  "#a855f7", // purple
  "#f97316", // orange
  "#06b6d4", // cyan
  "#ec4899", // pink
];

function getHistoricalBalances(
  members: Member[],
  expenses: any[],
  settlements: Settlement[]
) {
  const changesByDate: Record<string, Record<string, number>> = {};

  const addChange = (dateStr: string, userId: string, amount: number) => {
    if (!changesByDate[dateStr]) {
      changesByDate[dateStr] = {};
    }
    changesByDate[dateStr][userId] = (changesByDate[dateStr][userId] || 0) + amount;
  };

  for (const exp of expenses) {
    const dateStr = exp.date.split("T")[0];
    for (const split of exp.splits) {
      if (split.userId === exp.paidById) continue;
      addChange(dateStr, split.userId, -split.amount);
      addChange(dateStr, exp.paidById, split.amount);
    }
  }

  for (const s of settlements) {
    if (!s.isConfirmed) continue;
    const dateStr = s.createdAt.split("T")[0];
    addChange(dateStr, s.fromUserId, s.amount);
    addChange(dateStr, s.toUserId, -s.amount);
  }

  const dates = Object.keys(changesByDate).sort();
  
  const runningBalances: Record<string, number> = {};
  for (const m of members) {
    runningBalances[m.userId] = 0;
  }

  const historyData: any[] = [];

  if (dates.length > 0) {
    const firstDate = new Date(dates[0]);
    const startDay = new Date(firstDate);
    startDay.setDate(startDay.getDate() - 1);
    const startDayStr = startDay.toISOString().split("T")[0];
    
    const initialPoint: any = { date: startDayStr };
    for (const m of members) {
      initialPoint[m.user.displayName] = 0;
    }
    historyData.push(initialPoint);

    for (const dateStr of dates) {
      const changes = changesByDate[dateStr];
      for (const userId of Object.keys(runningBalances)) {
        if (changes[userId]) {
          runningBalances[userId] += changes[userId];
        }
      }

      const dataPoint: any = { date: dateStr };
      for (const m of members) {
        dataPoint[m.user.displayName] = runningBalances[m.userId];
      }
      historyData.push(dataPoint);
    }
  }

  const todayStr = new Date().toISOString().split("T")[0];
  if (!changesByDate[todayStr] && dates.length > 0) {
    const lastPoint: any = { date: todayStr };
    for (const m of members) {
      lastPoint[m.user.displayName] = runningBalances[m.userId];
    }
    historyData.push(lastPoint);
  }

  return historyData;
}

export function DebtTrendChart({
  members,
  expenses,
  settlements,
  currentUserId,
}: DebtTrendChartProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const rawHistoryData = getHistoricalBalances(members, expenses, settlements);

  const filteredHistoryData = rawHistoryData.filter((point) => {
    const pTime = new Date(point.date).getTime();
    if (dateRange?.from) {
      const fromTime = new Date(dateRange.from).setHours(0, 0, 0, 0);
      if (pTime < fromTime) return false;
    }
    if (dateRange?.to) {
      const toTime = new Date(dateRange.to).setHours(23, 59, 59, 999);
      if (pTime > toTime) return false;
    }
    return true;
  });

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="font-bold text-sm">Xu hướng dư nợ nhóm theo ngày</h3>
            <p className="text-[10px] text-muted-foreground">
              Số dư dương (+) = được nhận, âm (-) = phải trả
            </p>
          </div>
          <div className="w-full sm:w-auto shrink-0">
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              placeholder="Chọn khoảng ngày"
            />
          </div>
        </div>
        
        {filteredHistoryData.length === 0 ? (
          <div className="h-60 w-full flex items-center justify-center border border-dashed rounded-xl text-xs text-muted-foreground">
            Chưa có đủ dữ liệu để vẽ biểu đồ xu hướng
          </div>
        ) : (
          <div className="h-60 w-full font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={filteredHistoryData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  stroke="#888888"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(val) => `${val / 1000}k`}
                  stroke="#888888"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                 <Tooltip
                  labelFormatter={(label) => formatDate(String(label))}
                  formatter={(value: any) => [formatVND(Number(value)), "Số dư"]}
                  contentStyle={{
                    backgroundColor: "var(--background)",
                    borderColor: "var(--border)",
                    borderRadius: "0.5rem",
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "10px", marginTop: "10px" }} />
                {members.map((m, idx) => (
                  <Line
                    key={m.userId}
                    type="monotone"
                    dataKey={m.user.displayName}
                    stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                    strokeWidth={m.userId === currentUserId ? 3 : 1.8}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
