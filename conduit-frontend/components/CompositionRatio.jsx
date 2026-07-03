import { PieChart, Pie, Cell } from "recharts";

export default function CompositionRatio({ active, idle, size = 72 }) {
  const data = [
    { name: "Active", value: active },
    { name: "Idle", value: idle },
  ];

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <PieChart width={size} height={size}>
        <Pie
          data={data}
          dataKey="value"
          innerRadius={size / 2 - 10}
          outerRadius={size / 2}
          startAngle={90}
          endAngle={-270}
          stroke="none"
        >
          <Cell fill="var(--color-signal)" />
          <Cell fill="rgba(245,245,240,0.14)" />
        </Pie>
      </PieChart>
      <div className="absolute inset-0 flex items-center justify-center font-mono text-[13px] text-paper">
        {active}%
      </div>
    </div>
  );
}
