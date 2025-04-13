// src/components/charts/DistributionChart.tsx
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

// Props interface for the chart component
interface DistributionChartProps {
  data?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  height?: number;
}

// Default distribution data
const defaultData = [
  { name: 'Team', value: 20, color: '#8884d8' },
  { name: 'Community', value: 40, color: '#82ca9d' },
  { name: 'Treasury', value: 20, color: '#ffc658' },
  { name: 'Liquidity', value: 20, color: '#ff8042' }
];

const DistributionChart: React.FC<DistributionChartProps> = ({ 
  data = defaultData,
  height = 250
}) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={80}
          innerRadius={50}
          fill="#8884d8"
          dataKey="value"
          label={({name, value}) => `${name}: ${value}%`}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
};

export default DistributionChart;