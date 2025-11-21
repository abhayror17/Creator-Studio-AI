import React from 'react';
import { Tool, Project } from '../types';
import ToolView from './ToolView';
import { ArrowIcon } from './Icons';
import { CreationContext } from '../App';

interface ToolPageProps {
  tool: Tool;
  onBack: () => void;
  creationContext: CreationContext;
  setCreationContext: React.Dispatch<React.SetStateAction<CreationContext>>;
  onNavigateToTool: (toolId: string, newContext?: Partial<CreationContext>) => void;
  onSaveAsProject: (title: string, toolId: string, generatedContent: any) => void;
  tools: Tool[];
}

const ToolPage: React.FC<ToolPageProps> = ({ tool, onBack, creationContext, setCreationContext, onNavigateToTool, onSaveAsProject, tools }) => {
  return (
    <div className="min-h-screen bg-brand-bg dark:bg-brand-dark-bg text-gray-800 dark:text-gray-100 font-sans p-4 sm:p-8 transition-colors duration-300">
      <main className="max-w-5xl mx-auto">
        <div className="mb-8">
          <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors group">
            <div className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm group-hover:shadow-md transition-all border border-gray-200 dark:border-gray-700">
                 <ArrowIcon className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            </div>
            Back to all tools
          </button>
        </div>
        
        <section className="bg-white dark:bg-brand-dark-card p-6 sm:p-10 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 transition-colors duration-300">
          <header className="mb-8 pb-8 border-b border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center gap-4 mb-4">
                 <div className="w-14 h-14 bg-brand-red/10 dark:bg-brand-red/20 rounded-2xl flex items-center justify-center text-brand-red shadow-inner">
                    {tool.icon && React.cloneElement(tool.icon as React.ReactElement<{ className?: string }>, { className: "w-8 h-8"})}
                 </div>
                 <div>
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">{tool.title}</h1>
                 </div>
            </div>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl leading-relaxed">{tool.description}</p>
          </header>
          
          <ToolView 
            tool={tool} 
            creationContext={creationContext}
            setCreationContext={setCreationContext}
            onNavigateToTool={onNavigateToTool}
            onSaveAsProject={onSaveAsProject}
            tools={tools}
          />
        </section>
      </main>
    </div>
  );
};

export default ToolPage;