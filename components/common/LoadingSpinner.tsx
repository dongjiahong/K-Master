import React from 'react';

interface LoadingSpinnerProps {
  /** 是否全屏覆盖 */
  fullScreen?: boolean;
  /** 加载提示文字 */
  message?: string;
  /** 尺寸：small | medium | large */
  size?: 'small' | 'medium' | 'large';
}

const sizeMap = {
  small: 'w-6 h-6 border-2',
  medium: 'w-12 h-12 border-4',
  large: 'w-16 h-16 border-4',
};

/**
 * 统一的加载动画组件
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  fullScreen = false,
  message,
  size = 'medium',
}) => {
  const spinner = (
    <div className="relative">
      <div className={`${sizeMap[size]} border-gray-200 dark:border-blue-900 rounded-full`}></div>
      <div className={`${sizeMap[size]} border-blue-600 dark:border-blue-500 rounded-full animate-spin absolute top-0 left-0 border-t-transparent`}></div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[120] bg-white dark:bg-gray-950 flex flex-col items-center justify-center text-gray-900 dark:text-white">
        {spinner}
        {message && (
          <p className="text-sm font-bold mt-4 tracking-widest uppercase text-blue-600 dark:text-blue-400">
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      {spinner}
      {message && (
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {message}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner;
