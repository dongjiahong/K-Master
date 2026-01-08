import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import { init, dispose, Chart, ActionType, LineType, registerOverlay, OverlayTemplate } from "klinecharts";
import { KLineData, GameSession, Trade, PendingOrder } from "../types";
import { getHigherTimeframe } from "../services/binanceService";
import { FastForward } from "lucide-react";

// 自定义三角形标记 overlay - 在 K 线最高点上方画小三角形，用虚线连接
const triangleMarker: OverlayTemplate = {
  name: 'triangleMarker',
  totalStep: 2,
  createPointFigures: ({ overlay, coordinates }) => {
    const color = (overlay.extendData as { color?: string })?.color || '#2ebd85';
    const size = (overlay.extendData as { size?: number })?.size || 18;
    
    if (coordinates.length < 1) return [];
    
    const x = coordinates[0].x;
    const y = coordinates[0].y;
    
    // 三角形顶点在价格点上方更远的位置
    const offset = 40;  // 三角形距离 K 线顶部的距离
    const tipY = y - offset;  
    const halfWidth = size / 2;
    
    return [
      // 虚线连接 K 线最高点和三角形
      {
        type: 'line',
        attrs: {
          coordinates: [
            { x: x, y: y },
            { x: x, y: tipY + size }
          ]
        },
        styles: {
          style: 'dashed',
          color: color,
          size: 1,
          dashedValue: [3, 3]
        },
        ignoreEvent: true,
      },
      // 向下的实心三角形
      {
        type: 'polygon',
        attrs: {
          coordinates: [
            { x: x, y: tipY + size },           // 底部顶点（指向K线）
            { x: x - halfWidth, y: tipY },      // 左上角
            { x: x + halfWidth, y: tipY },      // 右上角
          ]
        },
        styles: {
          style: 'fill',
          color: color,
        },
        ignoreEvent: true,
      }
    ];
  }
};

// 自定义圆形标记 overlay - 用于标记持仓状态的入场点
const circleMarker: OverlayTemplate = {
  name: 'circleMarker',
  totalStep: 2,
  createPointFigures: ({ overlay, coordinates }) => {
    const color = (overlay.extendData as { color?: string })?.color || '#2ebd85';
    const size = (overlay.extendData as { size?: number })?.size || 14;
    
    if (coordinates.length < 1) return [];
    
    const x = coordinates[0].x;
    const y = coordinates[0].y;
    
    // 圆形在价格点上方
    const offset = 35;
    const circleY = y - offset;
    
    return [
      // 虚线连接 K 线最高点和圆形
      {
        type: 'line',
        attrs: {
          coordinates: [
            { x: x, y: y },
            { x: x, y: circleY + size / 2 }
          ]
        },
        styles: {
          style: 'dashed',
          color: color,
          size: 1,
          dashedValue: [3, 3]
        },
        ignoreEvent: true,
      },
      // 实心圆形
      {
        type: 'circle',
        attrs: {
          x: x,
          y: circleY,
          r: size / 2,
        },
        styles: {
          style: 'fill',
          color: color,
        },
        ignoreEvent: true,
      }
    ];
  }
};

// 注册自定义 overlay
registerOverlay(triangleMarker);
registerOverlay(circleMarker);

interface GameChartsProps {
  theme: "dark" | "light";
  session: GameSession | null;
  ltfData: KLineData[];
  htfData: KLineData[];
  currentHtfCandle: KLineData | null;
  trades: Trade[]; // To redraw markers
  pendingOrders?: PendingOrder[];  // 挂单列表
  isReviewingHistory: boolean;
  onBackToLive: () => void;
  onCandleClick: (timestamp: number) => void;
  // 预览止盈止损价格（下单面板中实时输入）
  previewPrices?: { tp: number | null; sl: number | null; direction: 'LONG' | 'SHORT'; entryPrice?: number | null } | null;
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
      pendingOrders = [],
      isReviewingHistory,
      onBackToLive,
      onCandleClick,
      previewPrices,
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

