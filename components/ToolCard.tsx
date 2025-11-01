import React from 'react';
import { Tool, ToolStatus } from '../types';

interface ToolCardProps {
  tool: Tool;
  isSelected: boolean; 
  onClick: () => void;
}

const statusStyles: { [key in ToolStatus]: string } = {
  [ToolStatus.Live]: 'bg-green-100 text-green-800',
  [ToolStatus.Beta]: 'bg-yellow-100 text-yellow-800',
  [ToolStatus.Soon]: 'bg-gray-100 text-gray-500',
};

const ToolCard: React.FC<ToolCardProps> = ({ tool, onClick }) => {
  const isClickable = tool.status !== ToolStatus.Soon;
  
  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={`
        bg-white p-6 rounded-2xl shadow-sm border border-gray-200
        transition-all duration-300 ease-in-out
        flex flex-col
        group
        ${isClickable ? 'cursor-pointer hover:shadow-lg hover:border-brand-red/50 hover:-translate-y-1' : 'cursor-not-allowed opacity-60'}
      `}
    >
      <div className="flex justify-between items-start mb-3">
         <div className="flex items-center gap-3">
             <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 group-hover:bg-red-100 group-hover:text-brand-red transition-colors">
                {/* Fix: Check for icon existence and explicitly type props for cloneElement to pass className. */}
                {tool.icon && React.cloneElement(tool.icon as React.ReactElement<{ className?: string }>, { className: "w-5 h-5"})}
             </div>
            <h3 className="font-bold text-lg text-gray-900 group-hover:text-brand-red transition-colors">
                {tool.title}
            </h3>
         </div>
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusStyles[tool.status]}`}>
          {tool.status}
        </span>
      </div>
      <p className="text-gray-500 text-sm mb-4 flex-grow">{tool.description}</p>
      <div className="flex justify-between items-end">
        <div className="flex gap-2 flex-wrap">
          {tool.tags.map(tag => (
            <span key={tag} className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-md">{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ToolCard;