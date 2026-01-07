import { useCallback, useEffect, useRef, useState } from 'react';

interface UseGameLoopOptions {
  onNextCandle: () => void;
  isReviewingHistory: boolean;
}

/**
 * Hook 用于管理游戏循环（自动播放）
 */
export function useGameLoop({ onNextCandle, isReviewingHistory }: UseGameLoopOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoPlaySpeed, setAutoPlaySpeed] = useState(1000);
  
  const playTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // 管理自动播放 interval
  useEffect(() => {
    if (isPlaying && !isReviewingHistory) {
      playTimer.current = setInterval(onNextCandle, autoPlaySpeed);
    } else if (playTimer.current) {
      clearInterval(playTimer.current);
      playTimer.current = null;
    }
    return () => {
      if (playTimer.current) {
        clearInterval(playTimer.current);
        playTimer.current = null;
      }
    };
  }, [isPlaying, onNextCandle, autoPlaySpeed, isReviewingHistory]);

  /**
   * 停止播放
   */
  const stopPlaying = useCallback(() => {
    setIsPlaying(false);
  }, []);

  /**
   * 开始播放
   */
  const startPlaying = useCallback(() => {
    setIsPlaying(true);
  }, []);

  /**
   * 切换播放状态
   */
  const togglePlaying = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  return {
    isPlaying,
    setIsPlaying,
    autoPlaySpeed,
    setAutoPlaySpeed,
    stopPlaying,
    startPlaying,
    togglePlaying,
  };
}
