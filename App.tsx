import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Tool, ToolStatus, WorkflowStep, StepContent, ListContent, Project, ProjectStatus } from './types';
import ToolCard from './components/ToolCard';
import ToolPage from './components/ToolPage';
import ProjectsDashboard from './components/ProjectsDashboard';
import { 
    RobotIcon, IdeaIcon, ScriptIcon, HookIcon, TitleIcon, DescriptionIcon, 
    TagIcon, ThumbnailIcon, ChapterIcon, NameIcon, CopyIcon,
    CheckCircleIcon, ClockIcon, SpinnerIcon, TargetIcon, SparklesIcon,
    NewspaperIcon,
    WriteIcon,
    TranscriptIcon,
    DownloadIcon,
    ShortsIcon,
    SearchIcon,
    LogoIcon,
    XIcon
} from './components/Icons';
import * as geminiService from './services/geminiService';

const CATEOGRY_IDEATION = 'Ideation & Strategy';
const CATEGORY_CONTENT_CREATION = 'Content Creation';
const CATEGORY_VISUALS = 'Visuals & Thumbnails';
const CATEGORY_SEO = 'SEO & Optimization';
const CATEGORY_SOCIAL_MEDIA = 'Social Media & Community';
const CATEGORY_UTILITIES = 'Utilities';

const tools: Tool[] = [
  {
    id: 'idea-generator',
    title: 'Content Idea Generator',
    description: 'Brainstorm viral video ideas based on your niche, keywords, or target audience.',
    status: ToolStatus.Live,
    tags: ['creative', 'strategy'],
    icon: <IdeaIcon />,
    category: CATEOGRY_IDEATION,
  },
  {
    id: 'shorts-idea-generator',
    title: 'YouTube Shorts Idea Generator',
    description: 'Generate viral ideas for YouTube Shorts, complete with hooks and a brief outline.',
    status: ToolStatus.Live,
    tags: ['shorts', 'creative', 'ideas'],
    icon: <ShortsIcon />,
    category: CATEOGRY_IDEATION,
  },
  {
    id: 'name-generator',
    title: 'YouTube Name Generator',
    description: 'Generate unique and catchy YouTube channel names that stand out.',
    status: ToolStatus.Beta,
    tags: ['branding', 'naming'],
    icon: <NameIcon />,
    category: CATEOGRY_IDEATION,
  },
  {
    id: 'transcript-generator',
    title: 'YouTube Transcript Generator',
    description: 'Enter a YouTube video URL to fetch its full transcript.',
    status: ToolStatus.Live,
    tags: ['utility', 'transcript'],
    icon: <TranscriptIcon />,
    category: CATEGORY_UTILITIES,
  },
  {
    id: 'script-generator',
    title: 'YouTube Script Generator',
    description: 'Outline full scripts with pacing cues, talking points, and calls-to-action.',
    status: ToolStatus.Beta,
    tags: ['script', 'story'],
    icon: <ScriptIcon />,
    category: CATEGORY_CONTENT_CREATION,
  },
  {
    id: 'hooks-generator',
    title: 'Catchy Hooks Generator',
    description: 'Generate engaging opening hooks to capture viewer attention in the first few seconds.',
    status: ToolStatus.Beta,
    tags: ['creative', 'retention'],
    icon: <HookIcon />,
    category: CATEGORY_CONTENT_CREATION,
  },
  {
    id: 'title-generator',
    title: 'YouTube Title Generator',
    description: 'Craft click-worthy titles tuned for search intent and suggested traffic, backed by real-time search data.',
    status: ToolStatus.Live,
    tags: ['seo', 'copy'],
    icon: <TitleIcon />,
    category: CATEGORY_CONTENT_CREATION,
  },
  {
    id: 'description-generator',
    title: 'YouTube Description Generator',
    description: 'Draft optimized descriptions with keywords, CTAs, and timestamps from your video transcript or topic.',
    status: ToolStatus.Beta,
    tags: ['seo', 'copy'],
    icon: <DescriptionIcon />,
    category: CATEGORY_CONTENT_CREATION,
  },
    {
    id: 'x-financial-thread',
    title: 'X Financial Thread Generator',
    description: 'Generate a 12-post X (Twitter) thread analyzing any public company, complete with financial data and an investment thesis.',
    status: ToolStatus.Live,
    tags: ['finance', 'twitter', 'x', 'social', 'analysis'],
    icon: <XIcon />,
    category: CATEGORY_SOCIAL_MEDIA,
  },
  {
    id: 'tag-generator',
    title: 'YouTube Tag Generator',
    description: 'Generate a list of relevant, high-traffic tags to improve your video\'s search ranking.',
    status: ToolStatus.Beta,
    tags: ['seo', 'discovery'],
    icon: <TagIcon />,
    category: CATEGORY_SEO,
  },
  {
    id: 'chapter-generator',
    title: 'YouTube Chapter Generator',
    description: 'Propose timestamped chapters that improve navigation and viewer retention.',
    status: ToolStatus.Beta,
    tags: ['retention', 'structure'],
    icon: <ChapterIcon />,
    category: CATEGORY_SEO,
  },
  {
    id: 'image-generator',
    title: 'YT Thumbnail Generator',
    description: 'Generate high-quality, unique 16:9 images from a text prompt for your YouTube thumbnails.',
    status: ToolStatus.Live,
    tags: ['creative', 'visual', 'ai'],
    icon: <SparklesIcon />,
    category: CATEGORY_VISUALS,
  },
  {
    id: 'thumbnail-generator',
    title: 'YouTube Thumbnail Editor',
    description: 'Edit your thumbnail with AI-generated compositions, text, and filters using simple text prompts.',
    status: ToolStatus.Live,
    tags: ['creative', 'visual'],
    icon: <ThumbnailIcon />,
    category: CATEGORY_VISUALS,
  },
  {
    id: 'copy-assistant',
    title: 'YT Thumbnail Copier',
    description: 'Replicate the style of a reference thumbnail and apply your own edits with high fidelity.',
    status: ToolStatus.Beta,
    tags: ['copy', 'creative', 'strategy'],
    icon: <CopyIcon />,
    category: CATEGORY_VISUALS,
  },
  {
    id: 'thumbnail-downloader',
    title: 'YouTube Thumbnail Downloader',
    description: 'Enter a YouTube video URL to download its thumbnail in various qualities.',
    status: ToolStatus.Live,
    tags: ['utility', 'downloader'],
    icon: <DownloadIcon />,
    category: CATEGORY_UTILITIES,
  },
];

