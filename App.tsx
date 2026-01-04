import React, { useState, useEffect, useRef, useCallback } from 'react';
// Use wildcard import to handle potential CJS/ESM interop issues with esm.sh
import * as klinechartsModule from 'klinecharts';
import type { Chart, Nullable, KLineData as ChartKLineData } from 'klinecharts';
import { 
  Play, Pause, ChevronRight, TrendingUp, TrendingDown, 
  Settings, History, RefreshCw, X, Zap, StopCircle, Trophy, BarChart2, Calendar,
  FastForward, RotateCcw, Brain, Sparkles
} from 'lucide-react';

import { KLineData, Timeframe, Trade, GameSession } from './types';
import { getHigherTimeframe, fetchMarketData, timeframeToMs, generateRandomMarketEndTime } from './services/binanceService';
import { analyzeTrade, generateGameReport } from './services/geminiService';
import { db } from './db';

import TradePanel from './components/TradePanel';
import GameHistoryPanel from './components/GameHistoryPanel';
import DashboardPanel from './components/DashboardPanel';
import SettingsPanel from './components/SettingsModal';
import SessionRestoreModal from './components/SessionRestoreModal';
import ConfirmDialog from './components/ConfirmDialog';

// Workaround for klinecharts import structure on some CDNs
const klinecharts = (klinechartsModule as any).default || klinechartsModule;

// Constants
const INITIAL_BALANCE = 10000;
const PRELOAD_COUNT = 200; // Visible candles at start
const SUPPORTED_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT', 'XRPUSDT'];
const SUPPORTED_TIMEFRAMES = [Timeframe.M5, Timeframe.M15, Timeframe.M30, Timeframe.H1, Timeframe.H4, Timeframe.D1];

type SidebarView = 'DASHBOARD' | 'TRADE_PANEL' | 'HISTORY_PANEL' | 'SETTINGS';

