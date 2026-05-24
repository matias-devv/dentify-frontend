import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Period = "Semana" | "Mes" | "Año";

// 4-pointed concave sparkle star — path derived by rotating the top→right
// cubic bezier segment 90° CW three times. Control factor c=0.28 produces
// the tight inward concave sides matching the reference star shape.
const makeStar = (cx: number, cy: number, R: number) => {
  const c = 0.28;
  const cr = c * R;
  return [
    `M ${cx} ${cy - R}`,
    `C ${cx + cr} ${cy} ${cx} ${cy - cr} ${cx + R} ${cy}`,
    `C ${cx} ${cy + cr} ${cx + cr} ${cy} ${cx} ${cy + R}`,
    `C ${cx - cr} ${cy} ${cx} ${cy + cr} ${cx - R} ${cy}`,
    `C ${cx} ${cy - cr} ${cx - cr} ${cy} ${cx} ${cy - R}`,
    "Z",
  ].join(" ");
};

const StarDot = ({ cx, cy, active }: { cx?: number; cy?: number; active?: boolean }) => {
  if (cx == null || cy == null) return null;
  const R = active ? 10 : 6;
  return (
    <path
      d={makeStar(cx, cy, R)}
      fill="#2563EB"
      stroke={active ? "#fff" : "none"}
      strokeWidth={active ? 2 : 0}
    />
  );
};

const formatCurrency = (value: number) => {
  if (value === 0) return "$0";
  return "$" + value.toLocaleString("es-AR");
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-4 py-3">
      <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">{label}</p>
      <p className="text-base font-semibold text-blue-600">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  );
};

interface IncomeChartProps {
  data: any[];
  period: "Semana" | "Mes" | "Año";
}

export default function IncomeChart({ data, period }: IncomeChartProps) {
  // Mapear los datos de la API al formato esperado
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return data.map((item: any) => ({
      label: item.label || item.date || "",
      value: item.amount || item.value || 0,
    }));
  }, [data]);

  const { yMax, yTicks } = useMemo(() => {
    if (chartData.length === 0) return { yMax: 1000, yTicks: [0, 250, 500, 750, 1000] };
    
    const maxVal = Math.max(...chartData.map((d) => d.value));
    const step = period === "Año" ? 7500 : 4500;
    const top = Math.ceil(maxVal / step) * step;
    return {
      yMax: top,
      yTicks: [0, top / 4, top / 2, (top * 3) / 4, top],
    };
  }, [chartData, period]);

  const xInterval = period === "Mes" ? 6 : 0;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={chartData} margin={{ top: 16, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.22} />
            <stop offset="90%" stopColor="#3B82F6" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="0"
          stroke="#F1F3F5"
          vertical={false}
        />

        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "#A0AEC0", fontFamily: "Inter, sans-serif" }}
          interval={xInterval}
        />

        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "#A0AEC0", fontFamily: "Inter, sans-serif" }}
          tickFormatter={formatCurrency}
          ticks={yTicks}
          domain={[0, yMax]}
          width={72}
        />

        <Tooltip
          content={<CustomTooltip />}
          cursor={{ stroke: "#E2E8F0", strokeWidth: 1 }}
        />

        <Area
          type="linear"
          dataKey="value"
          stroke="#2563EB"
          strokeWidth={1.5}
          fill="url(#blueGrad)"
          dot={(props: any) => <StarDot cx={props.cx} cy={props.cy} />}
          activeDot={(props: any) => (
            <StarDot cx={props.cx} cy={props.cy} active />
          )}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
