import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as klinechartsModule from 'klinecharts';
import { KLineData, Timeframe, GameSession, Trade } from '../types';
import { getHigherTimeframe } from '../services/binanceService';
import { FastForward } from 'lucide-react';

const klinecharts = (klinechartsModule as any).default || klinechartsModule;

interface GameChartsProps {
  theme: 'dark' | 'light';
  session: GameSession | null;
  ltfData: KLineData[];
  htfData: KLineData[];
  currentHtfCandle: KLineData | null;
  trades: Trade[]; // To redraw markers
  isReviewingHistory: boolean;
  onBackToLive: () => void;
  onCandleClick: (timestamp: number) => void;
}

export interface GameChartsRef {
  resize: () => void;
  getImages: () => { ltfImage?: string; htfImage?: string };
}

const GameCharts = forwardRef<GameChartsRef, GameChartsProps>(({
  theme, session, ltfData, htfData, currentHtfCandle,
  trades, isReviewingHistory, onBackToLive, onCandleClick
}, ref) => {
  const ltfChartRef = useRef<HTMLDivElement>(null);
  const htfChartRef = useRef<HTMLDivElement>(null);
  const ltfChartInstance = useRef<any>(null);
  const htfChartInstance = useRef<any>(null);

  // Expose methods
  useImperativeHandle(ref, () => ({
    resize: () => {
      ltfChartInstance.current?.resize();
      htfChartInstance.current?.resize();
    },
    getImages: () => {
      const getImg = (chart: any) => {
        if (!chart) return undefined;
        try {
           // @ts-ignore
           if (typeof chart.getDataUrl === 'function') return chart.getDataUrl({ type: 'jpeg', backgroundColor: '#111827' });
           // @ts-ignore
           if (typeof chart.getConvertPictureUrl === 'function') return chart.getConvertPictureUrl(true, 'jpeg', '#111827');
        } catch(e) { console.warn(e); }
        return undefined;
      };
      return {
        ltfImage: getImg(ltfChartInstance.current),
        htfImage: getImg(htfChartInstance.current)
      };
    }
  }));

  // Init Charts
  useEffect(() => {
    if (ltfChartRef.current && htfChartRef.current) {
        if (ltfChartInstance.current) klinecharts.dispose(ltfChartRef.current);
        if (htfChartInstance.current) klinecharts.dispose(htfChartRef.current);

        ltfChartInstance.current = klinecharts.init(ltfChartRef.current);
        htfChartInstance.current = klinecharts.init(htfChartRef.current);

        // Only create Volume indicator, removed MA
        ltfChartInstance.current?.createTechnicalIndicator('VOL');
        htfChartInstance.current?.createTechnicalIndicator('VOL');
        
        // Click listener
        ltfChartInstance.current?.subscribeAction('onCandleBarClick', (params: any) => {
            const data = params.data || params;
            if (data?.timestamp) onCandleClick(data.timestamp);
        });

        // Setup Zoom/Scroll
        ltfChartInstance.current?.setZoomEnabled(true);
        ltfChartInstance.current?.setScrollEnabled(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount to create instances

  // Update Styles
  useEffect(() => {
      const chartBg = theme === 'dark' ? '#111827' : '#ffffff';
      const chartText = theme === 'dark' ? '#9CA3AF' : '#4b5563';
      const chartBorder = theme === 'dark' ? '#374151' : '#e5e7eb';
      const chartGrid = theme === 'dark' ? '#1f2937' : '#f3f4f6';

      const styles = {
        grid: { show: false, horizontal: { color: chartGrid }, vertical: { color: chartGrid } },
        candle: { bar: { upColor: '#2ebd85', downColor: '#f6465d', noChangeColor: '#888888' } },
        layout: { backgroundColor: chartBg, textColor: chartText },
        crosshair: { horizontal: { text: { color: '#ffffff' } }, vertical: { text: { color: '#ffffff' } } },
        separator: { size: 1, color: chartBorder },
        yAxis: { inside: false, axisLine: { show: true, color: chartBorder }, tickText: { show: true, color: chartText } }
      };

      ltfChartInstance.current?.setStyleOptions(styles);
      htfChartInstance.current?.setStyleOptions(styles);
  }, [theme]);

  // Handle Resize
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
        ltfChartInstance.current?.resize();
        htfChartInstance.current?.resize();
    });
    if (ltfChartRef.current) resizeObserver.observe(ltfChartRef.current);
    if (htfChartRef.current) resizeObserver.observe(htfChartRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Update Data (Bulk or Single)
  useEffect(() => {
      // If we are reviewing history or it's a fresh load, apply full data
      // For simple "nextCandle", we could use updateData, but React props usually mean "here is the state".
      // We need to differentiate between "Append one" and "Replace all" to be efficient?
      // For simplicity in this architecture, we rely on ApplyNewData if length changes significantly or reset.
      // Actually, standard klinecharts behavior with ApplyNewData is fine for small datasets (~1000).
      
      if (ltfChartInstance.current) {
         ltfChartInstance.current.applyNewData(ltfData);
      }
      
      if (htfChartInstance.current) {
         // Combine history HTF with current partial HTF
         const dataToRender = [...htfData];
         if (currentHtfCandle) {
             const lastHistory = dataToRender[dataToRender.length - 1];
             if (lastHistory && lastHistory.timestamp === currentHtfCandle.timestamp) {
                 dataToRender[dataToRender.length - 1] = currentHtfCandle;
             } else {
                 dataToRender.push(currentHtfCandle);
             }
         }
         htfChartInstance.current.applyNewData(dataToRender);
      }
  }, [ltfData, htfData, currentHtfCandle]);

  // Draw Markers
  useEffect(() => {
      if (!ltfChartInstance.current) return;
      
      // Clear old shapes
      ltfChartInstance.current.removeShape();
      htfChartInstance.current?.removeShape();

      trades.forEach(t => {
          // 1. Entry/TP/SL Lines for Open Trades
          if (t.status === 'OPEN') {
             const shapes = [
                { id: `entry_${t.id}`, name: 'horizontalStraightLine', points: [{ timestamp: t.entryTime, value: t.entryPrice }], styles: { line: { color: 'rgba(250, 204, 21, 0.6)', style: 'dashed', dashValue: [6, 4], size: 1 } }, lock: true },
                { id: `tp_${t.id}`, name: 'horizontalStraightLine', points: [{ timestamp: t.entryTime, value: t.tp }], styles: { line: { color: 'rgba(46, 189, 133, 0.5)', style: 'dashed', dashValue: [6, 4], size: 1 } }, lock: true },
                { id: `sl_${t.id}`, name: 'horizontalStraightLine', points: [{ timestamp: t.entryTime, value: t.sl }], styles: { line: { color: 'rgba(246, 70, 93, 0.5)', style: 'dashed', dashValue: [6, 4], size: 1 } }, lock: true }
             ];
             shapes.forEach(s => {
                 // @ts-ignore
                 ltfChartInstance.current?.createShape(s);
                 // @ts-ignore
                 htfChartInstance.current?.createShape(s);
             });
          } 
          // 2. Exit Markers for Closed Trades
          else if (t.exitPrice && t.exitTime) {
              const exitEmoji = t.pnl > 0 ? '💰' : '💸';
              const offsetPrice = t.pnl > 0 ? t.exitPrice * 1.005 : t.exitPrice * 0.995;
              const exitShape = {
                name: 'text',
                id: `exit_marker_${t.id}`,
                points: [{ timestamp: t.exitTime, value: offsetPrice }],
                styles: { text: { color: '#FFFFFF', size: 24 } },
                data: exitEmoji,
                lock: true,
                zLevel: 'top'
              };
              // @ts-ignore
              ltfChartInstance.current?.createShape(exitShape);
          }
      });
  }, [trades]);

  return (
    <div className="flex-1 flex flex-col relative min-w-0 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
        {/* Back to Live Button (Overlay) */}
        {isReviewingHistory && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4">
                <button 
                    onClick={onBackToLive}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold shadow-xl shadow-blue-900/40 transition-all active:scale-95 border-2 border-blue-400/50"
                >
                    <FastForward size={16} fill="currentColor" />
                    回到当前 (Resume)
                </button>
            </div>
        )}

        {/* HTF Chart */}
        <div className="h-1/2 w-full border-b-2 border-gray-200 dark:border-gray-800 relative group">
             <div ref={htfChartRef} className="w-full h-full relative z-10" />
             <div className="absolute inset-0 flex items-start justify-center pt-16 pointer-events-none z-0">
                 <span className="text-4xl md:text-6xl font-bold text-gray-200 dark:text-gray-600/30 select-none">
                    CONTEXT · {session && getHigherTimeframe(session.timeframe)}
                 </span>
             </div>
        </div>
        {/* LTF Chart */}
        <div className="h-1/2 w-full relative group">
             <div ref={ltfChartRef} className="w-full h-full relative z-10" />
             <div className="absolute inset-0 flex items-start justify-center pt-16 pointer-events-none z-0">
                 <span className="text-4xl md:text-6xl font-bold text-gray-200 dark:text-gray-600/30 select-none">
                    {session && session.symbol} · {session && session.timeframe}
                 </span>
             </div>
        </div>
    </div>
  );
});

export default GameCharts;