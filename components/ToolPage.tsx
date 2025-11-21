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
            <ArrowIcon className="w-4 h-4 transform rotate-180 transition-transform group-hover:-translate-x-1" />
            Back to all tools
          </button>
        </div>
        
        <section className="bg-white dark:bg-brand-dark-card p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300">
          <header className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{tool.title}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">{tool.description}</p>
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