const App: React.FC = () => {
  // --- State ---
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [session, setSession] = useState<GameSession | null>(null);
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  
  // Settings State
  const [configSymbol, setConfigSymbol] = useState('BTCUSDT');
  const [configTimeframe, setConfigTimeframe] = useState<Timeframe>(Timeframe.M5);
  
  const [allCandles, setAllCandles] = useState<KLineData[]>([]);
  
  const [currentIndex, setCurrentIndex] = useState(0); 
  const [activeTrade, setActiveTrade] = useState<Trade | null>(null);
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoPlaySpeed, setAutoPlaySpeed] = useState(1000); 
  
  // UI Panels / Sidebar
  const [sidebarView, setSidebarView] = useState<SidebarView>('DASHBOARD');
  // Default to 1/3 of screen width, bounded reasonable min/max
  const [historyPanelWidth, setHistoryPanelWidth] = useState(() => {
      if (typeof window !== 'undefined') {
          return Math.max(350, Math.min(800, window.innerWidth / 3));
      }
      return 400;
  });
  const [isResizingHistory, setIsResizingHistory] = useState(false);
  
  // Trade Panel Specifics
  const [modalDirection, setModalDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [viewingTrade, setViewingTrade] = useState<Trade | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false); // For End Game AI Animation

  const [finalReport, setFinalReport] = useState<string | null>(null);
  const [comparisonStats, setComparisonStats] = useState<any[]>([]); // For End Game Comparison
  
  const [customPrompt, setCustomPrompt] = useState<string>('');
  
  // Restore Modal
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [pendingRestoreSession, setPendingRestoreSession] = useState<GameSession | null>(null);
  
  // History Data
  const [pastSessions, setPastSessions] = useState<GameSession[]>([]);
  const [pastTrades, setPastTrades] = useState<Record<number, Trade[]>>({});
  
  // Custom Confirm Dialog State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Review Mode State
  const [isReviewingHistory, setIsReviewingHistory] = useState(false);

  // --- Refs ---
  const ltfChartRef = useRef<HTMLDivElement>(null); 
  const htfChartRef = useRef<HTMLDivElement>(null); 
  const ltfChartInstance = useRef<any>(null);
  const htfChartInstance = useRef<any>(null);
  const playTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const tradeHistoryRef = useRef<Trade[]>([]);
  
  // Data State Refs for Rewind Capability
  const allHtfCandlesRef = useRef<KLineData[]>([]);
  const lastPlayedIndexRef = useRef<number>(0);

  // Sync ref
  useEffect(() => {
    tradeHistoryRef.current = tradeHistory;
  }, [tradeHistory]);

  // --- Theme Effect ---
  useEffect(() => {
      const root = document.documentElement;
      if (theme === 'dark') {
          root.classList.add('dark');
      } else {
          root.classList.remove('dark');
      }

      // Update Chart Styles dynamically
      const chartBg = theme === 'dark' ? '#111827' : '#ffffff';
      const chartText = theme === 'dark' ? '#9CA3AF' : '#4b5563';
      const chartBorder = theme === 'dark' ? '#374151' : '#e5e7eb';
      const chartGrid = theme === 'dark' ? '#1f2937' : '#f3f4f6';

      const styles = {
        grid: { show: false, horizontal: { color: chartGrid }, vertical: { color: chartGrid } },
        layout: { backgroundColor: chartBg, textColor: chartText },
        crosshair: { horizontal: { text: { color: '#ffffff' } }, vertical: { text: { color: '#ffffff' } } },
        separator: { size: 1, color: chartBorder },
        yAxis: { 
            inside: false,
            axisLine: { show: true, color: chartBorder }, 
            tickText: { show: true, color: chartText }
        }
      };

      ltfChartInstance.current?.setStyleOptions(styles);
      htfChartInstance.current?.setStyleOptions(styles);
  }, [theme]);
  
  // --- Resize Observer Effect ---
  useEffect(() => {
      const resizeObserver = new ResizeObserver(() => {
          if (ltfChartInstance.current) ltfChartInstance.current.resize();
          if (htfChartInstance.current) htfChartInstance.current.resize();
      });

      if (ltfChartRef.current) resizeObserver.observe(ltfChartRef.current);
      if (htfChartRef.current) resizeObserver.observe(htfChartRef.current);

      return () => {
          resizeObserver.disconnect();
      };
  }, []);

  // --- Sidebar Resizing Logic (RIGHT SIDEBAR) ---
  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (isResizingHistory) {
              // Right Sidebar: Width is Window Width - Mouse X
              const newWidth = Math.max(250, Math.min(800, window.innerWidth - e.clientX));
              setHistoryPanelWidth(newWidth);
          }
      };
      const handleMouseUp = () => {
          setIsResizingHistory(false);
          document.body.style.cursor = 'auto';
          // Trigger resize on charts after layout change
          setTimeout(() => {
              ltfChartInstance.current?.resize();
              htfChartInstance.current?.resize();
          }, 50);
      };

      if (isResizingHistory) {
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
          document.body.style.cursor = 'col-resize';
      }

      return () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
      };
  }, [isResizingHistory]);

  // --- 1. Startup Logic: Check for Active Session ---
  useEffect(() => {
    const checkActiveSession = async () => {
        const active = await db.games.where({ status: 'ACTIVE' }).first();
        if (active) {
            setPendingRestoreSession(active);
            setShowRestoreModal(true);
        } else {
            startNewGame();
        }
    };
    checkActiveSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Helper: Dynamic HTF Update with State Management ---
  const updateHtfWithLtf = useCallback((ltfCandle: KLineData, htfTf: Timeframe) => {
    // This function now just updates the REF array. The Chart update happens via applyNewData/updateData
    const htfMs = timeframeToMs(htfTf);
    const htfStartTime = Math.floor(ltfCandle.timestamp / htfMs) * htfMs;
    
    const htfList = allHtfCandlesRef.current;
    const lastHtf = htfList.length > 0 ? htfList[htfList.length - 1] : null;

    if (lastHtf && lastHtf.timestamp === htfStartTime) {
        // Update existing candle
        const updatedCandle: KLineData = {
            ...lastHtf,
            high: Math.max(lastHtf.high, ltfCandle.high),
            low: Math.min(lastHtf.low, ltfCandle.low),
            close: ltfCandle.close,
            volume: lastHtf.volume + ltfCandle.volume 
        };
        htfList[htfList.length - 1] = updatedCandle;
        htfChartInstance.current?.updateData(updatedCandle);
    } else {
        // New candle
        const newHtf: KLineData = {
            timestamp: htfStartTime,
            open: ltfCandle.open,
            high: ltfCandle.high,
            low: ltfCandle.low,
            close: ltfCandle.close,
            volume: ltfCandle.volume,
            turnover: ltfCandle.turnover
        };
        htfList.push(newHtf);
        htfChartInstance.current?.updateData(newHtf);
    }
  }, []);

  // --- Helpers for Confirm Dialog ---
  const openConfirm = (title: string, message: string, action: () => void) => {
    setConfirmConfig({ isOpen: true, title, message, onConfirm: action });
  };
  
  const closeConfirm = () => {
    setConfirmConfig(prev => ({ ...prev, isOpen: false }));
  };
  
  const handleConfirmAction = () => {
    confirmConfig.onConfirm();
    closeConfirm();
  };

  // --- Game State Management ---

  const startNewGame = async (
    replayConfig?: { symbol: string, timeframe: Timeframe, marketEndTime: number, parentId?: number },
    resumeSession?: GameSession
  ) => {
    setLoading(true);
    setFinalReport(null);
    setComparisonStats([]);
    setViewingTrade(null);
    setActiveTrade(null);
    setIsPlaying(false);
    setIsReviewingHistory(false);
    setTradeHistory([]); // Clear local state first
    setSidebarView('DASHBOARD'); // Reset View
    allHtfCandlesRef.current = []; // Reset HTF store

    let sessionToUse: GameSession;
    let dataEndTime: number;

    // 1. Determine Session Parameters
    if (resumeSession) {
        sessionToUse = resumeSession;
        dataEndTime = resumeSession.marketEndTime;
        setBalance(resumeSession.initialBalance);
        if (resumeSession.aiReport) setFinalReport(resumeSession.aiReport);
    } else {
        const symbol = replayConfig ? replayConfig.symbol : configSymbol;
        const tf = replayConfig ? replayConfig.timeframe : configTimeframe;
        dataEndTime = replayConfig ? replayConfig.marketEndTime : generateRandomMarketEndTime();
        
        const newSession: GameSession = {
            startTime: Date.now(),
            symbol,
            timeframe: tf,
            marketEndTime: dataEndTime,
            initialBalance: INITIAL_BALANCE,
            status: 'ACTIVE',
            parentSessionId: replayConfig?.parentId
        };

        const id = await db.games.add(newSession);
        sessionToUse = { ...newSession, id: id as number };
        setBalance(INITIAL_BALANCE);
    }

    setSession(sessionToUse);

    // 2. Fetch Data
    const tf = sessionToUse.timeframe;
    const htf = getHigherTimeframe(tf);
    
    const rawData = await fetchMarketData(sessionToUse.symbol, tf, 1000, dataEndTime);
    
    if (rawData.length < PRELOAD_COUNT) {
      alert("数据获取失败，请重试");
      setLoading(false);
      return;
    }

    setAllCandles(rawData);
    
    // 3. Restore State
    let startIndex = PRELOAD_COUNT;
    let existingTrades: Trade[] = [];

    if (resumeSession) {
        existingTrades = await db.trades.where('gameId').equals(resumeSession.id!).toArray();
        setTradeHistory(existingTrades);
        
        const pnl = existingTrades.reduce((acc, t) => acc + t.pnl, 0);
        setBalance(resumeSession.initialBalance + pnl);
        
        if (existingTrades.length > 0) {
            const lastTradeTime = Math.max(...existingTrades.map(t => t.exitTime || t.entryTime));
            const foundIndex = rawData.findIndex(c => c.timestamp === lastTradeTime);
            if (foundIndex > PRELOAD_COUNT) {
                // If the game was completed, show all candles. If active, show up to last trade + padding
                if (resumeSession.status === 'COMPLETED') {
                    startIndex = rawData.length - 1;
                } else {
                    startIndex = foundIndex + 1;
                }
            }
        }
        
        const openTrade = existingTrades.find(t => t.status === 'OPEN');
        if (openTrade) setActiveTrade(openTrade);
        
        // Load comparison stats for this resumed session context
        loadComparisonStats(sessionToUse);
    }

    setCurrentIndex(startIndex);
    lastPlayedIndexRef.current = startIndex; // Initialize last played

    // 4. Init Charts
    const initialLtfData = rawData.slice(0, startIndex + 1);
    const lastLtfCandle = initialLtfData[initialLtfData.length - 1];
    
    const htfDataRaw = await fetchMarketData(sessionToUse.symbol, htf, 500, rawData[rawData.length-1].timestamp);
    const htfMs = timeframeToMs(htf);
    const currentHtfBlockStart = Math.floor(lastLtfCandle.timestamp / htfMs) * htfMs;
    // Keep historical HTF data
    const historicalHtfData = htfDataRaw.filter(d => d.timestamp < currentHtfBlockStart);
    
    // Store in ref
    allHtfCandlesRef.current = [...historicalHtfData];

    initCharts(initialLtfData, historicalHtfData);

    // Synthesize partial HTF bar and draw trades
    setTimeout(() => {
         const ltfCandlesInCurrentHtfBlock = initialLtfData.filter(c => c.timestamp >= currentHtfBlockStart);
         
         // Replay the "updateHtf" logic to build the current partial bar in the ref and chart
         ltfCandlesInCurrentHtfBlock.forEach(c => {
            updateHtfWithLtf(c, htf);
        });
        
        if (existingTrades.length > 0) {
            existingTrades.forEach(t => {
                if (t.status !== 'OPEN') {
                    drawExecutionMarkers(t);
                } else {
                    drawOpenTradeMarkers(t);
                }
            });
        }
    }, 100);

    setLoading(false);
  };
  
  // New: Load a historical session into the dashboard for review
  const handleLoadSession = async (arg: number | GameSession) => {
      setLoading(true);
      let sessionToLoad: GameSession | undefined;

      if (typeof arg === 'number') {
          sessionToLoad = await db.games.get(arg);
      } else {
          sessionToLoad = arg;
      }
      
      if (!sessionToLoad) {
          setLoading(false);
          return;
      }
      
      // Close history panel if open
      setSidebarView('DASHBOARD');
      
      // Reuse startNewGame logic but treating it as a "Resume" of a completed game
      await startNewGame(undefined, sessionToLoad);
  };

  const handleResume = () => {
      setShowRestoreModal(false);
      if (pendingRestoreSession) {
          startNewGame(undefined, pendingRestoreSession);
      }
  };

  const handleDiscard = async () => {
      if (pendingRestoreSession?.id) {
          await db.games.update(pendingRestoreSession.id, { status: 'COMPLETED' });
      }
      setShowRestoreModal(false);
      setPendingRestoreSession(null);
      startNewGame();
  };

  const handleReplay = (oldSession: GameSession) => {
      setSidebarView('DASHBOARD');
      const parentId = oldSession.parentSessionId || oldSession.id;
      startNewGame({
          symbol: oldSession.symbol,
          timeframe: oldSession.timeframe,
          marketEndTime: oldSession.marketEndTime,
          parentId: parentId
      });
  };

  const handleDeleteHistory = async (sessionsToDelete: GameSession[]) => {
      // Collect IDs
      const gameIds = sessionsToDelete.map(s => s.id!).filter(Boolean);
      if (gameIds.length === 0) return;

      // Delete Trades
      await db.trades.where('gameId').anyOf(gameIds).delete();
      // Delete Games
      await db.games.where('id').anyOf(gameIds).delete();
      
      // Refresh Data if we are in History View
      if (sidebarView === 'HISTORY_PANEL') {
          loadHistoryAndShowPanel();
      }
  };

  const loadComparisonStats = async (currentSession: GameSession) => {
    const siblings = await db.games
        .where('marketEndTime').equals(currentSession.marketEndTime)
        .and(g => g.symbol === currentSession.symbol && g.timeframe === currentSession.timeframe && g.status === 'COMPLETED')
        .toArray();

    const statsPromises = siblings.map(async (g) => {
        const trades = await db.trades.where('gameId').equals(g.id!).toArray();
        const wins = trades.filter(t => t.pnl > 0).length;
        const totalPnl = trades.reduce((acc, t) => acc + t.pnl, 0);
        return {
            id: g.id,
            date: g.startTime,
            pnl: totalPnl,
            winRate: trades.length ? (wins/trades.length)*100 : 0,
            isCurrent: g.id === currentSession.id
        };
    });
    
    let stats = await Promise.all(statsPromises);
    
    // If the current session is not in the list (e.g. it's active), add it manually for comparison
    if (!stats.find(s => s.id === currentSession.id)) {
         const currentTrades = await db.trades.where('gameId').equals(currentSession.id!).toArray();
         const currentPnl = currentTrades.reduce((acc,t) => acc+t.pnl, 0);
         stats.push({
             id: currentSession.id,
             date: currentSession.startTime,
             pnl: currentPnl,
             winRate: 0,
             isCurrent: true
         });
    } else {
        // Mark the current loaded session
        stats = stats.map(s => ({ ...s, isCurrent: s.id === currentSession.id }));
    }
    
    setComparisonStats(stats.sort((a,b) => b.pnl - a.pnl));
  };

  const handleEndGame = async () => {
    setIsPlaying(false);
    if (!session || !session.id) return;
    
    // Use specialized state for "End Game" to show AI animation in Dashboard
    setIsGeneratingReport(true);

    if (activeTrade) {
        const currentCandle = allCandles[currentIndex];
        await closeTrade(activeTrade, currentCandle.close, 'CLOSED_MANUAL', currentCandle.timestamp);
    }

    // AI Report (might take a moment)
    const report = await generateGameReport(tradeHistoryRef.current);
    setFinalReport(report);

    // Update DB with Completed status AND Report
    await db.games.update(session.id, { 
        status: 'COMPLETED',
        finalBalance: balance,
        endTime: Date.now(),
        aiReport: report
    });
    
    const updatedSession = { ...session, status: 'COMPLETED' as const, aiReport: report };
    setSession(updatedSession);
    
    // Reload comparison to reflect final state
    loadComparisonStats(updatedSession);

    setIsGeneratingReport(false);
    // Ensure we are on dashboard to see summary
    setSidebarView('DASHBOARD');
  };

  // --- Chart & Trade Logic ---

  const initCharts = (ltfData: KLineData[], htfData: KLineData[]) => {
    if (ltfChartRef.current && htfChartRef.current) {
      if (ltfChartInstance.current) klinecharts.dispose(ltfChartRef.current);
      if (htfChartInstance.current) klinecharts.dispose(htfChartRef.current);

      ltfChartInstance.current = klinecharts.init(ltfChartRef.current);
      htfChartInstance.current = klinecharts.init(htfChartRef.current);

      const chartBg = theme === 'dark' ? '#111827' : '#ffffff';
      const chartText = theme === 'dark' ? '#9CA3AF' : '#4b5563';
      const chartBorder = theme === 'dark' ? '#374151' : '#e5e7eb';
      
      const chartStyles = {
        grid: { show: false },
        candle: {
          bar: { upColor: '#2ebd85', downColor: '#f6465d', noChangeColor: '#888888' }
        },
        layout: { backgroundColor: chartBg, textColor: chartText },
        crosshair: { horizontal: { text: { color: '#ffffff' } }, vertical: { text: { color: '#ffffff' } } },
        separator: { size: 1, color: chartBorder },
        yAxis: { 
            inside: false,
            axisLine: { show: true, color: chartBorder }, 
            tickText: { show: true, color: chartText }
        }
      };
      
      ltfChartInstance.current?.setStyleOptions(chartStyles);
      htfChartInstance.current?.setStyleOptions(chartStyles);

      ltfChartInstance.current?.createTechnicalIndicator('VOL');
      htfChartInstance.current?.createTechnicalIndicator('VOL');

      ltfChartInstance.current?.applyNewData(ltfData);
      htfChartInstance.current?.applyNewData(htfData);
      
      // Enable Zooming (X-Axis) and Scrolling
      ltfChartInstance.current?.setZoomEnabled(true);
      ltfChartInstance.current?.setScrollEnabled(true);
      
      htfChartInstance.current?.setZoomEnabled(true);
      htfChartInstance.current?.setScrollEnabled(true);
      
      // Ensure there's space on the right for the axis interaction if needed
      // klinecharts usually handles Y-axis scaling via drag on the axis itself
      
      ltfChartInstance.current?.subscribeAction('onCandleBarClick', (params: any) => {
          const data = params.data || params;
          if (!data || !data.timestamp) return;
          const clickedTime = data.timestamp;
          const foundTrade = tradeHistoryRef.current.find(t => Math.abs(t.entryTime - clickedTime) < 300000); 
          if (foundTrade) {
              handleReviewTrade(foundTrade);
          }
      });
    }
  };

  const nextCandle = useCallback(() => {
    if (isReviewingHistory) return; 

    if (currentIndex >= allCandles.length - 1) {
      handleEndGame(); 
      return;
    }

    const nextIndex = currentIndex + 1;
    const newCandle = allCandles[nextIndex];
    setCurrentIndex(nextIndex);

    ltfChartInstance.current?.updateData(newCandle);

    if (session) {
        const htf = getHigherTimeframe(session.timeframe);
        updateHtfWithLtf(newCandle, htf);
    }

    if (activeTrade) {
      checkTradeStatus(activeTrade, newCandle);
    }
  }, [currentIndex, allCandles, activeTrade, session, updateHtfWithLtf, isReviewingHistory]);

  useEffect(() => {
    if (isPlaying && !isReviewingHistory) {
      playTimer.current = setInterval(nextCandle, autoPlaySpeed);
    } else if (playTimer.current) {
      clearInterval(playTimer.current);
    }
    return () => { if(playTimer.current) clearInterval(playTimer.current); }
  }, [isPlaying, nextCandle, autoPlaySpeed, isReviewingHistory]);

  const removeTradeShapes = () => {
      ['tp_line', 'sl_line', 'entry_line'].forEach(id => {
          ltfChartInstance.current?.removeShape(id);
          htfChartInstance.current?.removeShape(id);
      });
  };

  const checkTradeStatus = (trade: Trade, candle: KLineData) => {
    let closedStatus: Trade['status'] | null = null;
    let exitPrice = 0;

    if (trade.direction === 'LONG') {
      if (candle.low <= trade.sl) {
        closedStatus = 'CLOSED_SL';
        exitPrice = trade.sl;
      } else if (candle.high >= trade.tp) {
        closedStatus = 'CLOSED_TP';
        exitPrice = trade.tp;
      }
    } else {
      if (candle.high >= trade.sl) {
        closedStatus = 'CLOSED_SL';
        exitPrice = trade.sl;
      } else if (candle.low <= trade.tp) {
        closedStatus = 'CLOSED_TP';
        exitPrice = trade.tp;
      }
    }

    if (closedStatus) {
      closeTrade(trade, exitPrice, closedStatus, candle.timestamp);
    }
  };

  const closeTrade = async (trade: Trade, exitPrice: number, status: Trade['status'], exitTime: number) => {
    setIsPlaying(false);

    const pnl = trade.direction === 'LONG' 
      ? (exitPrice - trade.entryPrice) * trade.quantity
      : (trade.entryPrice - exitPrice) * trade.quantity;

    const closedTrade: Trade = {
      ...trade,
      status,
      exitPrice,
      exitTime,
      pnl
    };

    setBalance(prev => prev + pnl);
    setActiveTrade(null);
    setTradeHistory(prev => prev.map(t => t.id === trade.id ? closedTrade : t));
    
    removeTradeShapes();
    drawExecutionMarkers(closedTrade);

    setViewingTrade(closedTrade);
    setSidebarView('TRADE_PANEL');

    await db.trades.put(closedTrade); // Use Put to update or add
  };

  const drawExecutionMarkers = (trade: Trade) => {
      if (!trade.exitPrice || !trade.exitTime) return;
      
      const exitEmoji = trade.pnl > 0 ? '💰' : '💸';
      const offsetPrice = trade.pnl > 0 ? trade.exitPrice * 1.005 : trade.exitPrice * 0.995;

      const exitShape = {
        name: 'text',
        id: `exit_marker_${trade.id}`,
        points: [{ timestamp: trade.exitTime, value: offsetPrice }],
        styles: { text: { color: '#FFFFFF', size: 24, weight: 'bold' } },
        data: exitEmoji,
        lock: true,
        zLevel: 'top'
      };
      // @ts-ignore
      ltfChartInstance.current?.createShape(exitShape);
  };
  
  const drawOpenTradeMarkers = (trade: Trade) => {
      const shapes = [
        {
            id: 'entry_line', name: 'horizontalStraightLine',
            points: [{ timestamp: trade.entryTime, value: trade.entryPrice }],
            styles: { line: { color: 'rgba(250, 204, 21, 0.6)', style: 'dashed', dashValue: [6, 4], size: 1 } }, lock: true
        },
        {
            id: 'tp_line', name: 'horizontalStraightLine',
            points: [{ timestamp: trade.entryTime, value: trade.tp }],
            styles: { line: { color: 'rgba(46, 189, 133, 0.5)', style: 'dashed', dashValue: [6, 4], size: 1 } }, lock: true
        },
        {
            id: 'sl_line', name: 'horizontalStraightLine',
            points: [{ timestamp: trade.entryTime, value: trade.sl }],
            styles: { line: { color: 'rgba(246, 70, 93, 0.5)', style: 'dashed', dashValue: [6, 4], size: 1 } }, lock: true
        }
    ];
    shapes.forEach(s => {
        // @ts-ignore
        ltfChartInstance.current?.createShape(s);
        // @ts-ignore
        htfChartInstance.current?.createShape(s);
    });
  };

  const handleOpenTradeModal = (dir: 'LONG' | 'SHORT') => {
    if (activeTrade) return alert("已有持仓，请先平仓");
    setIsPlaying(false);
    setModalDirection(dir);
    setViewingTrade(null);
    setSidebarView('TRADE_PANEL');
  };

  const executeTrade = async (reason: string, tp: number, sl: number) => {
    const currentCandle = allCandles[currentIndex];
    const price = currentCandle.close;
    const quantity = (balance * 0.5) / price; 

    const newTrade: Trade = {
      id: `trade_${Date.now()}`,
      gameId: session?.id || 0,
      symbol: session?.symbol || 'BTCUSDT',
      direction: modalDirection,
      entryPrice: price,
      tp,
      sl,
      quantity,
      entryTime: currentCandle.timestamp,
      status: 'OPEN',
      pnl: 0,
      reason
    };

    setActiveTrade(newTrade);
    setTradeHistory(prev => [newTrade, ...prev]);

    removeTradeShapes();
    drawOpenTradeMarkers(newTrade);

    // AI Analysis
    setAiLoading(true);
    setViewingTrade(newTrade);
    setSidebarView('TRADE_PANEL');
    
    const getChartImage = (chart: any) => {
        if (!chart) return undefined;
        try {
            // @ts-ignore
            if (typeof chart.getDataUrl === 'function') return chart.getDataUrl({ type: 'jpeg', backgroundColor: '#111827' });
            // @ts-ignore
            if (typeof chart.getConvertPictureUrl === 'function') return chart.getConvertPictureUrl(true, 'jpeg', '#111827');
        } catch (e) { console.warn(e); }
        return undefined;
    };

    const ltfImage = getChartImage(ltfChartInstance.current);
    const htfImage = getChartImage(htfChartInstance.current);

    const visibleData = allCandles.slice(0, currentIndex + 1);
    const comment = await analyzeTrade(newTrade, visibleData, ltfImage, htfImage, customPrompt);
    
    const updatedTrade = { ...newTrade, aiComment: comment };
    
    setActiveTrade(updatedTrade); 
    setTradeHistory(prev => prev.map(t => t.id === newTrade.id ? updatedTrade : t));
    setViewingTrade(current => (current && current.id === newTrade.id) ? updatedTrade : current);
    
    // Save open trade to DB
    await db.trades.add(newTrade);
    
    setAiLoading(false);
  };
  
  const loadHistoryAndShowPanel = async () => {
      const allSessions = await db.games.where('status').equals('COMPLETED').toArray();
      const allTrades = await db.trades.toArray();
      
      const tradeMap: Record<number, Trade[]> = {};
      allTrades.forEach(t => {
          if(!tradeMap[t.gameId]) tradeMap[t.gameId] = [];
          tradeMap[t.gameId].push(t);
      });
      
      setPastSessions(allSessions);
      setPastTrades(tradeMap);
      setSidebarView('HISTORY_PANEL');
  };

  // --- REWIND / TIME MACHINE LOGIC ---

  const refreshCharts = useCallback((limitIndex: number) => {
      // 1. Slice LTF Data
      const slicedLtf = allCandles.slice(0, limitIndex + 1);
      
      if (ltfChartInstance.current) {
          ltfChartInstance.current.applyNewData(slicedLtf);
      }

      // 2. Slice/Filter HTF Data
      if (htfChartInstance.current && slicedLtf.length > 0) {
          const lastLtfTimestamp = slicedLtf[slicedLtf.length - 1].timestamp;
          const relevantHtf = allHtfCandlesRef.current.filter(c => c.timestamp <= lastLtfTimestamp);
          htfChartInstance.current.applyNewData(relevantHtf);
      }
  }, [allCandles]);

  const handleReviewTrade = (trade: Trade) => {
      setIsPlaying(false);
      
      if (!isReviewingHistory) {
          lastPlayedIndexRef.current = currentIndex;
      }
      setIsReviewingHistory(true);

      const tradeIndex = allCandles.findIndex(c => c.timestamp === trade.entryTime);
      
      if (tradeIndex !== -1) {
          setViewingTrade(trade);
          setSidebarView('TRADE_PANEL');
          refreshCharts(tradeIndex);
      }
  };

  const handleBackToLive = () => {
      // Restore to the latest played index
      const resumeIndex = lastPlayedIndexRef.current;
      setCurrentIndex(resumeIndex);
      refreshCharts(resumeIndex);
      setIsReviewingHistory(false);
      setViewingTrade(null);
      setSidebarView('DASHBOARD');
  };

  const displayDate = isReviewingHistory && viewingTrade
    ? new Date(viewingTrade.entryTime).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12: false }) + " (Reviewing)"
    : allCandles[currentIndex] 
        ? new Date(allCandles[currentIndex].timestamp).toLocaleString('zh-CN', {
            timeZone: 'Asia/Shanghai', 
            month: '2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12: false
          }) 
        : '--';
  
  const displayIndex = isReviewingHistory && viewingTrade 
    ? allCandles.findIndex(c => c.timestamp === viewingTrade.entryTime) 
    : currentIndex;

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden transition-colors duration-300">
      {/* Header */}
      <header className="h-14 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 bg-white dark:bg-gray-950 shrink-0 gap-4 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-500 to-cyan-500 dark:from-blue-400 dark:to-cyan-300 bg-clip-text text-transparent hidden md:block whitespace-nowrap">
                K-Line Master
            </h1>
            {session && (
                <div className="flex gap-4 items-center">
                    <div className="flex gap-2 text-xs font-mono overflow-hidden items-center">
                        <span className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-700 dark:text-white border border-gray-200 dark:border-gray-700 font-bold transition-colors">{session.symbol}</span>
                        {session.parentSessionId && (
                            <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 px-2 py-1 rounded border border-blue-200 dark:border-blue-500/30 font-bold flex items-center gap-1 transition-colors">
                                <RefreshCw size={10} /> Replay
                            </span>
                        )}
                        {session.status === 'COMPLETED' && (
                            <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 px-2 py-1 rounded border border-indigo-200 dark:border-indigo-500/30 font-bold flex items-center gap-1 transition-colors">
                                <History size={10} /> History
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>

        <div className="flex items-center gap-2">
             <button 
                onClick={() => setIsPlaying(!isPlaying)}
                disabled={session?.status === 'COMPLETED' || isReviewingHistory}
                className={`p-2 rounded-lg transition-colors ${
                    isPlaying 
                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500' 
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50'
                }`}
            >
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>
            <button 
                onClick={nextCandle} 
                disabled={session?.status === 'COMPLETED' || isReviewingHistory} 
                className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg disabled:opacity-50 transition-colors"
            >
                <ChevronRight size={18} />
            </button>
            
            {session && (
                 <div className="flex flex-col border-l border-gray-200 dark:border-gray-700 pl-3 ml-1 h-8 justify-center">
                     <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-[10px] font-mono leading-none mb-0.5">
                         <Calendar size={10} />
                         <span>{displayIndex + 1} / {allCandles.length}</span>
                     </div>
                     <span className={`text-xs font-bold font-mono leading-none ${isReviewingHistory ? 'text-blue-500' : 'text-gray-800 dark:text-gray-200'}`}>
                         {displayDate}
                     </span>
                 </div>
            )}

            <div className="flex items-center gap-2 ml-2 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hidden md:flex transition-colors">
                <Zap size={14} className="text-yellow-500" />
                <input 
                    type="range" min="100" max="2000" step="100"
                    value={autoPlaySpeed}
                    onChange={(e) => setAutoPlaySpeed(Number(e.target.value))}
                    className="w-16 accent-yellow-500 h-1 bg-gray-200 dark:bg-gray-700"
                />
            </div>
        </div>

        <div className="flex items-center gap-3">
             <div className="flex gap-2">
                <button 
                    onClick={() => handleOpenTradeModal('LONG')}
                    disabled={!!activeTrade || session?.status === 'COMPLETED' || isReviewingHistory}
                    className="flex items-center gap-1 px-3 py-1.5 bg-trade-profit hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold rounded text-xs sm:text-sm transition-all shadow-[0_0_10px_rgba(46,189,133,0.3)]"
                >
                    <TrendingUp size={16} /> <span className="hidden sm:inline">Long</span>
                </button>
                <button 
                    onClick={() => handleOpenTradeModal('SHORT')}
                    disabled={!!activeTrade || session?.status === 'COMPLETED' || isReviewingHistory}
                    className="flex items-center gap-1 px-3 py-1.5 bg-trade-loss hover:bg-rose-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold rounded text-xs sm:text-sm transition-all shadow-[0_0_10px_rgba(246,70,93,0.3)]"
                >
                    <TrendingDown size={16} /> <span className="hidden sm:inline">Short</span>
                </button>
             </div>
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1"></div>
            
            <button 
                onClick={loadHistoryAndShowPanel} 
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-blue-600 dark:text-blue-400 transition-colors flex items-center gap-2" 
                title="Career History"
            >
                <Trophy size={18} />
                <span className="hidden lg:inline text-xs font-bold">Career</span>
            </button>

            <button onClick={() => setSidebarView('SETTINGS')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors relative text-gray-500 dark:text-gray-400">
                <Settings size={18} />
            </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Charts (Left Side) */}
        <div className="flex-1 flex flex-col relative min-w-0 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
            {/* Back to Live Button (Overlay) */}
            {isReviewingHistory && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4">
                    <button 
                        onClick={handleBackToLive}
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
        
        {/* Resizable Sidebar (Right Side) */}
        <div 
             className="flex flex-col bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 relative transition-all duration-200 ease-linear z-20"
             style={{ width: historyPanelWidth }}
        >
             {/* Resize Handle (Left Edge) */}
             <div 
                 className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors z-50"
                 onMouseDown={() => setIsResizingHistory(true)}
             ></div>

             {/* === VIEW 1: DASHBOARD (Current Session Stats) === */}
             {sidebarView === 'DASHBOARD' && (
                 <DashboardPanel 
                    balance={balance}
                    initialBalance={INITIAL_BALANCE}
                    session={session}
                    comparisonStats={comparisonStats}
                    loading={loading}
                    isGeneratingReport={isGeneratingReport}
                    finalReport={finalReport}
                    currentTrades={tradeHistory}
                    onReviewTrade={handleReviewTrade}
                    onStartNewGame={() => openConfirm('重新开始', '确定要放弃当前进度并开始新的一局吗？', () => startNewGame())}
                    onEndGame={handleEndGame}
                    onLoadSession={handleLoadSession}
                    isReviewingHistory={isReviewingHistory}
                    viewingTradeId={viewingTrade?.id}
                 />
             )}

             {/* === VIEW 2: TRADE PANEL === */}
             {sidebarView === 'TRADE_PANEL' && (
                 <div className="h-full animate-in slide-in-from-right-10">
                    <TradePanel 
                        onClose={() => setSidebarView('DASHBOARD')} 
                        onConfirm={executeTrade}
                        currentPrice={allCandles[currentIndex]?.close || 0}
                        direction={modalDirection}
                        balance={balance}
                        viewingTrade={viewingTrade}
                        isLoading={aiLoading}
                    />
                 </div>
             )}

             {/* === VIEW 3: HISTORY PANEL === */}
             {sidebarView === 'HISTORY_PANEL' && (
                 <div className="h-full animate-in slide-in-from-right-10">
                    <GameHistoryPanel 
                        onClose={() => setSidebarView('DASHBOARD')}
                        sessions={pastSessions}
                        tradesByGame={pastTrades}
                        onReplay={handleReplay}
                        onReview={handleLoadSession}
                        onDelete={handleDeleteHistory}
                    />
                 </div>
             )}

             {/* === VIEW 4: SETTINGS PANEL === */}
             {sidebarView === 'SETTINGS' && (
                 <div className="h-full animate-in slide-in-from-right-10">
                    <SettingsPanel 
                        onClose={() => setSidebarView('DASHBOARD')}
                        configSymbol={configSymbol}
                        setConfigSymbol={setConfigSymbol}
                        configTimeframe={configTimeframe}
                        setConfigTimeframe={setConfigTimeframe}
                        customPrompt={customPrompt}
                        setCustomPrompt={setCustomPrompt}
                        SUPPORTED_SYMBOLS={SUPPORTED_SYMBOLS}
                        SUPPORTED_TIMEFRAMES={SUPPORTED_TIMEFRAMES}
                        theme={theme}
                        setTheme={setTheme}
                    />
                 </div>
             )}
        </div>

      </div>

      {/* Modals: Removed SettingsModal and moved to Sidebar */}
      <SessionRestoreModal
        isOpen={showRestoreModal}
        session={pendingRestoreSession}
        onDiscard={handleDiscard}
        onResume={handleResume}
      />

      <ConfirmDialog 
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={handleConfirmAction}
        onCancel={closeConfirm}
      />

      {loading && !session?.status && (
          <div className="fixed inset-0 z-[120] bg-white dark:bg-gray-950 flex flex-col items-center justify-center text-gray-900 dark:text-white">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-gray-200 dark:border-blue-900 rounded-full"></div>
                <div className="w-12 h-12 border-4 border-blue-600 dark:border-blue-500 rounded-full animate-spin absolute top-0 left-0 border-t-transparent"></div>
              </div>
              <p className="text-sm font-bold mt-4 tracking-widest uppercase text-blue-600 dark:text-blue-400">Loading Market Data</p>
          </div>
      )}
    </div>
  );
};

export default App;