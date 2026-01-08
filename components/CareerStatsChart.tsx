import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';

interface DataPoint {
  label: string;
  profitRate: number;
  winRate: number;
}

interface CareerStatsChartProps {
  data: DataPoint[];
}

const CareerStatsChart: React.FC<CareerStatsChartProps> = ({ data }) => {
  const chartWidth = 280;
  const chartHeight = 100;
  const padding = { top: 10, right: 10, bottom: 20, left: 35 };
  
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const { profitPath, winRatePath, yMin, yMax, yTicks, xTicks } = useMemo(() => {
    if (data.length === 0) return { profitPath: '', winRatePath: '', yMin: -50, yMax: 100, yTicks: [], xTicks: [] };

    // 计算 Y 轴范围（利润率可能为负，胜率 0-100）
    const allProfits = data.map(d => d.profitRate);
    const allWinRates = data.map(d => d.winRate);
    const allValues = [...allProfits, ...allWinRates];
    
    let minVal = Math.min(...allValues, 0);
    let maxVal = Math.max(...allValues, 100);
    
    // 添加一些边距
    const range = maxVal - minVal;
    minVal = Math.floor(minVal - range * 0.1);
    maxVal = Math.ceil(maxVal + range * 0.1);
    
    // 生成 Y 轴刻度
    const tickCount = 3;
    const tickStep = (maxVal - minVal) / (tickCount - 1);
    const ticks = Array.from({ length: tickCount }, (_, i) => Math.round(minVal + i * tickStep));

    // 生成 X 轴刻度（显示部分日期）
    const xTicksArr = data.length <= 5 
      ? data.map((d, i) => ({ index: i, label: d.label }))
      : [
          { index: 0, label: data[0].label },
          { index: Math.floor(data.length / 2), label: data[Math.floor(data.length / 2)].label },
          { index: data.length - 1, label: data[data.length - 1].label }
        ];

    // 计算点位置
    const getX = (index: number) => padding.left + (index / Math.max(data.length - 1, 1)) * innerWidth;
    const getY = (value: number) => padding.top + ((maxVal - value) / (maxVal - minVal)) * innerHeight;

    // 生成路径
    const profitPoints = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.profitRate)}`).join(' ');
    const winRatePoints = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.winRate)}`).join(' ');

    return { 
      profitPath: profitPoints, 
      winRatePath: winRatePoints, 
      yMin: minVal, 
      yMax: maxVal,
      yTicks: ticks,
      xTicks: xTicksArr
    };
  }, [data]);

  if (data.length < 2) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 mb-3 text-center text-gray-400 text-sm">
        <TrendingUp size={24} className="mx-auto mb-2 opacity-30" />
        至少需要 2 局游戏记录才能生成趋势图
      </div>
    );
  }

  const getX = (index: number) => padding.left + (index / Math.max(data.length - 1, 1)) * innerWidth;
  const getY = (value: number) => padding.top + ((yMax - value) / (yMax - yMin)) * innerHeight;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-600 dark:text-gray-400 flex items-center gap-1">
          <TrendingUp size={14} /> 生涯趋势
        </span>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-emerald-500 rounded"></span>
            <span className="text-gray-500">利润率</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-blue-500 rounded"></span>
            <span className="text-gray-500">胜率</span>
          </span>
        </div>
      </div>
      
      <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet">
        {/* 网格线 */}
        {yTicks.map(tick => (
          <g key={tick}>
            <line
              x1={padding.left}
              y1={getY(tick)}
              x2={chartWidth - padding.right}
              y2={getY(tick)}
              stroke="currentColor"
              className="text-gray-200 dark:text-gray-800"
              strokeDasharray="2,2"
            />
            <text
              x={padding.left - 5}
              y={getY(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="text-gray-400 text-[8px] fill-current"
            >
              {tick}%
            </text>
          </g>
        ))}
        
        {/* 零线高亮 */}
        {yMin < 0 && yMax > 0 && (
          <line
            x1={padding.left}
            y1={getY(0)}
            x2={chartWidth - padding.right}
            y2={getY(0)}
            stroke="currentColor"
            className="text-gray-400 dark:text-gray-600"
            strokeWidth={1}
          />
        )}

        {/* X 轴刻度 */}
        {xTicks.map(tick => (
          <text
            key={tick.index}
            x={getX(tick.index)}
            y={chartHeight - 5}
            textAnchor="middle"
            className="text-gray-400 text-[8px] fill-current"
          >
            {tick.label}
          </text>
        ))}

        {/* 利润率折线 */}
        <path
          d={profitPath}
          fill="none"
          stroke="#10b981"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* 胜率折线 */}
        <path
          d={winRatePath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 利润率数据点 */}
        {data.map((d, i) => (
          <circle
            key={`profit-${i}`}
            cx={getX(i)}
            cy={getY(d.profitRate)}
            r={3}
            fill="#10b981"
            className="hover:r-4 transition-all"
          />
        ))}

        {/* 胜率数据点 */}
        {data.map((d, i) => (
          <circle
            key={`winrate-${i}`}
            cx={getX(i)}
            cy={getY(d.winRate)}
            r={3}
            fill="#3b82f6"
            className="hover:r-4 transition-all"
          />
        ))}
      </svg>

      {/* 最新数据摘要 */}
      {data.length > 0 && (
        <div className="flex justify-center gap-4 mt-2 text-[10px]">
          <span className={`font-bold ${data[data.length - 1].profitRate >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            当前利润率: {data[data.length - 1].profitRate.toFixed(1)}%
          </span>
          <span className={`font-bold ${data[data.length - 1].winRate >= 50 ? 'text-blue-500' : 'text-orange-500'}`}>
            当前胜率: {data[data.length - 1].winRate.toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
};

export default CareerStatsChart;
