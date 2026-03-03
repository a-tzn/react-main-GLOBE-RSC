import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export default function AnalyticsDashboard({ data }) {

  // 1. Calculate stats for the Pie Chart
  const stats = data.reduce((acc, r) => {
    acc[r.matchStatus] = (acc[r.matchStatus] || 0) + 1;
    return acc;
  }, {});

  const newSites = stats.NEW || 0;
  const removed = stats.REMOVED || 0;
  const mismatch = stats.MISMATCH || 0;
  const unchanged = stats.UNCHANGED || 0;

  // 2. Map data for the Pie Chart
  const chartData = [
    { name: 'New', value: newSites, color: '#1eff00' },
    { name: 'Removed', value: removed, color: '#dc3545' },
    { name: 'Mismatch', value: mismatch, color: '#ff8b07' },
    { name: 'Unchanged', value: unchanged, color: '#5e5e5d' }
  ].filter(item => item.value > 0);

  // 3. Return ONLY the Chart Section
  return (
    <div className="chart-section">
      <h4 className="chart-title">Delta Breakdown</h4>
      <div style={{ width: '100%', height: 130 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie 
              data={chartData} 
              cx="50%" 
              cy="50%" 
              innerRadius={35} 
              outerRadius={55} 
              paddingAngle={5} 
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}