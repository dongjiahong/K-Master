import React, { useState, useRef, useEffect } from 'react';
import { X, GripHorizontal } from 'lucide-react';

interface FloatingPanelProps {
  title: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  initialWidth?: number;
  initialHeight?: number;
  initialX?: number;
  initialY?: number;
  minWidth?: number;
  minHeight?: number;
}

const FloatingPanel: React.FC<FloatingPanelProps> = ({
  title,
  isOpen,
  onClose,
  children,
  initialWidth = 400,
  initialHeight = 500,
  initialX,
  initialY,
  minWidth = 300,
  minHeight = 200
}) => {
  // Default center position if not provided
  const getDefaultX = () => typeof window !== 'undefined' ? (window.innerWidth - initialWidth) / 2 : 0;
  const getDefaultY = () => typeof window !== 'undefined' ? (window.innerHeight - initialHeight) / 2 : 0;

  const [position, setPosition] = useState({ x: initialX ?? getDefaultX(), y: initialY ?? getDefaultY() });
  const [size, setSize] = useState({ w: initialWidth, h: initialHeight });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  const dragStartRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    if (isOpen && (initialX === undefined || initialY === undefined)) {
       // Recenter on open if no specific pos
       setPosition({ 
           x: initialX ?? (window.innerWidth - size.w) / 2, 
           y: initialY ?? (window.innerHeight - size.h) / 2 
       });
    }
  }, [isOpen]);

  // Handle Dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      }
      if (isResizing) {
        const dx = e.clientX - resizeStartRef.current.x;
        const dy = e.clientY - resizeStartRef.current.y;
        setSize({
          w: Math.max(minWidth, resizeStartRef.current.w + dx),
          h: Math.max(minHeight, resizeStartRef.current.h + dy)
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      document.body.style.userSelect = 'auto';
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'auto';
    };
  }, [isDragging, isResizing, minWidth, minHeight]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed z-[100] bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      style={{
        left: position.x,
        top: position.y,
        width: size.w,
        height: size.h,
      }}
    >
      {/* Header (Drag Handle) */}
      <div 
        className="h-12 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 cursor-move shrink-0 select-none group"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.drag-handle')) {
              setIsDragging(true);
              dragStartRef.current = { x: e.clientX, y: e.clientY };
          }
        }}
      >
        <div className="flex items-center gap-2 drag-handle">
           <GripHorizontal size={16} className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
           <div className="font-bold text-sm text-gray-700 dark:text-gray-200">{title}</div>
        </div>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {children}
      </div>

      {/* Resize Handle */}
      <div 
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-50 flex items-end justify-end p-0.5"
        onMouseDown={(e) => {
          e.stopPropagation();
          setIsResizing(true);
          resizeStartRef.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
        }}
      >
         <div className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-sm"></div>
      </div>
    </div>
  );
};

export default FloatingPanel;
