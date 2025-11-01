import React, { useState, useCallback, useEffect } from 'react';
import { Tool, TitleGenerationResponse, DescriptionGenerationResponse, ScriptGenerationResponse, TitleOption, ScriptSection, ScriptCTA, ShortsGenerationResponse } from '../types';
import * as geminiService from '../services/geminiService';
import { DownloadIcon, SparklesIcon, WriteIcon, CheckCircleIcon, ClockIcon, SpinnerIcon, TargetIcon, ClipboardIcon, ClipboardCheckIcon, XIcon, BriefcaseIcon } from './Icons';
import { CreationContext } from '../App';

interface ToolViewProps {
  tool: Tool;
  creationContext: CreationContext;
  setCreationContext: React.Dispatch<React.SetStateAction<CreationContext>>;
  onNavigateToTool: (toolId: string, newContext?: Partial<CreationContext>) => void;
  onSaveAsProject: (title: string, toolId: string, generatedContent: any) => void;
  tools: Tool[];
}

// Helper hook for copy to clipboard
const useCopyToClipboard = (): [boolean, (text: string) => void] => {
  const [isCopied, setIsCopied] = useState(false);

  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    });
  }, []);

  return [isCopied, copy];
};

const TweetCard: React.FC<{ text: string; onCopy: () => void; }> = ({ text, onCopy }) => {
    const [isCopied, copy] = useCopyToClipboard();
    const handleCopyClick = () => {
        copy(text);
        if (onCopy) onCopy(); // For any parent logic
    };

    return (
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex gap-4 items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-black rounded-full flex items-center justify-center text-white">
                <XIcon className="w-4 h-4" />
            </div>
            <div className="flex-grow">
                <p className="whitespace-pre-wrap text-gray-800 font-sans">{text}</p>
            </div>
            <button 
                onClick={handleCopyClick}
                className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                title="Copy post"
            >
                {isCopied ? <ClipboardCheckIcon className="w-5 h-5 text-green-500" /> : <ClipboardIcon className="w-5 h-5" />}
            </button>
        </div>
    );
};

// Component for rendering the financial thread response.
// This was refactored from a helper function to a component to fix a conditional hook call error.
const FinancialThreadResponseView: React.FC<{ thread: string[] }> = ({ thread }) => {
    const [isAllCopied, copyAll] = useCopyToClipboard();
    
    const handleCopyAll = () => {
        const fullThread = thread.join('\n\n');
        copyAll(fullThread);
    };

    return (
        <div className="mt-6 space-y-4">
            <div className="flex justify-between items-center">
                <h4 className="font-bold text-lg text-gray-800">Generated X Thread</h4>
                <button
                    onClick={handleCopyAll}
                    className="flex items-center gap-2 text-sm font-semibold text-white px-4 py-2 rounded-lg bg-gray-800 hover:bg-black transition-all shadow-md"
                >
                    {isAllCopied ? <ClipboardCheckIcon className="w-5 h-5" /> : <ClipboardIcon className="w-5 h-5" />}
                    {isAllCopied ? 'Copied!' : 'Copy Full Thread'}
                </button>
            </div>
            <div className="space-y-3">
                {thread.map((post, index) => (
                    <TweetCard key={index} text={post} onCopy={() => {}} />
                ))}
            </div>
        </div>
    );
};


const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
};

// State for the YT Thumbnail Copier
interface CopierAssistantState {
  step: 'upload' | 'analyzing' | 'ask_questions' | 'planning' | 'done';
  analysisResult: geminiService.ThumbnailAnalysis | null;
  userResponses: Record<string, string>;
  finalEditPlan: Record<string, any> | null;
}

const extractVideoID = (url: string): string | null => {
    // Handle regular YouTube links, shorts, and youtu.be links
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
};


