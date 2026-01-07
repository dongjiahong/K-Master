import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import { init, dispose, Chart, ActionType, LineType } from "klinecharts";
import { KLineData, Timeframe, GameSession, Trade } from "../types";
import { getHigherTimeframe } from "../services/binanceService";
import { FastForward } from "lucide-react";

interface GameChartsProps {
  theme: "dark" | "light";
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
}

const GameCharts = forwardRef<GameChartsRef, GameChartsProps>(
  (
    {
      theme,
      session,
      ltfData,
      htfData,
      currentHtfCandle,
      trades,
      isReviewingHistory,
      onBackToLive,
      onCandleClick,
    },
    ref
  ) => {
    const ltfChartRef = useRef<HTMLDivElement>(null);
    const htfChartRef = useRef<HTMLDivElement>(null);
    const ltfChartInstance = useRef<Chart | null>(null);
    const htfChartInstance = useRef<Chart | null>(null);

    // Expose methods
    useImperativeHandle(ref, () => ({
      resize: () => {
        ltfChartInstance.current?.resize();
        htfChartInstance.current?.resize();
      },
    }));

    // Init Charts
    useEffect(() => {
      if (ltfChartRef.current && htfChartRef.current) {
        if (ltfChartInstance.current) dispose(ltfChartRef.current);
        if (htfChartInstance.current) dispose(htfChartRef.current);

        // v9: 使用 init 函数初始化图表
        ltfChartInstance.current = init(ltfChartRef.current);
        htfChartInstance.current = init(htfChartRef.current);

        // v9: 使用 createIndicator 替代 createTechnicalIndicator
        ltfChartInstance.current?.createIndicator("VOL", false, {
          id: "pane_vol",
        });
        htfChartInstance.current?.createIndicator("VOL", false, {
          id: "pane_vol_htf",
        });

        // v9: 启用 Y 轴缩放 - 通过 setPaneOptions 配置
        ltfChartInstance.current?.setPaneOptions({
          id: "candle_pane",
          axisOptions: {
            scrollZoomEnabled: true, // 启用 Y 轴滚动缩放
          },
        });
        htfChartInstance.current?.setPaneOptions({
          id: "candle_pane",
          axisOptions: {
            scrollZoomEnabled: true,
          },
        });

        // Click listener - v9 使用 subscribeAction
        ltfChartInstance.current?.subscribeAction(
          ActionType.OnCandleBarClick,
          (params: any) => {
            const data = params.data || params;
            if (data?.timestamp) onCandleClick(data.timestamp);
          }
        );

        // v9: X 轴缩放和滚动默认启用
        ltfChartInstance.current?.setZoomEnabled(true);
        ltfChartInstance.current?.setScrollEnabled(true);
        htfChartInstance.current?.setZoomEnabled(true);
        htfChartInstance.current?.setScrollEnabled(true);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount to create instances

    // Update Styles
    useEffect(() => {
      const chartBg = theme === "dark" ? "#111827" : "#ffffff";
      const chartText = theme === "dark" ? "#9CA3AF" : "#4b5563";
      const chartBorder = theme === "dark" ? "#374151" : "#e5e7eb";
      const chartGrid = theme === "dark" ? "#1f2937" : "#f3f4f6";

      const styles = {
        grid: {
          show: false,
          horizontal: { color: chartGrid },
          vertical: { color: chartGrid },
        },
        candle: {
          bar: {
            upColor: "#2ebd85",
            downColor: "#f6465d",
            noChangeColor: "#888888",
          },
          priceMark: {
            show: true,
            high: { show: true, color: chartText },
            low: { show: true, color: chartText },
            last: {
              show: true,
              upColor: "#2ebd85",
              downColor: "#f6465d",
              noChangeColor: "#888888",
            },
          },
        },
        crosshair: {
          show: true,
          horizontal: {
            show: true,
            line: { show: true, style: LineType.Dashed, color: chartBorder },
            text: { show: true, color: "#ffffff", backgroundColor: "#374151" },
          },
          vertical: {
            show: true,
            line: { show: true, style: LineType.Dashed, color: chartBorder },
            text: { show: true, color: "#ffffff", backgroundColor: "#374151" },
          },
        },
        separator: { size: 1, color: chartBorder },
        yAxis: {
          show: true,
          inside: false,
          axisLine: { show: true, color: chartBorder },
          tickText: { show: true, color: chartText },
          tickLine: { show: true, color: chartBorder },
        },
        xAxis: {
          show: true,
          axisLine: { show: true, color: chartBorder },
          tickText: { show: true, color: chartText },
          tickLine: { show: true, color: chartBorder },
        },
      };

      // v9: 使用 setStyles 替代 setStyleOptions
      ltfChartInstance.current?.setStyles(styles);
      htfChartInstance.current?.setStyles(styles);

      // 设置背景色 - 通过样式选项
      const bgStyles = {
        grid: {
          show: false,
        },
      };
      ltfChartInstance.current?.setStyles(bgStyles);
      htfChartInstance.current?.setStyles(bgStyles);
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
      if (ltfChartInstance.current) {
        ltfChartInstance.current.applyNewData(ltfData);
      }

      if (htfChartInstance.current) {
        // Combine history HTF with current partial HTF
        const dataToRender = [...htfData];
        if (currentHtfCandle) {
          const lastHistory = dataToRender[dataToRender.length - 1];
          if (
            lastHistory &&
            lastHistory.timestamp === currentHtfCandle.timestamp
          ) {
            dataToRender[dataToRender.length - 1] = currentHtfCandle;
          } else {
            dataToRender.push(currentHtfCandle);
          }
        }
        htfChartInstance.current.applyNewData(dataToRender);
      }
    }, [ltfData, htfData, currentHtfCandle]);

    // Draw Markers - v9: 使用 createOverlay 替代 createShape
    useEffect(() => {
      if (!ltfChartInstance.current) return;

      // v9: 使用 removeOverlay 清除所有覆盖物
      ltfChartInstance.current.removeOverlay();
      htfChartInstance.current?.removeOverlay();

      trades.forEach((t) => {
        // 1. Entry marker and lines for OPEN Trades
        if (t.status === "OPEN") {
          // 入场点标记 - 使用红绿圆球区分多空
          const entryArrowOverlay = {
            name: "simpleAnnotation",
            id: `entry_arrow_${t.id}`,
            points: [{ timestamp: t.entryTime, value: t.entryPrice }],
            styles: {
              symbol: {
                type: "circle",
                color: t.direction === "LONG" ? "#2ebd85" : "#f6465d",
                size: 12,
              },
            },
            lock: true,
          };
          ltfChartInstance.current?.createOverlay(entryArrowOverlay);
          htfChartInstance.current?.createOverlay(entryArrowOverlay);

          // 水平线
          const overlays = [
            {
              id: `entry_${t.id}`,
              name: "horizontalStraightLine",
              points: [{ timestamp: t.entryTime, value: t.entryPrice }],
              styles: {
                line: {
                  color: "rgba(250, 204, 21, 0.6)",
                  style: LineType.Dashed,
                  dashedValue: [6, 4],
                  size: 1,
                },
              },
              lock: true,
            },
            {
              id: `tp_${t.id}`,
              name: "horizontalStraightLine",
              points: [{ timestamp: t.entryTime, value: t.tp }],
              styles: {
                line: {
                  color: "rgba(46, 189, 133, 0.5)",
                  style: LineType.Dashed,
                  dashedValue: [6, 4],
                  size: 1,
                },
              },
              lock: true,
            },
            {
              id: `sl_${t.id}`,
              name: "horizontalStraightLine",
              points: [{ timestamp: t.entryTime, value: t.sl }],
              styles: {
                line: {
                  color: "rgba(246, 70, 93, 0.5)",
                  style: LineType.Dashed,
                  dashedValue: [6, 4],
                  size: 1,
                },
              },
              lock: true,
            },
          ];
          overlays.forEach((o) => {
            ltfChartInstance.current?.createOverlay(o);
            htfChartInstance.current?.createOverlay(o);
          });
        }
        // 2. Entry + Exit Markers for Closed Trades
        else if (t.exitPrice && t.exitTime) {
          // 入场点标记（已关闭的交易）- 使用红绿圆球区分多空
          const closedEntryArrow = {
            name: "simpleAnnotation",
            id: `closed_entry_arrow_${t.id}`,
            points: [{ timestamp: t.entryTime, value: t.entryPrice }],
            styles: {
              symbol: {
                type: "circle",
                color:
                  t.direction === "LONG"
                    ? "rgba(46, 189, 133, 0.6)"
                    : "rgba(246, 70, 93, 0.6)",
                size: 10,
              },
            },
            lock: true,
          };
          ltfChartInstance.current?.createOverlay(closedEntryArrow);

          // 退出点标记
          const exitColor = t.pnl > 0 ? "#2ebd85" : "#f6465d";
          const exitSymbol = t.pnl > 0 ? "circle" : "rect";
          const exitOverlay = {
            name: "simpleAnnotation",
            id: `exit_marker_${t.id}`,
            points: [{ timestamp: t.exitTime, value: t.exitPrice }],
            styles: {
              symbol: {
                type: exitSymbol,
                color: exitColor,
                size: 10,
              },
            },
            lock: true,
          };
          ltfChartInstance.current?.createOverlay(exitOverlay);

          // 连接入场和退出的连线
          const connectionLine = {
            name: "segment",
            id: `connection_${t.id}`,
            points: [
              { timestamp: t.entryTime, value: t.entryPrice },
              { timestamp: t.exitTime, value: t.exitPrice },
            ],
            styles: {
              line: {
                color:
                  t.pnl > 0
                    ? "rgba(46, 189, 133, 0.3)"
                    : "rgba(246, 70, 93, 0.3)",
                style: LineType.Dashed,
                dashedValue: [4, 4],
                size: 1,
              },
            },
            lock: true,
          };
          ltfChartInstance.current?.createOverlay(connectionLine);
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
  }
);

export default GameCharts;
