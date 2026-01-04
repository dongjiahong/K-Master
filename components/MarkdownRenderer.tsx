import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  content: string;
}

const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  // Preprocess: Fix common AI output issue where table rows are not separated by newlines.
  // Replaces "| |" with "|\n|"
  const processedContent = React.useMemo(() => {
    if (!content) return '';
    return content.replace(/\|\s*\|/g, '|\n|');
  }, [content]);

  return (
    <div className="prose dark:prose-invert prose-sm max-w-none text-gray-900 dark:text-gray-100">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          strong: ({node, ...props}) => <span className="font-extrabold text-blue-600 dark:text-blue-400" {...props} />,
          p: ({node, ...props}) => <p className="mb-2 leading-relaxed text-gray-700 dark:text-gray-300" {...props} />,
          ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2 space-y-1 text-gray-700 dark:text-gray-300" {...props} />,
          li: ({node, ...props}) => <li className="" {...props} />,
          blockquote: ({node, ...props}) => (
            <blockquote className="border-l-4 border-yellow-500 pl-3 italic text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 py-1 rounded-r mb-2" {...props} />
          ),
          // Table styles
          table: ({node, ...props}) => (
            <div className="overflow-x-auto my-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-xs text-left border-collapse" {...props} />
            </div>
          ),
          thead: ({node, ...props}) => <thead className="bg-gray-100 dark:bg-gray-800/80 text-gray-700 dark:text-gray-200" {...props} />,
          tbody: ({node, ...props}) => <tbody className="bg-white/50 dark:bg-gray-900/30 divide-y divide-gray-200 dark:divide-gray-800" {...props} />,
          tr: ({node, ...props}) => <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" {...props} />,
          th: ({node, ...props}) => <th className="px-3 py-2 font-bold border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-gray-800 dark:text-gray-200" {...props} />,
          td: ({node, ...props}) => <td className="px-3 py-2 border-r border-gray-200 dark:border-gray-800 last:border-r-0 text-gray-700 dark:text-gray-300" {...props} />,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;