const ToolView: React.FC<ToolViewProps> = ({ tool, creationContext, setCreationContext, onNavigateToTool, onSaveAsProject, tools }) => {
  const [prompt, setPrompt] = useState('');
  const [transcript, setTranscript] = useState('');
  const [videoID, setVideoID] = useState<string | null>(null);
  
  useEffect(() => {
    // For transcript/downloader generator, don't pre-fill with topic
    if (tool.id === 'transcript-generator' || tool.id === 'thumbnail-downloader') {
      setPrompt('');
    } else {
      setPrompt(creationContext.selectedTitle || creationContext.topic);
    }
  }, [creationContext.selectedTitle, creationContext.topic, tool.id]);

  useEffect(() => {
    if (tool.id === 'thumbnail-downloader') {
        const id = extractVideoID(prompt);
        setVideoID(id);
    }
  }, [prompt, tool.id]);


  useEffect(() => {
    setTranscript(creationContext.transcript);
  }, [creationContext.transcript]);


  const [imageFile, setImageFile] = useState<File | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // State for the YT Thumbnail Copier workflow
  const [copierState, setCopierState] = useState<CopierAssistantState>({
      step: 'upload',
      analysisResult: null,
      userResponses: {},
      finalEditPlan: null,
  });
  
  const handleCopierAnalysis = async (file: File) => {
      if (!file) return;
      setIsLoading(true);
      setError(null);
      setCopierState(s => ({...s, step: 'analyzing' }));

      try {
        const base64Image = await fileToBase64(file);
        const mimeType = file.type;
        const analysisResult = await geminiService.analyzeThumbnailForCopying(base64Image, mimeType);
        setCopierState(s => ({...s, step: 'ask_questions', analysisResult }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred during analysis.');
        setCopierState(s => ({...s, step: 'upload' }));
      } finally {
        setIsLoading(false);
      }
  };
  
  const handleCopierPlanGeneration = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!copierState.analysisResult) return;

        setIsLoading(true);
        setError(null);
        setCopierState(s => ({...s, step: 'planning'}));

        try {
            const plan = await geminiService.generateCopyEditPlan(copierState.analysisResult, copierState.userResponses);
            setCopierState(s => ({...s, step: 'done', finalEditPlan: plan}));
            onSaveAsProject(prompt || 'Copier Edit Plan', tool.id, plan);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate edit plan.');
            setCopierState(s => ({...s, step: 'ask_questions' }));
        } finally {
            setIsLoading(false);
        }
    };

  const handleFileSelect = (file: File | null) => {
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please upload a valid image file (e.g., PNG, JPG).');
        return;
      }
      setImageFile(file);
      setOriginalImageUrl(URL.createObjectURL(file));
      setGeneratedContent(null);
      setError(null);

      if (tool.id === 'copy-assistant') {
          handleCopierAnalysis(file);
      }
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFileSelect(e.dataTransfer.files[0]);
          e.dataTransfer.clearData();
      }
  };
  
  const clearImage = () => {
    setImageFile(null);
    if (originalImageUrl) {
        URL.revokeObjectURL(originalImageUrl);
    }
    setOriginalImageUrl(null);
    setGeneratedContent(null);
    if (tool.id === 'copy-assistant') {
        // Reset the assistant workflow
        setCopierState({
            step: 'upload', analysisResult: null, userResponses: {}, finalEditPlan: null
        });
    }
  };

  const handleEnhancePrompt = async () => {
    if (!prompt || isEnhancing) return;
    setIsEnhancing(true);
    setError(null);
    try {
        let enhanced;
        if (tool.id === 'image-generator') {
            enhanced = await geminiService.enhanceImageGenerationPrompt(prompt);
        } else {
            enhanced = await geminiService.enhanceImageEditPrompt(prompt);
        }
        setPrompt(enhanced);
        setCreationContext(ctx => ({...ctx, topic: enhanced}));
    } catch(err) {
        setError(err instanceof Error ? err.message : 'Failed to enhance prompt.');
    } finally {
        setIsEnhancing(false);
    }
  };
  
  const handleSummarizeAndNavigate = async () => {
      if (!transcript || isSummarizing) return;
      setIsSummarizing(true);
      setError(null);
      try {
          const topic = await geminiService.summarizeForTopic(transcript);
          onNavigateToTool('title-generator', { topic, transcript });
      } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to generate topic.');
      } finally {
          setIsSummarizing(false);
      }
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (tool.id === 'copy-assistant' || tool.id === 'thumbnail-downloader') return;

    setIsLoading(true);
    setError(null);
    setGeneratedContent(null);

    try {
      let result;
      switch (tool.id) {
        case 'transcript-generator':
          if (!prompt) {
            setError('Please enter a YouTube video URL.');
            setIsLoading(false);
            return;
          }
          result = await geminiService.getYouTubeTranscript(prompt);
          setCreationContext(ctx => ({...ctx, transcript: result}));
          break;
        case 'image-generator':
          if (!prompt) {
            setError('Please enter a prompt to generate an image.');
            setIsLoading(false);
            return;
          }
          result = await geminiService.generateImage(prompt);
          break;
        case 'thumbnail-generator':
          if (!imageFile || !prompt) {
            setError('Please upload an image and provide an editing prompt.');
            setIsLoading(false);
            return;
          }
          const base64Image = await fileToBase64(imageFile);
          const mimeType = imageFile.type;
          result = await geminiService.editImage(base64Image, mimeType, prompt);
          break;
        case 'title-generator':
        case 'idea-generator':
        case 'tag-generator':
        case 'name-generator':
        case 'shorts-idea-generator':
          if (!prompt) {
             setError('Please enter a topic or keywords.');
             setIsLoading(false);
             return;
          }
          if (tool.id === 'title-generator') result = await geminiService.generateTitles(prompt);
          if (tool.id === 'idea-generator') result = await geminiService.generateContentIdeas(prompt);
          if (tool.id === 'tag-generator') result = await geminiService.generateTags(prompt);
          if (tool.id === 'name-generator') result = await geminiService.generateChannelNames(prompt);
          if (tool.id === 'shorts-idea-generator') result = await geminiService.generateShortsIdeas(prompt);
          break;
        case 'x-financial-thread':
          if (!prompt) {
             setError('Please enter a company name.');
             setIsLoading(false);
             return;
          }
          result = await geminiService.generateFinancialThread(prompt);
          break;
        case 'description-generator':
           if (!transcript && !prompt) {
             setError('Please enter a video transcript or a topic/title.');
             setIsLoading(false);
             return;
          }
          result = await geminiService.generateDescription(transcript, prompt);
          break;
        case 'hooks-generator':
        case 'script-generator':
           if (!prompt) {
             setError('Please enter a video topic.');
             setIsLoading(false);
             return;
          }
           if (tool.id === 'hooks-generator') result = await geminiService.generateHooks(prompt);
           if (tool.id === 'script-generator') result = await geminiService.generateScript(prompt);
          break;
        case 'chapter-generator':
           if (!transcript) {
             setError('Please enter a video transcript.');
             setIsLoading(false);
             return;
          }
          result = await geminiService.generateChapters(transcript);
          break;
        default:
          throw new Error('Selected tool not implemented.');
      }

      if (result !== undefined) {
          setGeneratedContent(result);
          onSaveAsProject(prompt || creationContext.topic || 'Untitled Project', tool.id, result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [tool.id, prompt, imageFile, transcript, setCreationContext, onSaveAsProject, creationContext.topic]);

  const renderNextSteps = () => {
    if (!generatedContent) return null;

    const toolNextSteps: { [key: string]: { label: string; description: string; toolId: string; context?: Partial<CreationContext> }[] } = {
        'transcript-generator': [
            { label: 'Write Description', description: 'Use the transcript to create an SEO-optimized description.', toolId: 'description-generator', context: { transcript: generatedContent } },
            { label: 'Generate Chapters', description: 'Automatically create timestamps and chapters for viewers.', toolId: 'chapter-generator', context: { transcript: generatedContent } }
        ],
        'image-generator': [
            { label: 'Edit with AI', description: 'Fine-tune your new image with text and effects.', toolId: 'thumbnail-generator', context: { topic: prompt } },
            { label: 'Generate Titles', description: 'Craft the perfect title to match your new visual.', toolId: 'title-generator', context: { topic: prompt } }
        ],
        'thumbnail-generator': [{ label: 'Generate Titles', description: 'Now that your thumbnail is ready, get title ideas.', toolId: 'title-generator', context: { topic: prompt } }],
        'idea-generator': [
            { label: 'Generate Titles', description: 'Turn your best idea into a list of catchy titles.', toolId: 'title-generator', context: { topic: prompt } },
            { label: 'Write Script', description: 'Expand your idea into a full, shoot-ready script.', toolId: 'script-generator', context: { topic: prompt } }
        ],
        'shorts-idea-generator': [
            { label: 'Write Script', description: 'Create a short, punchy script for your Shorts idea.', toolId: 'script-generator', context: { topic: prompt } },
            { label: 'Generate Titles', description: 'Get title ideas that are perfect for Shorts.', toolId: 'title-generator', context: { topic: prompt } }
        ],
        'title-generator': [
            { label: 'Write Description', description: 'Draft a description using your new title and topic.', toolId: 'description-generator', context: { topic: prompt, selectedTitle: (generatedContent as TitleGenerationResponse)?.best_title?.text || prompt } },
            { label: 'Generate Tags', description: 'Find the best SEO tags for your chosen title.', toolId: 'tag-generator', context: { topic: prompt } }
        ],
        'description-generator': [{ label: 'Generate Chapters', description: 'Add timestamps to your new description.', toolId: 'chapter-generator', context: { transcript: transcript } }],
        'tag-generator': [{ label: 'Generate Titles', description: 'Optimize your video further with a great title.', toolId: 'title-generator' }],
        'hooks-generator': [{ label: 'Write Full Script', description: 'Integrate your hook into a complete video script.', toolId: 'script-generator', context: { topic: prompt } }],
        'chapter-generator': [{ label: 'Write Description', description: 'Finalize your description by adding these chapters.', toolId: 'description-generator', context: { transcript: transcript } }],
        'script-generator': [{ label: 'Generate Hooks', description: 'Create a powerful opening for your new script.', toolId: 'hooks-generator', context: { topic: prompt } }],
        'name-generator': [{ label: 'Brainstorm Video Ideas', description: 'Now you have a name, let\'s find some video ideas.', toolId: 'idea-generator', context: { topic: prompt } }],
    };

    const steps = toolNextSteps[tool.id] || [];
    
    const NextStepCard: React.FC<{
        onClick: () => void;
        icon: React.ReactNode;
        title: string;
        description: string;
    }> = ({ onClick, icon, title, description }) => (
        <button
            type="button"
            onClick={onClick}
            className="w-full text-left p-4 bg-white rounded-xl border border-gray-200 hover:border-brand-red hover:shadow-lg transition-all flex items-center gap-4 group"
        >
            <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 group-hover:bg-red-100 group-hover:text-brand-red transition-colors">
                {icon && React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-6 h-6"})}
            </div>
            <div>
                <h6 className="font-bold text-gray-800 group-hover:text-brand-red transition-colors">{title}</h6>
                <p className="text-sm text-gray-500">{description}</p>
            </div>
        </button>
    );

    return (
        <div className="mt-8 p-6 bg-gray-50/70 rounded-2xl border border-gray-200/80">
            <h5 className="font-bold text-xl text-center text-gray-800 mb-2">🚀 What's Next?</h5>
             <div className="text-center text-sm text-green-800 mb-6 flex items-center justify-center gap-2 font-semibold bg-green-100 p-2 rounded-lg">
                <CheckCircleIcon className="w-5 h-5" />
                <span>Content automatically saved to Projects Workspace.</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {steps.map(step => {
                    const nextTool = tools.find(t => t.id === step.toolId);
                    if (!nextTool) return null;
                    return (
                        <NextStepCard
                            key={step.toolId}
                            onClick={() => onNavigateToTool(step.toolId, step.context)}
                            icon={nextTool.icon}
                            title={step.label}
                            description={step.description}
                        />
                    );
                })}
                { (tool.id === 'description-generator' || tool.id === 'chapter-generator' || tool.id === 'transcript-generator') && transcript && (
                    <NextStepCard
                        onClick={handleSummarizeAndNavigate}
                        icon={isSummarizing ? <SpinnerIcon className="w-6 h-6 animate-spin" /> : <SparklesIcon />}
                        title={isSummarizing ? 'Summarizing...' : 'Suggest Topic & Titles'}
                        description="Summarize this transcript into a core topic and get title ideas."
                    />
                 )}
            </div>
        </div>
    );
  };
  
    const renderGeneratedList = (items: string[]) => (
         <div className="mt-6">
            <ul className="list-none space-y-3">
            {items.map((item, index) => 
                <li key={index} className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm flex justify-between items-center gap-4">
                <p className="text-gray-700 flex-grow">{item}</p>
                </li>
            )}
            </ul>
        </div>
    );
    
    const renderGeneratedText = (text: string, title: string) => (
        <div className="mt-6">
            {title && <h4 className="font-semibold mb-3 text-gray-800">{title}</h4>}
            <div className="whitespace-pre-wrap text-gray-700 bg-white p-4 rounded-lg border border-gray-200 font-mono text-sm shadow-sm max-h-96 overflow-y-auto">{text}</div>
        </div>
    );
    
    const renderQuestionInput = (question: string, index: number) => {
        const questionKey = `question_${index}`;
        const lowerQuestion = question.toLowerCase();

        // Heuristic for input type
        if (lowerQuestion.includes('upload') || lowerQuestion.includes('face')) {
            return (
                <div key={questionKey}>
                    <label className="block text-sm font-medium text-gray-700">{question}</label>
                    <input
                        type="file"
                        accept="image/png, image/jpeg"
                        className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
                        onChange={(e) => {
                            // A real implementation would upload this file. Here, we just record the name for the plan.
                            const fileName = e.target.files?.[0]?.name || 'No file selected';
                            setCopierState(s => ({...s, userResponses: {...s.userResponses, [question]: fileName }}));
                        }}
                    />
                </div>
            );
        }

        return (
            <div key={questionKey}>
                <label className="block text-sm font-medium text-gray-700">{question}</label>
                 <div className="relative w-full mt-1">
                    <WriteIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 peer-focus:text-brand-red transition-colors pointer-events-none" />
                    <input
                        type="text"
                        className="peer w-full px-3 py-2 pl-10 bg-gray-50/70 border-2 border-transparent rounded-lg focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white transition-all shadow-sm text-gray-900 placeholder:text-gray-400 sm:text-sm"
                        value={copierState.userResponses[question] || ''}
                        onChange={(e) => setCopierState(s => ({...s, userResponses: {...s.userResponses, [question]: e.target.value}}))}
                    />
                </div>
            </div>
        );
    };

    const renderTitleGenerationResponse = (content: TitleGenerationResponse) => (
        <div className="mt-6 space-y-6">
            <div>
                <h4 className="font-bold text-lg text-gray-800 mb-3">🏆 Best Title</h4>
                <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg shadow-md">
                    <p className="text-xl font-bold text-green-900">{content.best_title.text}</p>
                    <p className="text-sm text-green-700 mt-2">{content.best_title.reason}</p>
                </div>
            </div>
             <div>
                <h5 className="font-semibold text-gray-700 mb-2">💡 Thumbnail Text Idea</h5>
                <p className="text-gray-600 p-3 bg-gray-50 rounded-md border text-sm font-mono">"{content.notes}"</p>
            </div>
            <div>
                <h4 className="font-bold text-lg text-gray-800 mb-3">⭐ Top Picks</h4>
                <div className="space-y-3">
                    {content.top_picks.map((pick, index) => (
                        <div key={index} className="p-4 bg-white border border-gray-200 rounded-lg">
                            <p className="font-semibold text-gray-800">{pick.text}</p>
                            <p className="text-sm text-gray-500 mt-1">{pick.reason}</p>
                        </div>
                    ))}
                </div>
            </div>
            <details className="bg-gray-50/50 p-4 rounded-lg border">
                <summary className="font-semibold text-gray-700 cursor-pointer">Show All {content.titles.length} Title Options</summary>
                <div className="mt-4 space-y-3">
                    {content.titles.map((title, index) => (
                        <div key={index} className="p-3 bg-white border rounded-md">
                            <p className="font-medium">{title.text} <span className="text-xs text-gray-400">({title.char_count} chars)</span></p>
                            <p className="text-xs text-gray-600 mt-1 italic">"{title.rationale}"</p>
                            <div className="mt-2 text-xs flex flex-wrap gap-x-4 gap-y-1">
                                <span title="CTR Score" className="font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded">CTR: {title.scores.ctr_score.toFixed(1)}</span>
                                <span title="Clarity" className="font-mono">Clarity: {title.scores.clarity}</span>
                                <span title="Curiosity" className="font-mono">Curiosity: {title.scores.curiosity}</span>
                                <span title="Specificity" className="font-mono">Specificity: {title.scores.specificity}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </details>
        </div>
    );

    const renderDescriptionGenerationResponse = (content: DescriptionGenerationResponse) => (
        <div className="mt-6 space-y-6">
            <div>
                <h4 className="font-bold text-lg text-gray-800 mb-3">📄 Generated Description</h4>
                <div className="whitespace-pre-wrap text-gray-700 bg-white p-4 rounded-lg border border-gray-200 font-sans text-sm shadow-sm">{content.description}</div>
            </div>
            {content.pinned_comment && (
                <div>
                    <h5 className="font-semibold text-gray-700 mb-2">📌 Suggested Pinned Comment</h5>
                    <p className="text-gray-600 p-3 bg-gray-50 rounded-md border text-sm italic">"{content.pinned_comment}"</p>
                </div>
            )}
             {content.chapters && content.chapters.length > 0 && (
                <div>
                    <h5 className="font-semibold text-gray-700 mb-2">🕒 Chapters</h5>
                    <div className="p-3 bg-gray-50 rounded-md border text-sm space-y-1">
                        {content.chapters.map(ch => <p key={ch.timestamp}><code className="font-mono">{ch.timestamp}</code> - {ch.title}</p>)}
                    </div>
                </div>
             )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {content.hashtags && content.hashtags.length > 0 && (
                    <div>
                        <h5 className="font-semibold text-gray-700 mb-2">#️⃣ Hashtags</h5>
                        <div className="flex flex-wrap gap-2">
                           {content.hashtags.map(tag => <code key={tag} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">{tag}</code>)}
                        </div>
                    </div>
                 )}
                  {content.keywords && content.keywords.length > 0 && (
                    <div>
                        <h5 className="font-semibold text-gray-700 mb-2">🔑 Keywords</h5>
                         <div className="flex flex-wrap gap-2">
                           {content.keywords.map(kw => <code key={kw} className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-md">{kw}</code>)}
                        </div>
                    </div>
                 )}
            </div>
        </div>
    );

    const renderScriptGenerationResponse = (content: ScriptGenerationResponse) => (
        <div className="mt-6 space-y-6">
            <div>
                <h4 className="font-bold text-lg text-gray-800 mb-3">📜 Script Breakdown</h4>
                <div className="flex gap-4 p-3 bg-gray-50 rounded-lg border">
                    <div><strong>Tone:</strong> <span className="capitalize">{content.metadata.tone}</span></div>
                    <div><strong>Estimated Duration:</strong> <span>{content.metadata.estimated_duration}</span></div>
                    <div><strong>Language:</strong> <span className="uppercase">{content.metadata.language}</span></div>
                </div>
            </div>
            <div className="space-y-4">
                {[...content.sections, content.midroll_cta, content.final_cta].filter(Boolean).map((section: ScriptSection | ScriptCTA, index) => (
                    <div key={index} className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
                        <h5 className="font-bold text-gray-800 capitalize mb-2 border-b pb-2">
                            {(section as ScriptSection).id ? (section as ScriptSection).id.replace('_', ' ') : (index === content.sections.length ? 'Mid-Roll CTA' : 'Final CTA')}
                             {(section.time_range) && <span className="text-sm font-normal text-gray-500 ml-2">({section.time_range})</span>}
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="space-y-3">
                                <p><strong className="text-gray-600 block">🎙️ Narration:</strong> {section.narration}</p>
                                { (section as ScriptSection).beats && <p><strong className="text-gray-600 block"> Beats:</strong> {(section as ScriptSection).beats?.join(', ')}</p>}
                                <p><strong className="text-gray-600 block">📝 On-Screen Text:</strong> {section.on_screen_text}</p>
                            </div>
                            <div className="space-y-3 text-gray-600 bg-gray-50 p-3 rounded-md border">
                                <p><strong className="text-gray-600 block">🎬 Visuals / B-Roll:</strong> {section.visuals_broll.join('; ')}</p>
                                {(section as ScriptSection).graphics && <p><strong className="text-gray-600 block">🎨 Graphics:</strong> {(section as ScriptSection).graphics.join('; ')}</p>}
                                {(section as ScriptSection).sfx_music && <p><strong className="text-gray-600 block">🎵 SFX / Music:</strong> {(section as ScriptSection).sfx_music.join('; ')}</p>}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <details className="bg-gray-50/50 p-4 rounded-lg border">
                <summary className="font-semibold text-gray-700 cursor-pointer">Show Alternatives</summary>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <h6 className="font-semibold">Hooks</h6>
                        <ul className="list-disc list-inside text-sm text-gray-600">{content.alternatives.hooks.map((h, i) => <li key={i}>{h}</li>)}</ul>
                    </div>
                     <div>
                        <h6 className="font-semibold">CTAs</h6>
                        <ul className="list-disc list-inside text-sm text-gray-600">{content.alternatives.ctas.map((c, i) => <li key={i}>{c}</li>)}</ul>
                    </div>
                     <div>
                        <h6 className="font-semibold">Title Ideas</h6>
                        <ul className="list-disc list-inside text-sm text-gray-600">{content.alternatives.title_ideas.map((t, i) => <li key={i}>{t}</li>)}</ul>
                    </div>
                </div>
            </details>
        </div>
    );

    const renderShortsIdeaResponse = (content: ShortsGenerationResponse) => (
        <div className="mt-6 space-y-6">
            {content.ideas.map((idea, index) => (
                <div key={index} className="p-6 bg-white border border-gray-200 rounded-2xl shadow-sm transition-all hover:shadow-lg hover:border-gray-300">
                    <h4 className="font-bold text-xl text-gray-800 mb-3">{idea.title}</h4>
                    <div className="mb-4">
                        <h5 className="font-semibold text-sm text-gray-600 mb-2">🎣 Hooks</h5>
                        <ul className="list-none space-y-2">
                            {idea.hooks.map((hook, hookIndex) => (
                                <li key={hookIndex} className="text-gray-700 bg-gray-50/70 p-3 rounded-lg border border-gray-200/80 text-sm italic">
                                    "{hook}"
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <h5 className="font-semibold text-sm text-gray-600 mb-2">📝 Outline</h5>
                        <p className="text-gray-700 bg-gray-50/70 p-3 rounded-lg border border-gray-200/80 text-sm">
                            {idea.description}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );

  const renderToolUI = () => {
    switch (tool.id) {
      case 'transcript-generator':
        return (
          <>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">YouTube Video URL</label>
            <div className="relative w-full">
                <WriteIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 peer-focus:text-brand-red transition-colors pointer-events-none" />
                <input 
                  id="prompt" 
                  type="url"
                  value={prompt} 
                  onChange={(e) => { setPrompt(e.target.value) }} 
                  placeholder="e.g., https://www.youtube.com/watch?v=..." 
                  className="peer w-full p-3 pl-12 bg-gray-50/70 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white transition-all shadow-sm text-gray-900 placeholder:text-gray-500"
                />
            </div>
            {isLoading && !generatedContent && <div className="text-center p-8 text-gray-500">Fetching transcript... This may take a moment.</div>}
            {generatedContent && typeof generatedContent === 'string' && 
                renderGeneratedText(generatedContent, '📄 Generated Transcript:')
            }
          </>
        );
       case 'thumbnail-downloader':
        return (
          <>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">YouTube Video URL</label>
            <div className="relative w-full">
                <WriteIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 peer-focus:text-brand-red transition-colors pointer-events-none" />
                <input 
                  id="prompt" 
                  type="url"
                  value={prompt} 
                  onChange={(e) => { setPrompt(e.target.value) }} 
                  placeholder="e.g., https://www.youtube.com/watch?v=..." 
                  className="peer w-full p-3 pl-12 bg-gray-50/70 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white transition-all shadow-sm text-gray-900 placeholder:text-gray-500"
                />
            </div>
            
            {videoID ? (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { quality: 'maxresdefault', label: 'HD Quality', resolution: '1280x720' },
                        { quality: 'sddefault', label: 'SD Quality', resolution: '640x480' },
                        { quality: 'hqdefault', label: 'Normal Quality', resolution: '480x360' },
                    ].map(({ quality, label, resolution }) => (
                         <div key={quality} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden group">
                            <img 
                                src={`https://img.youtube.com/vi/${videoID}/${quality}.jpg`} 
                                alt={`${label} thumbnail`}
                                className="w-full object-cover aspect-video bg-gray-100"
                                // Add an error handler for maxresdefault which might not exist
                                onError={(e) => {
                                    if (quality === 'maxresdefault') {
                                        (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoID}/hqdefault.jpg`;
                                    }
                                }}
                            />
                            <div className="p-4">
                                <h4 className="font-bold text-gray-800">{label}</h4>
                                <p className="text-sm text-gray-500">{resolution}</p>
                                <a 
                                    href={`https://img.youtube.com/vi/${videoID}/${quality}.jpg`} 
                                    download={`thumbnail_${videoID}_${quality}.jpg`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-brand-red hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-md transition-all text-sm"
                                >
                                    <DownloadIcon className="w-4 h-4" />
                                    Download
                                </a>
                            </div>
                         </div>
                    ))}
                </div>
            ) : (
                <div className="text-center p-8 text-gray-500 bg-gray-50/70 rounded-lg mt-6">
                    <p>Paste a YouTube video URL above to see the available thumbnails.</p>
                </div>
            )}
          </>
        );
      case 'image-generator':
        return (
            <div className="space-y-6">
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">Describe the thumbnail you want to create</label>
                         <button type="button" onClick={handleEnhancePrompt} disabled={!prompt || isEnhancing || isLoading} className="text-xs font-semibold text-brand-red hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors">
                            {isEnhancing ? 'Enhancing...' : '✨ Enhance with AI'}
                        </button>
                    </div>
                    <div className="relative w-full">
                      <WriteIcon className="absolute left-4 top-4 h-5 w-5 text-gray-400 peer-focus:text-brand-red transition-colors pointer-events-none" />
                      <textarea id="prompt" value={prompt} onChange={(e) => { setPrompt(e.target.value); setCreationContext(ctx => ({...ctx, topic: e.target.value})) }} placeholder="e.g., A hyper-realistic photo of an astronaut riding a horse on Mars, cinematic lighting." rows={4} className="peer w-full p-4 pl-12 bg-gray-50/70 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white transition-all shadow-sm text-gray-900 placeholder:text-gray-500"/>
                    </div>
                </div>
                <div>
                     <h4 className="font-semibold mb-2 text-center text-gray-600">Generated Thumbnail</h4>
                     <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 overflow-hidden shadow-inner relative group">
                        {isLoading ? (
                            <div className="flex flex-col items-center gap-2">
                                <SpinnerIcon className="animate-spin h-6 w-6 text-brand-red" />
                                <span>Generating... This may take a moment.</span>
                            </div>
                        ) : generatedContent && typeof generatedContent === 'string' ? (
                          <>
                            <img src={generatedContent} alt="Generated" className="object-cover w-full h-full" />
                            <a href={generatedContent} download="generated-image.jpg" aria-label="Download image" className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/75 transition-opacity opacity-0 group-hover:opacity-100">
                                <DownloadIcon className="h-5 w-5" />
                            </a>
                          </>
                        ) : (
                          <span>AI Result</span>
                        )}
                     </div>
                </div>
            </div>
        );
      case 'thumbnail-generator':
        return (
          <div className="grid lg:grid-cols-2 gap-8 items-start">
            <div className="space-y-6">
              <div>
                <label htmlFor="image-upload" className="block text-sm font-medium text-gray-700 mb-2">1. Upload Thumbnail</label>
                <div className="mt-1">
                   {originalImageUrl && imageFile ? (
                    <div className="relative group">
                      <img src={originalImageUrl} alt="Thumbnail preview" className="w-full h-auto rounded-lg shadow-md object-cover aspect-video" />
                       <button onClick={clearImage} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/75 transition-opacity opacity-0 group-hover:opacity-100">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                       </button>
                       <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 rounded-b-lg truncate">
                        {imageFile.name}
                      </div>
                    </div>
                  ) : (
                    <div
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        className={`flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md transition-colors ${isDraggingOver ? 'border-brand-red bg-red-50' : 'border-gray-300'}`}
                    >
                      <div className="space-y-1 text-center">
                        <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                        <div className="flex text-sm text-gray-600">
                          <label htmlFor="image-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-brand-red hover:text-red-700 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-brand-red">
                            <span>{isDraggingOver ? "Drop your image here" : "Upload a file"}</span>
                            <input id="image-upload" name="image-upload" type="file" className="sr-only" accept="image/png, image/jpeg, image/gif" onChange={handleImageChange} />
                          </label>
                          {!isDraggingOver && <p className="pl-1">or drag and drop</p>}
                        </div>
                        <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                 <div className="flex justify-between items-center mb-2">
                    <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">2. Describe Your Edit</label>
                    <button type="button" onClick={handleEnhancePrompt} disabled={!prompt || isEnhancing || isLoading} className="text-xs font-semibold text-brand-red hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors">
                        {isEnhancing ? 'Enhancing...' : '✨ Enhance with AI'}
                    </button>
                 </div>
                 <div className="relative w-full">
                    <WriteIcon className="absolute left-4 top-4 h-5 w-5 text-gray-400 peer-focus:text-brand-red transition-colors pointer-events-none" />
                    <textarea id="prompt" value={prompt} onChange={(e) => { setPrompt(e.target.value); setCreationContext(ctx => ({...ctx, topic: e.target.value})) }} placeholder="e.g., Make the background blurry and add the text 'SECRET WEAPON' in a bold, yellow font." rows={4} className="peer w-full p-4 pl-12 bg-gray-50/70 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white transition-all shadow-sm text-gray-900 placeholder:text-gray-500"/>
                 </div>
              </div>
            </div>
             {/* Preview Section */}
            <div className="space-y-4">
                 <div>
                     <h4 className="font-semibold mb-2 text-center text-gray-600">Generated</h4>
                     <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 overflow-hidden shadow-inner relative group">
                        {isLoading ? (
                            <div className="flex flex-col items-center gap-2">
                                <SpinnerIcon className="animate-spin h-6 w-6 text-brand-red"/>
                                <span>Generating...</span>
                            </div>
                        ) : generatedContent && typeof generatedContent === 'string' ? (
                          <>
                            <img src={generatedContent} alt="Generated" className="object-cover w-full h-full" />
                            <a href={generatedContent} download="generated-thumbnail.png" aria-label="Download image" className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/75 transition-opacity opacity-0 group-hover:opacity-100">
                                <DownloadIcon className="h-5 w-5" />
                            </a>
                          </>
                        ) : (
                          <span>AI Result</span>
                        )}
                     </div>
                  </div>
            </div>
          </div>
        );
      case 'x-financial-thread':
          return (
            <>
                <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">Publicly Traded Company Name</label>
                <div className="relative w-full">
                    <WriteIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 peer-focus:text-brand-red transition-colors pointer-events-none" />
                    <input 
                      id="prompt" 
                      type="text"
                      value={prompt} 
                      onChange={(e) => { setPrompt(e.target.value) }} 
                      placeholder="e.g., Apple, Reliance Industries, etc." 
                      className="peer w-full p-3 pl-12 bg-gray-50/70 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white transition-all shadow-sm text-gray-900 placeholder:text-gray-500"
                    />
                </div>
                {isLoading && !generatedContent && <div className="text-center p-8 text-gray-500">Analyzing company and generating thread... This might take a moment.</div>}
                {generatedContent && Array.isArray(generatedContent) && <FinancialThreadResponseView thread={generatedContent} />}
            </>
        );
      case 'shorts-idea-generator':
        return (
            <>
                <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">Video Topic or Keywords</label>
                <div className="relative w-full">
                    <WriteIcon className="absolute left-4 top-4 h-5 w-5 text-gray-400 peer-focus:text-brand-red transition-colors pointer-events-none" />
                    <textarea id="prompt" value={prompt} onChange={(e) => { setPrompt(e.target.value); setCreationContext(ctx => ({...ctx, topic: e.target.value})) }} placeholder="e.g., Easy 30-second magic tricks" rows={4} className="peer w-full p-4 pl-12 bg-gray-50/70 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white transition-all shadow-sm text-gray-900 placeholder:text-gray-500"/>
                </div>
                {isLoading && !generatedContent && <div className="text-center p-8 text-gray-500">Generating Shorts ideas...</div>}
                {generatedContent && typeof generatedContent === 'object' && 'ideas' in generatedContent && renderShortsIdeaResponse(generatedContent)}
            </>
        );
      case 'idea-generator':
      case 'tag-generator':
      case 'name-generator':
        const placeholdersList: {[key: string]: string} = {
            'idea-generator': 'e.g., Profitable side hustles for beginners in 2024',
            'tag-generator': 'e.g., MacBook Pro M3 review for video editing',
            'name-generator': 'e.g., Gaming, cooking, or tech reviews',
        }
        const labelTextList = tool.id === 'name-generator' ? 'Channel Topic or Niche' : 'Video Topic or Keywords';

        return (
          <>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">{labelTextList}</label>
            <div className="relative w-full">
                <WriteIcon className="absolute left-4 top-4 h-5 w-5 text-gray-400 peer-focus:text-brand-red transition-colors pointer-events-none" />
                <textarea id="prompt" value={prompt} onChange={(e) => { setPrompt(e.target.value); setCreationContext(ctx => ({...ctx, topic: e.target.value})) }} placeholder={placeholdersList[tool.id]} rows={4} className="peer w-full p-4 pl-12 bg-gray-50/70 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white transition-all shadow-sm text-gray-900 placeholder:text-gray-500"/>
            </div>
            {isLoading && !generatedContent && <div className="text-center p-8 text-gray-500">Generating suggestions...</div>}
            {generatedContent && Array.isArray(generatedContent) && renderGeneratedList(generatedContent)}
          </>
        );
      case 'title-generator':
      case 'hooks-generator':
        const placeholders: {[key: string]: string} = {
            'title-generator': 'e.g., A review of the new Gemini 2.5 Pro model',
            'hooks-generator': 'e.g., The biggest mistake new YouTubers make',
        }
        return (
          <>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">Video Topic or Keywords</label>
            <div className="relative w-full">
                <WriteIcon className="absolute left-4 top-4 h-5 w-5 text-gray-400 peer-focus:text-brand-red transition-colors pointer-events-none" />
                <textarea id="prompt" value={prompt} onChange={(e) => { setPrompt(e.target.value); setCreationContext(ctx => ({...ctx, topic: e.target.value})) }} placeholder={placeholders[tool.id]} rows={4} className="peer w-full p-4 pl-12 bg-gray-50/70 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white transition-all shadow-sm text-gray-900 placeholder:text-gray-500"/>
            </div>
            {isLoading && !generatedContent && <div className="text-center p-8 text-gray-500">Generating suggestions...</div>}
            {tool.id === 'hooks-generator' && generatedContent && Array.isArray(generatedContent) && renderGeneratedList(generatedContent)}
            {tool.id === 'title-generator' && generatedContent && typeof generatedContent === 'object' && 'best_title' in generatedContent && renderTitleGenerationResponse(generatedContent)}
          </>
        );
      case 'copy-assistant':
        return (
            <div className="space-y-6">
                 <div>
                    <label htmlFor="image-upload" className="block text-lg font-bold text-gray-800 mb-2">1. Upload Reference Thumbnail</label>
                    {originalImageUrl && imageFile ? (
                        <div className="relative group">
                        <img src={originalImageUrl} alt="Reference thumbnail" className="w-full h-auto rounded-lg shadow-md object-cover aspect-video" />
                        <button onClick={clearImage} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/75 transition-opacity opacity-0 group-hover:opacity-100">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        </div>
                    ) : (
                        <div
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            className={`flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md transition-colors ${isDraggingOver ? 'border-brand-red bg-red-50' : 'border-gray-300'}`}
                        >
                        <div className="space-y-1 text-center">
                            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                            <div className="flex text-sm text-gray-600">
                            <label htmlFor="image-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-brand-red hover:text-red-700 focus-within:outline-none">
                                <span>{isDraggingOver ? "Drop to upload" : "Upload a competitor's thumbnail"}</span>
                                <input id="image-upload" name="image-upload" type="file" className="sr-only" accept="image/png, image/jpeg" onChange={handleImageChange} />
                            </label>
                             {!isDraggingOver && <p className="pl-1">or drag and drop</p>}
                            </div>
                            <p className="text-xs text-gray-500">The AI will analyze it and ask for your edits.</p>
                        </div>
                        </div>
                    )}
                 </div>

                {copierState.step === 'analyzing' && <div className="text-center p-4 flex items-center justify-center gap-3 text-gray-600"><SpinnerIcon className="w-6 h-6 mx-auto text-brand-red animate-spin"/> Analyzing Style Specs...</div>}
                
                {copierState.step === 'ask_questions' && copierState.analysisResult && (
                    <div className="grid lg:grid-cols-2 gap-8 items-start">
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800">2. Analysis Result (Style Spec)</h3>
                            <div className="p-4 bg-gray-50 rounded-lg border max-h-[500px] overflow-y-auto font-mono text-xs shadow-inner">
                               <pre className="whitespace-pre-wrap">{JSON.stringify(copierState.analysisResult.style_spec, null, 2)}</pre>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800">3. Specify Your Changes</h3>
                            <div className="p-4 bg-white border rounded-lg space-y-4 shadow-sm">
                                {copierState.analysisResult.questions.map((q, i) => renderQuestionInput(q, i))}
                            </div>
                        </div>
                    </div>
                )}
                
                {copierState.step === 'planning' && <div className="text-center p-4 flex items-center justify-center gap-3 text-gray-600"><SpinnerIcon className="w-6 h-6 mx-auto text-brand-red animate-spin"/> Generating Edit Plan...</div>}

                {copierState.step === 'done' && copierState.finalEditPlan && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-gray-800">4. Final Edit Plan</h3>
                        <div className="p-4 bg-gray-800 text-green-300 rounded-lg border border-gray-600 max-h-[500px] overflow-y-auto font-mono text-xs shadow-inner">
                            <pre className="whitespace-pre-wrap">{JSON.stringify(copierState.finalEditPlan, null, 2)}</pre>
                        </div>
                    </div>
                )}
            </div>
        );
      case 'description-generator':
         return (
          <>
            {creationContext.selectedTitle && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg shadow-sm">
                <p className="text-sm text-gray-600">Continuing with title:</p>
                <p className="font-semibold text-blue-800">"{creationContext.selectedTitle}"</p>
              </div>
            )}
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">Video Topic / Title</label>
            <div className="relative w-full">
                <WriteIcon className="absolute left-4 top-4 h-5 w-5 text-gray-400 peer-focus:text-brand-red transition-colors pointer-events-none" />
                <textarea id="prompt" value={prompt} onChange={(e) => { setPrompt(e.target.value); setCreationContext(ctx => ({...ctx, topic: e.target.value, selectedTitle: ''})) }} placeholder="Enter the topic or title for your video here..." rows={3} className="peer w-full p-4 pl-12 bg-gray-50/70 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white transition-all shadow-sm text-gray-900 placeholder:text-gray-500"/>
            </div>
            
            <div className="my-4 text-center text-gray-500 text-sm font-semibold">OR</div>

            <label htmlFor="transcript" className="block text-sm font-medium text-gray-700 mb-2">Video Transcript</label>
            <div className="relative w-full">
                <WriteIcon className="absolute left-4 top-4 h-5 w-5 text-gray-400 peer-focus:text-brand-red transition-colors pointer-events-none" />
                <textarea id="transcript" value={transcript} onChange={(e) => { setTranscript(e.target.value); setCreationContext(ctx => ({...ctx, transcript: e.target.value})) }} placeholder="Paste your full video transcript here for a more detailed description..." rows={8} className="peer w-full p-4 pl-12 bg-gray-50/70 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white transition-all shadow-sm text-gray-900 placeholder:text-gray-500"/>
            </div>
            
            {isLoading && !generatedContent && <div className="text-center p-8 text-gray-500">Generating description...</div>}
            {generatedContent && typeof generatedContent === 'object' && 'description' in generatedContent && renderDescriptionGenerationResponse(generatedContent)}
          </>
        );
      case 'chapter-generator':
         return (
          <>
            <label htmlFor="transcript" className="block text-sm font-medium text-gray-700 mb-2">Video Transcript</label>
            <div className="relative w-full">
                <WriteIcon className="absolute left-4 top-4 h-5 w-5 text-gray-400 peer-focus:text-brand-red transition-colors pointer-events-none" />
                <textarea id="transcript" value={transcript} onChange={(e) => { setTranscript(e.target.value); setCreationContext(ctx => ({...ctx, transcript: e.target.value})) }} placeholder="Paste your full video transcript here to get started..." rows={10} className="peer w-full p-4 pl-12 bg-gray-50/70 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white transition-all shadow-sm text-gray-900 placeholder:text-gray-500"/>
            </div>
            {isLoading && !generatedContent && <div className="text-center p-8 text-gray-500">Analyzing transcript...</div>}
            {generatedContent && typeof generatedContent === 'string' && renderGeneratedText(generatedContent, '🕒 Generated Chapters:')}
          </>
        );
      case 'script-generator':
        return (
          <>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">Video Topic or Idea</label>
            <div className="relative w-full">
                <WriteIcon className="absolute left-4 top-4 h-5 w-5 text-gray-400 peer-focus:text-brand-red transition-colors pointer-events-none" />
                <textarea id="prompt" value={prompt} onChange={(e) => { setPrompt(e.target.value); setCreationContext(ctx => ({...ctx, topic: e.target.value})) }} placeholder="e.g., How to create a successful YouTube channel from scratch in 30 days" rows={4} className="peer w-full p-4 pl-12 bg-gray-50/70 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white transition-all shadow-sm text-gray-900 placeholder:text-gray-500"/>
            </div>
            {isLoading && !generatedContent && <div className="text-center p-8 text-gray-500">Writing your script...</div>}
            {generatedContent && typeof generatedContent === 'object' && 'metadata' in generatedContent && renderScriptGenerationResponse(generatedContent)}
          </>
        );
      default:
        return <p>This tool is coming soon!</p>;
    }
  };
  
  const submitButtonText = tool.id === 'copy-assistant' ? 'Generate Edit Plan' : 'Generate';
  const showSubmitButton = tool.id !== 'copy-assistant' && tool.id !== 'thumbnail-downloader';

  return (
    <form onSubmit={tool.id === 'copy-assistant' ? handleCopierPlanGeneration : handleSubmit} className="space-y-6">
        <div>{renderToolUI()}</div>
        {error && <p className="text-red-500 mt-4 text-sm font-medium text-center">{error}</p>}
        
        {showSubmitButton && (
          <div className="pt-2 flex justify-end">
            <button type="submit" disabled={isLoading} className="bg-brand-red hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 ease-in-out disabled:bg-red-300 disabled:cursor-not-allowed transform hover:scale-105 disabled:scale-100 flex items-center gap-2 shadow-md">
              {isLoading ? (
                  <>
                      <SpinnerIcon className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                      {copierState.step === 'planning' ? 'Planning...' : 'Generating...'}
                  </>
              ) : (
                  <>
                      <SparklesIcon className="h-5 w-5"/>
                      {submitButtonText}
                  </>
              )}
            </button>
          </div>
        )}
        {generatedContent && renderNextSteps()}
      </form>
  );
};

export default ToolView;
