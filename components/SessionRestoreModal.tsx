import React from 'react';
import { RefreshCw, PlayCircle, AlertTriangle } from 'lucide-react';
import { GameSession } from '../types';

interface Props {
  isOpen: boolean;
  session: GameSession | null;
  onResume: () => void;
  onDiscard: () => void;
}

const SessionRestoreModal: React.FC<Props> = ({ isOpen, session, onResume, onDiscard }) => {
  if (!isOpen || !session) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-md w-full shadow-2xl p-6 relative overflow-hidden">
        {/* Background Accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="relative z-10 text-center">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-700 shadow-inner">
                <AlertTriangle size={32} className="text-yellow-500" />
            </div>
            
            <h2 className="text-xl font-bold text-white mb-2">发现未完成的交易</h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              我们发现您上一次在 <strong>{session.symbol}</strong> ({session.timeframe}) 的交易尚未结束。
              是否继续上次的进度？
            </p>

            <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={onDiscard}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-gray-800 border border-gray-700 hover:bg-gray-750 hover:border-red-500/50 hover:text-red-400 transition-all group"
                >
                    <RefreshCw size={20} className="group-hover:-rotate-180 transition-transform duration-500"/>
                    <span className="font-bold text-sm">放弃并开始新局</span>
                </button>

                <button 
                    onClick={onResume}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                >
                    <PlayCircle size={20} />
                    <span className="font-bold text-sm">继续游戏</span>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SessionRestoreModal;