import React from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function TooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => <div key={item.dataKey}><span>{item.name}</span><b>{item.value}</b></div>)}
    </div>
  );
}

export default function TrendChart({ data, compact = false }) {
  return (
    <ResponsiveContainer width="100%" height={compact ? 190 : 280}>
      <LineChart data={data} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 5" stroke="#e6efef" vertical={false} />
        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#758287', fontSize: 12 }} dy={8} />
        <YAxis domain={[50, 100]} axisLine={false} tickLine={false} tick={{ fill: '#758287', fontSize: 12 }} width={28} />
        <Tooltip content={<TooltipContent />} cursor={{ stroke: '#d6e4e4' }} />
        <Line type="monotone" dataKey="score" name="Functional score" stroke="#0f766e" strokeWidth={3.5} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
