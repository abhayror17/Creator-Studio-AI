import React from 'react';
import { Tool, ToolStatus } from '../types';

interface ToolCardProps {
  tool: Tool;
  isSelected: boolean; 
  onClick: () => void;
}

const statusStyles: { [key in ToolStatus]: string } = {
  [ToolStatus.Live]: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  [ToolStatus.Beta]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  [ToolStatus.Soon]: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const ToolCard: React.FC<ToolCardProps> = ({ tool, onClick }) => {
  const isClickable = tool.status !== ToolStatus.Soon;
  
  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={`
        bg-white dark:bg-brand-dark-card p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700
        transition-all duration-300 ease-in-out
        flex flex-col
        group
        ${isClickable ? 'cursor-pointer hover:shadow-lg hover:border-brand-red/50 dark:hover:border-brand-red/50 hover:-translate-y-1' : 'cursor-not-allowed opacity-60'}
      `}
    >
      <div className="flex justify-between items-start mb-3">
         <div className="flex items-center gap-3">
             <div className="flex-shrink-0 w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:bg-red-50 dark:group-hover:bg-red-900/20 group-hover:text-brand-red transition-colors duration-300">
                {tool.icon && React.cloneElement(tool.icon as React.ReactElement<{ className?: string }>, { className: "w-6 h-6"})}
             </div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-brand-red transition-colors">
                {tool.title}
            </h3>
         </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusStyles[tool.status]}`}>
          {tool.status}
        </span>
      </div>
      <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 flex-grow leading-relaxed">{tool.description}</p>
      <div className="flex justify-between items-end">
        <div className="flex gap-2 flex-wrap">
          {tool.tags.map(tag => (
            <span key={tag} className="text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800/80 px-2.5 py-1 rounded-md border border-gray-100 dark:border-gray-700">{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ToolCard;