    // 跟踪当前 session ID，用于检测是否是新游戏
    const lastSessionIdRef = useRef<number | undefined>(undefined);

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

      // 检测是否是新游戏开始（session ID 变化），如果是则重置视口到最新位置
      const currentSessionId = session?.id;
      if (currentSessionId !== lastSessionIdRef.current) {
        lastSessionIdRef.current = currentSessionId;
        // 延迟执行以确保数据已经渲染
        setTimeout(() => {
          if (ltfData.length > 0 && ltfChartInstance.current) {
            // 滚动到最新数据位置
            ltfChartInstance.current.scrollToDataIndex(ltfData.length - 1);
          }
          if (htfData.length > 0 && htfChartInstance.current) {
            const htfTotalLength = htfData.length + (currentHtfCandle ? 1 : 0);
            htfChartInstance.current.scrollToDataIndex(htfTotalLength - 1);
          }
        }, 50);
      }
    }, [ltfData, htfData, currentHtfCandle, session]);

    // Draw Markers - v9: 使用 createOverlay 替代 createShape
    useEffect(() => {
      if (!ltfChartInstance.current) return;

      // v9: 使用 removeOverlay 清除所有覆盖物
      ltfChartInstance.current.removeOverlay();
      htfChartInstance.current?.removeOverlay();

      // 绘制预览止盈止损线（下单面板中实时输入时显示）
      if (previewPrices && ltfData.length > 0) {
        const currentTime = ltfData[ltfData.length - 1].timestamp;
        
        // 限价入场价预览线
        if (previewPrices.entryPrice) {
          const entryOverlay = {
            id: 'preview_entry',
            name: 'horizontalStraightLine',
            points: [{ timestamp: currentTime, value: previewPrices.entryPrice }],
            styles: {
              line: {
                color: 'rgba(251, 191, 36, 0.8)', // amber
                style: LineType.Dashed,
                dashedValue: [8, 4],
                size: 2,
              },
            },
            lock: true,
          };
          ltfChartInstance.current?.createOverlay(entryOverlay);
          htfChartInstance.current?.createOverlay(entryOverlay);
        }
        
        if (previewPrices.tp) {
          const tpOverlay = {
            id: 'preview_tp',
            name: 'horizontalStraightLine',
            points: [{ timestamp: currentTime, value: previewPrices.tp }],
            styles: {
              line: {
                color: 'rgba(46, 189, 133, 0.7)',
                style: LineType.Dashed,
                dashedValue: [6, 4],
                size: 1.5,
              },
            },
            lock: true,
          };
          ltfChartInstance.current?.createOverlay(tpOverlay);
          htfChartInstance.current?.createOverlay(tpOverlay);
        }
        
        if (previewPrices.sl) {
          const slOverlay = {
            id: 'preview_sl',
            name: 'horizontalStraightLine',
            points: [{ timestamp: currentTime, value: previewPrices.sl }],
            styles: {
              line: {
                color: 'rgba(246, 70, 93, 0.7)',
                style: LineType.Dashed,
                dashedValue: [6, 4],
                size: 1.5,
              },
            },
            lock: true,
          };
          ltfChartInstance.current?.createOverlay(slOverlay);
          htfChartInstance.current?.createOverlay(slOverlay);
        }
      }

      trades.forEach((t) => {
        // 查找入场 K 线
        const entryCandle = ltfData.find(c => c.timestamp === t.entryTime);
        
        // 1. Entry marker and lines for OPEN Trades
        if (t.status === "OPEN") {
          // 入场点标记 - 持仓用圆形标记
          if (entryCandle) {
            const entryMarker = {
              name: "circleMarker",
              id: `entry_marker_${t.id}`,
              points: [{ timestamp: t.entryTime, value: entryCandle.high }],
              extendData: {
                color: t.direction === "LONG" ? "#2ebd85" : "#f6465d",
                size: 14,
              },
              lock: true,
            };
            ltfChartInstance.current?.createOverlay(entryMarker);
          }

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
          // 入场点标记（已关闭的交易）- 在 K 线最高点上方画较小的三角形
          if (entryCandle) {
            const closedEntryMarker = {
              name: "triangleMarker",
              id: `closed_entry_marker_${t.id}`,
              points: [{ timestamp: t.entryTime, value: entryCandle.high }],
              extendData: {
                color: t.direction === "LONG" ? "rgba(46, 189, 133, 0.6)" : "rgba(246, 70, 93, 0.6)",
                size: 14,
              },
              lock: true,
            };
            ltfChartInstance.current?.createOverlay(closedEntryMarker);
          }

          // 退出点标记 - 在出场 K 线最高点上方画三角形
          const exitCandle = ltfData.find(c => c.timestamp === t.exitTime);
          if (exitCandle) {
            const exitColor = t.pnl > 0 ? "#2ebd85" : "#f6465d";
            const exitMarker = {
              name: "triangleMarker",
              id: `exit_marker_${t.id}`,
              points: [{ timestamp: t.exitTime, value: exitCandle.high }],
              extendData: {
                color: exitColor,
                size: 14,
              },
              lock: true,
            };
            ltfChartInstance.current?.createOverlay(exitMarker);
          }

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
                    ? "rgba(46, 189, 133, 0.6)"
                    : "rgba(246, 70, 93, 0.6)",
                style: LineType.Dashed,
                dashedValue: [4, 4],
                size: 1.5,
              },
            },
            lock: true,
          };
          ltfChartInstance.current?.createOverlay(connectionLine);
        }
      });

      // 绘制挂单价格线（待触发的限价单）
      pendingOrders.filter(o => o.status === 'PENDING').forEach((order) => {
        if (ltfData.length === 0) return;
        const currentTime = ltfData[ltfData.length - 1].timestamp;
        
        // 入场触发价格线（橙色虚线）
        const pendingEntryOverlay = {
          id: `pending_entry_${order.id}`,
          name: 'horizontalStraightLine',
          points: [{ timestamp: currentTime, value: order.triggerPrice }],
          styles: {
            line: {
              color: order.direction === 'LONG' ? 'rgba(251, 191, 36, 0.8)' : 'rgba(251, 146, 60, 0.8)',
              style: LineType.Dashed,
              dashedValue: [8, 4],
              size: 2,
            },
          },
          lock: true,
        };
        ltfChartInstance.current?.createOverlay(pendingEntryOverlay);
        htfChartInstance.current?.createOverlay(pendingEntryOverlay);
        
        // 止盈线（绿色虚线，较淡）
        const pendingTpOverlay = {
          id: `pending_tp_${order.id}`,
          name: 'horizontalStraightLine',
          points: [{ timestamp: currentTime, value: order.tp }],
          styles: {
            line: {
              color: 'rgba(46, 189, 133, 0.4)',
              style: LineType.Dashed,
              dashedValue: [4, 4],
              size: 1,
            },
          },
          lock: true,
        };
        ltfChartInstance.current?.createOverlay(pendingTpOverlay);
        htfChartInstance.current?.createOverlay(pendingTpOverlay);
        
        // 止损线（红色虚线，较淡）
        const pendingSlOverlay = {
          id: `pending_sl_${order.id}`,
          name: 'horizontalStraightLine',
          points: [{ timestamp: currentTime, value: order.sl }],
          styles: {
            line: {
              color: 'rgba(246, 70, 93, 0.4)',
              style: LineType.Dashed,
              dashedValue: [4, 4],
              size: 1,
            },
          },
          lock: true,
        };
        ltfChartInstance.current?.createOverlay(pendingSlOverlay);
        htfChartInstance.current?.createOverlay(pendingSlOverlay);
      });
    }, [trades, pendingOrders, previewPrices, ltfData]);

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