const workflowOrder = [
    'idea-generator',
    'shorts-idea-generator',
    'name-generator',
    'transcript-generator',
    'script-generator',
    'hooks-generator',
    'title-generator',
    'description-generator',
    'x-financial-thread',
    'image-generator',
    'thumbnail-generator',
    'copy-assistant',
    'tag-generator',
    'chapter-generator',
    'thumbnail-downloader',
];

const categoryOrder = [
    CATEOGRY_IDEATION,
    CATEGORY_CONTENT_CREATION,
    CATEGORY_VISUALS,
    CATEGORY_SEO,
    CATEGORY_SOCIAL_MEDIA,
    CATEGORY_UTILITIES,
];

// Sort the tools based on the defined workflow.
const sortedTools = [...tools].sort((a, b) => {
    const indexA = workflowOrder.indexOf(a.id);
    const indexB = workflowOrder.indexOf(b.id);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
});

export interface CreationContext {
  topic: string;
  transcript: string;
  selectedTitle: string;
}

// Helper function to truncate text
const truncate = (str: string, len: number) => {
  if (str.length <= len) return str;
  return str.substring(0, len) + '...';
};


const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<Tool | null>(null);
  const [creationContext, setCreationContext] = useState<CreationContext>({
    topic: '',
    transcript: '',
    selectedTitle: '',
  });

  // State for the AI Agent on the main page
  const [agentPrompt, setAgentPrompt] = useState('');
  const [isLoadingAgent, setIsLoadingAgent] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[] | null>(null);

  // State for the Trending Topics feature
  const [trendingTopics, setTrendingTopics] = useState<string[] | null>(null);
  const [isFetchingTopics, setIsFetchingTopics] = useState(true);
  const [trendingError, setTrendingError] = useState<string | null>(null);

  // State for tool search
  const [searchQuery, setSearchQuery] = useState('');
  
  // State for Collaboration Projects
  const [projects, setProjects] = useState<Project[]>([]);
  
  const handleSaveAsProject = useCallback((title: string, toolId: string, generatedContent: any) => {
    const newProject: Project = {
        id: `proj_${Date.now()}`,
        title: title || 'Untitled Project',
        toolId,
        generatedContent,
        status: ProjectStatus.Draft,
        feedback: [],
    };
    setProjects(prev => [newProject, ...prev]);
  }, []);

  const handleUpdateProject = useCallback((updatedProject: Project) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
  }, []);


  useEffect(() => {
    const loadTrendingTopics = async () => {
        setIsFetchingTopics(true);
        setTrendingError(null);
        try {
            const topics = await geminiService.fetchTrendingTopics();
            setTrendingTopics(topics);
        } catch (err) {
            setTrendingError(err instanceof Error ? err.message : 'Failed to load trending topics.');
        } finally {
            setIsFetchingTopics(false);
        }
    };
    loadTrendingTopics();
  }, []);

  const runAutomation = useCallback(async (topic: string) => {
    if (!topic) {
        setAgentError('Please enter a video topic to automate.');
        return;
    }
    // Prevent re-running if already running on the same topic
    if (isLoadingAgent && agentPrompt === topic) return;

    setAgentPrompt(topic);
    setIsLoadingAgent(true);
    setAgentError(null);
    setWorkflowSteps(null);

    const initialSteps: WorkflowStep[] = [
        { id: 'titles', label: 'Generating Viral Titles', status: 'pending', content: null },
        { id: 'hooks', label: 'Creating Catchy Hooks', status: 'pending', content: null },
        { id: 'script', label: 'Writing Full Script', status: 'pending', content: null },
        { id: 'description', label: 'Drafting Video Description', status: 'pending', content: null },
        { id: 'tags', label: 'Optimizing SEO Tags', status: 'pending', content: null },
    ];
    setWorkflowSteps(initialSteps);

    const onProgressCallback = (update: geminiService.WorkflowProgressUpdate) => {
        setWorkflowSteps(prevSteps => {
            if (!prevSteps) return null;
            return prevSteps.map(step => 
                step.id === update.stepId
                    ? { ...step, status: update.status, content: update.data !== undefined ? update.data : step.content }
                    : step
            );
        });
    };

    try {
      await geminiService.runFullWorkflow(topic, onProgressCallback);
    } catch (err) {
       setAgentError(err instanceof Error ? err.message : 'An unexpected error occurred during automation.');
       setWorkflowSteps(prev => prev?.map(s => s.status === 'running' || s.status === 'selecting' ? {...s, status: 'failed'} : s) || null);
    } finally {
      setIsLoadingAgent(false);
    }
  }, [isLoadingAgent, agentPrompt]);

  const handleAgentSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    runAutomation(agentPrompt);
  }, [agentPrompt, runAutomation]);

  const handleTopicClick = useCallback((topic: string) => {
    runAutomation(topic);
  }, [runAutomation]);

  const handleSelectTool = useCallback((tool: Tool, newContext?: Partial<CreationContext>) => {
    if (tool.status !== ToolStatus.Soon) {
      if (newContext) {
        setCreationContext(prev => ({...prev, ...newContext}));
      }
      setActiveTool(tool);
    }
  }, []);

  const handleGoBack = useCallback(() => {
    setActiveTool(null);
  }, []);

  const filteredTools = useMemo(() => {
      if (!searchQuery) {
          return sortedTools;
      }
      const query = searchQuery.toLowerCase();
      return sortedTools.filter(tool => 
          tool.title.toLowerCase().includes(query) ||
          tool.description.toLowerCase().includes(query) ||
          tool.tags.some(tag => tag.toLowerCase().includes(query))
      );
  }, [searchQuery]);

  const groupedAndFilteredTools = useMemo(() => {
      return filteredTools.reduce((acc, tool) => {
          const category = tool.category;
          if (!acc[category]) {
              acc[category] = [];
          }
          acc[category].push(tool);
          return acc;
      }, {} as Record<string, Tool[]>);
  }, [filteredTools]);
  
    const renderGeneratedText = (text: string) => (
        <div className="whitespace-pre-wrap text-gray-700 bg-white p-4 rounded-lg border border-gray-200 font-mono text-sm shadow-sm">{text}</div>
    );
    
    const renderListContent = (content: ListContent) => (
        <ul className="list-none space-y-3">
            {content.alternatives.map((item, index) => (
                <li key={index} className={`p-4 rounded-lg flex items-center gap-4 transition-all duration-300 ${item === content.chosen ? 'bg-green-100 border-green-300 shadow-md scale-105' : 'bg-white border-gray-200'}`}>
                    {item === content.chosen && <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0" />}
                    <p className={`flex-grow ${item === content.chosen ? 'font-semibold text-green-900' : 'text-gray-700'}`}>{item}</p>
                </li>
            ))}
        </ul>
    );
    
    const renderStepContent = (id: string, content: StepContent) => {
      if (typeof content === 'string') {
          if (id.startsWith('select-')) return <div className="font-semibold text-gray-800 p-4 bg-gray-100 rounded-lg">Selected: <span className="font-mono text-indigo-700">{content}</span></div>;
          return renderGeneratedText(content);
      }
      if (Array.isArray(content)) return <ul className="list-none space-y-2">{content.map((c, i) => <li key={i} className="p-3 bg-white border border-gray-200 rounded-md shadow-sm">{c}</li>)}</ul>;
      if (content && typeof content === 'object' && 'alternatives' in content) {
          return renderListContent(content as ListContent);
      }
      return null;
    };


  if (activeTool) {
    return (
      <ToolPage 
        tool={activeTool} 
        onBack={handleGoBack} 
        creationContext={creationContext}
        setCreationContext={setCreationContext}
        onNavigateToTool={(toolId, newContext) => {
          const tool = tools.find(t => t.id === toolId);
          if (tool) {
            handleSelectTool(tool, newContext);
          }
        }}
        onSaveAsProject={handleSaveAsProject}
        tools={tools}
      />
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg text-gray-800 font-sans p-4 sm:p-8">
      <main className="max-w-7xl mx-auto">
        <header className="text-center mb-12">
           <div className="inline-flex items-center gap-4 mb-4">
            <LogoIcon className="h-10 w-10" />
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight">Creator Studio AI</h1>
           </div>
           <p className="text-lg text-gray-500 max-w-3xl mx-auto">
            Your complete YouTube automation suite, powered by Gemini. From viral ideas to SEO-optimized descriptions, we've got you covered.
           </p>
        </header>
        
        <section className="max-w-4xl mx-auto mb-16 bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-200">
          <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-gray-800 flex items-center justify-center gap-3">
                  <RobotIcon className="w-8 h-8 text-brand-red" />
                  <span>YouTube Automation Agent</span>
              </h2>
              <p className="text-gray-500 mt-2">Enter a topic and let our agent handle the entire content creation workflow in one click.</p>
          </div>

          <div className="space-y-4">
              <form onSubmit={handleAgentSubmit} className="space-y-4">
                  <div className="relative w-full">
                    <WriteIcon className="absolute left-4 top-4 h-6 w-6 text-gray-400 peer-focus:text-brand-red transition-colors pointer-events-none" />
                    <textarea 
                      id="agent-prompt" 
                      value={agentPrompt} 
                      onChange={(e) => { 
                        setAgentPrompt(e.target.value); 
                        setWorkflowSteps(null);
                        setAgentError(null);
                      }} 
                      placeholder="e.g., A review of the new Gemini 2.5 Pro model" 
                      rows={3} 
                      className="peer w-full p-4 pl-14 bg-gray-50/70 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white transition-all shadow-sm text-gray-900 text-lg placeholder:text-gray-500"
                    />
                  </div>
                  <div className="grid grid-cols-1">
                    <button type="submit" disabled={isLoadingAgent} className="w-full bg-brand-red hover:bg-red-700 text-white font-bold py-4 px-8 rounded-lg transition-all duration-300 ease-in-out disabled:bg-red-300 disabled:cursor-not-allowed transform hover:scale-105 disabled:scale-100 flex items-center justify-center gap-3 text-lg shadow-md">
                        {isLoadingAgent ? (
                            <>
                                <SpinnerIcon className="w-6 h-6 animate-spin"/>
                                <span>Working...</span>
                            </>
                        ) : (
                            <>
                                <SparklesIcon className="w-6 h-6"/>
                                <span>Run Automation</span>
                            </>
                        )}
                    </button>
                  </div>
              </form>
              {agentError && <p className="text-red-600 mt-2 text-sm font-medium text-center">{agentError}</p>}
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 justify-center">
              <NewspaperIcon className="w-5 h-5 text-slate-600" />
              Trending Now
            </h3>
            {isFetchingTopics ? (
              <div className="text-center p-4"><SpinnerIcon className="w-8 h-8 mx-auto text-brand-red animate-spin"/></div>
            ) : trendingError ? (
               <p className="text-red-600 text-sm font-medium text-center bg-red-50 p-3 rounded-lg">{trendingError}</p>
            ) : (
              <div className="flex flex-wrap gap-3 justify-center">
                {trendingTopics?.map((topic, index) => (
                  <button 
                    key={index} 
                    onClick={() => handleTopicClick(topic)}
                    disabled={isLoadingAgent}
                    className="px-3 py-1.5 text-sm bg-white text-slate-700 rounded-full font-semibold border border-slate-200 hover:bg-slate-100 hover:text-slate-900 transition-all duration-200 transform hover:scale-105 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed disabled:scale-100 shadow-sm"
                    title={topic}
                  >
                    {truncate(topic, 60)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {workflowSteps && (
              <div className="space-y-4 mt-8">
                  {workflowSteps.map(step => (
                      <div key={step.id} className="p-4 bg-gray-50/80 rounded-xl border border-gray-200/80 transition-all backdrop-blur-sm">
                          <details open={step.status === 'completed' || step.status === 'running' || step.status === 'selecting'} className="group">
                              <summary className="flex items-center gap-3 cursor-pointer list-none">
                                  {step.status === 'running' && <SpinnerIcon className="w-5 h-5 text-blue-500 animate-spin" />}
                                  {step.status === 'selecting' && <TargetIcon className="w-5 h-5 text-indigo-500 animate-pulse" />}
                                  {step.status === 'completed' && <CheckCircleIcon className="w-5 h-5 text-green-500" />}
                                  {step.status === 'pending' && <ClockIcon className="w-5 h-5 text-gray-400" />}
                                  {step.status === 'failed' && <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>}
                                  <span className="font-semibold text-gray-700">{step.label}</span>
                                  {step.status === 'running' && <span className="text-sm text-gray-500 ml-auto font-medium animate-pulse">Working...</span>}
                                  {step.status === 'selecting' && <span className="text-sm text-indigo-600 ml-auto font-medium animate-pulse">Selecting Best...</span>}
                                  {step.status === 'completed' && <span className="text-sm text-green-600 ml-auto font-medium">Done!</span>}
                                  {step.status === 'failed' && <span className="text-sm text-red-600 ml-auto font-medium">Failed</span>}
                                  <div className="ml-auto transform transition-transform duration-200 group-open:rotate-90">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                  </div>
                              </summary>
                              {(step.status === 'completed' || step.status === 'selecting') && step.content && (
                                  <div className="mt-4 pt-4 border-t border-gray-200">
                                      {renderStepContent(step.id, step.content)}
                                  </div>
                              )}
                          </details>
                      </div>
                  ))}
              </div>
          )}
        </section>

        <ProjectsDashboard projects={projects} onUpdateProject={handleUpdateProject} tools={tools} />

        <div className="text-center mb-6 mt-16">
            <h2 className="text-3xl font-bold text-gray-800">Or Use an Individual Tool</h2>
            <p className="text-gray-500 mt-2">Fine-tune specific parts of your content with our specialized AI assistants.</p>
        </div>

        <div className="mb-8 max-w-lg mx-auto">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 peer-focus:text-brand-red pointer-events-none" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a tool (e.g., 'thumbnail', 'seo', 'script')..."
              className="peer w-full p-3 pl-12 bg-white border-2 border-gray-200 rounded-full focus:ring-2 focus:ring-brand-red/70 focus:border-transparent transition-all shadow-sm text-gray-900 placeholder:text-gray-500"
            />
          </div>
        </div>

        <div className="space-y-12">
            {filteredTools.length > 0 ? (
                categoryOrder.map(category => {
                    const toolsInCategory = groupedAndFilteredTools[category];
                    if (!toolsInCategory || toolsInCategory.length === 0) {
                        return null;
                    }
                    return (
                        <section key={category}>
                            <h3 className="text-2xl font-bold text-gray-800 mb-6 pb-2 border-b-2 border-gray-200">{category}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {toolsInCategory.map(tool => (
                                    <ToolCard 
                                      key={tool.id} 
                                      tool={tool}
                                      isSelected={false}
                                      onClick={() => handleSelectTool(tool)}
                                    />
                                ))}
                            </div>
                        </section>
                    );
                })
            ) : (
                <div className="text-center py-16">
                    <p className="text-xl font-semibold text-gray-700">No tools found for "{searchQuery}"</p>
                    <p className="text-gray-500 mt-2">Try searching for something else.</p>
                </div>
            )}
        </div>
      </main>
    </div>
  );
};

export default App;
