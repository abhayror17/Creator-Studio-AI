import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Tool, TitleGenerationResponse, DescriptionGenerationResponse, ScriptGenerationResponse, ScriptSection, ScriptCTA, ShortsGenerationResponse, ShortsTitleDescResponse, XReplyGenerationResponse } from '../types';
import * as geminiService from '../services/geminiService';
import { DownloadIcon, SparklesIcon, WriteIcon, CheckCircleIcon, SpinnerIcon, ClipboardIcon, ClipboardCheckIcon, XIcon, BriefcaseIcon, ShortsMagicIcon } from './Icons';
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
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow flex gap-4 items-start">
            <div className="flex-shrink-0 w-10 h-10 bg-black dark:bg-white rounded-full flex items-center justify-center text-white dark:text-black shadow-md">
                <XIcon className="w-5 h-5" />
            </div>
            <div className="flex-grow">
                <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200 font-sans text-[15px] leading-relaxed">{text}</p>
            </div>
            <button 
                onClick={handleCopyClick}
                className="p-2 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                title="Copy post"
            >
                {isCopied ? <ClipboardCheckIcon className="w-5 h-5 text-green-500" /> : <ClipboardIcon className="w-5 h-5" />}
            </button>
        </div>
    );
};

// Component for rendering the financial thread response.
const FinancialThreadResponseView: React.FC<{ thread: string[] }> = ({ thread }) => {
    const [isAllCopied, copyAll] = useCopyToClipboard();
    
    const handleCopyAll = () => {
        const fullThread = thread.join('\n\n');
        copyAll(fullThread);
    };

    return (
        <div className="mt-8 space-y-6">
            <div className="flex justify-between items-center">
                <h4 className="font-bold text-xl text-gray-800 dark:text-white">Generated X Thread</h4>
                <button
                    onClick={handleCopyAll}
                    className="flex items-center gap-2 text-sm font-semibold text-white px-5 py-2.5 rounded-full bg-gray-900 hover:bg-black dark:bg-white dark:text-black dark:hover:bg-gray-200 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                    {isAllCopied ? <ClipboardCheckIcon className="w-4 h-4" /> : <ClipboardIcon className="w-4 h-4" />}
                    {isAllCopied ? 'Copied!' : 'Copy Full Thread'}
                </button>
            </div>
            <div className="space-y-4 relative">
                <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-gray-200 dark:bg-gray-700 -z-10"></div>
                {thread.map((post, index) => (
                    <div key={index} className="relative pl-0">
                         <TweetCard text={post} onCopy={() => {}} />
                    </div>
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
    if (!url) return null;
    // Handle regular YouTube links, shorts, and youtu.be links
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
};


const ToolView: React.FC<ToolViewProps> = ({ tool, creationContext, setCreationContext, onNavigateToTool, onSaveAsProject, tools }) => {
  const [prompt, setPrompt] = useState('');
  const [transcript, setTranscript] = useState('');
  const [videoID, setVideoID] = useState<string | null>(null);
  
  // State for X Post Reply Generator
  const [replyTone, setReplyTone] = useState('Witty');
  const [replyGoal, setReplyGoal] = useState('Drive Engagement');
  
  useEffect(() => {
    // For transcript/downloader generator, don't pre-fill with topic
    if (tool.id === 'transcript-generator' || tool.id === 'thumbnail-downloader' || tool.id === 'x-video-downloader') {
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


  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  // State for Veo Video Generator
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(tool.id === 'shorts-video-generator');
  const [loadingMessage, setLoadingMessage] = useState('');
  const pollingIntervalRef = useRef<number | null>(null);


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
      if (file.type.startsWith('image/')) {
        setImageFile(file);
        setOriginalImageUrl(URL.createObjectURL(file));
        setGeneratedContent(null);
        setError(null);

        if (tool.id === 'copy-assistant') {
            handleCopierAnalysis(file);
        }
      } else if (file.type.startsWith('video/')) {
        setVideoFile(file);
        setVideoPreviewUrl(URL.createObjectURL(file));
        setGeneratedContent(null);
        setError(null);
      } else {
        setError('Please upload a valid image or video file.');
        return;
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
  
  const clearFile = () => {
    setImageFile(null);
    setVideoFile(null);
    if (originalImageUrl) URL.revokeObjectURL(originalImageUrl);
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    
    setOriginalImageUrl(null);
    setVideoPreviewUrl(null);
    setGeneratedContent(null);

    if (tool.id === 'copy-assistant') {
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
  
    const cleanupPolling = () => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
    };

    useEffect(() => {
        if (tool.id === 'shorts-video-generator') {
            const checkKey = async () => {
                const hasKey = await (window as any).aistudio.hasSelectedApiKey();
                setHasApiKey(hasKey);
                setIsCheckingApiKey(false);
            };
            checkKey();
        }
        return cleanupPolling;
    }, [tool.id]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (['copy-assistant', 'thumbnail-downloader', 'shorts-video-generator'].includes(tool.id)) return;

    setIsLoading(true);
    setError(null);
    setGeneratedContent(null);

    try {
      let result;
      switch (tool.id) {
        case 'x-video-downloader':
          if (!prompt) {
              setError('Please enter an X post URL.');
              setIsLoading(false);
              return;
          }
          result = await geminiService.getXVideoDownloadLink(prompt);
          break;
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
        case 'x-viral-post':
          if (!prompt) {
             setError('Please enter a topic for the post.');
             setIsLoading(false);
             return;
          }
          result = await geminiService.generateViralXPost(prompt);
          break;
        case 'x-post-reply':
          if (!prompt) {
             setError('Please enter the original post content or URL.');
             setIsLoading(false);
             return;
          }
          result = await geminiService.generateXPostReply(prompt, replyTone, replyGoal);
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
        case 'shorts-title-desc-generator':
            if (!videoFile) {
                setError('Please upload a short video file.');
                setIsLoading(false);
                return;
            }
            const base64Video = await fileToBase64(videoFile);
            result = await geminiService.generateShortsTitleDescFromVideo(base64Video, videoFile.type);
            break;
        default:
          // Just log for dev, but let it fall through to the return if needed
          console.warn('Selected tool logic not explicitly handled in handleSubmit:', tool.id);
          break;
      }

      if (result !== undefined) {
          setGeneratedContent(result);
          onSaveAsProject(prompt || creationContext.topic || videoFile?.name || 'Untitled Project', tool.id, result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [tool.id, prompt, imageFile, videoFile, transcript, setCreationContext, onSaveAsProject, creationContext.topic, replyTone, replyGoal]);
  
  const handleVideoGenerationSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt) {
            setError('Please enter a prompt to generate the video.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setGeneratedContent(null);
        setLoadingMessage('Initializing video generation...');

        try {
            const initialOp = await geminiService.startVideoGeneration(prompt);
            setLoadingMessage('Video generation started. This process can take several minutes. Please wait...');

            pollingIntervalRef.current = window.setInterval(async () => {
                try {
                    setLoadingMessage('Checking progress... Your video is being created.');
                    const updatedOp = await geminiService.checkVideoGenerationStatus(initialOp);

                    if (updatedOp.done) {
                        cleanupPolling();
                        setLoadingMessage('Finalizing video...');
                        const downloadLink = updatedOp.response?.generatedVideos?.[0]?.video?.uri;
                        if (downloadLink && process.env.API_KEY) {
                            const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
                            const videoBlob = await videoResponse.blob();
                            const videoUrl = URL.createObjectURL(videoBlob);
                            setGeneratedContent(videoUrl);
                            onSaveAsProject(prompt, tool.id, videoUrl);
                        } else {
                            throw new Error('Video generation finished, but no download link was found.');
                        }
                        setIsLoading(false);
                    }
                } catch (pollError) {
                    if (pollError instanceof Error && pollError.message.includes('Requested entity was not found')) {
                        setError('Your API key is invalid or has expired. Please select a new one.');
                        setHasApiKey(false); // Force re-selection
                        cleanupPolling();
                        setIsLoading(false);
                    } else {
                        // Keep polling on other transient errors
                        setLoadingMessage('A temporary issue occurred. Still trying...');
                    }
                }
            }, 10000); // Poll every 10 seconds

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start video generation.');
            if (err instanceof Error && err.message.includes('Requested entity was not found')) {
                setHasApiKey(false); // Force re-selection
            }
            setIsLoading(false);
        }
    }, [prompt, tool.id, onSaveAsProject]);

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
        'x-viral-post': [
            { label: 'Generate Replies', description: 'Draft some potential replies for your new viral post.', toolId: 'x-post-reply', context: { topic: generatedContent as string } },
            { label: 'Generate Another Post', description: 'Create another viral post on a different topic.', toolId: 'x-viral-post', context: { topic: '' } }
        ],
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
            className="w-full text-left p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-red dark:hover:border-brand-red hover:shadow-lg transition-all flex items-center gap-4 group"
        >
            <div className="flex-shrink-0 w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:bg-red-50 dark:group-hover:bg-red-900/30 group-hover:text-brand-red transition-colors">
                {icon && React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-6 h-6"})}
            </div>
            <div>
                <h6 className="font-bold text-gray-800 dark:text-gray-100 group-hover:text-brand-red transition-colors">{title}</h6>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-snug">{description}</p>
            </div>
        </button>
    );

    return (
        <div className="mt-10 p-8 bg-gray-50/70 dark:bg-gray-800/30 rounded-3xl border border-gray-200/80 dark:border-gray-700/80">
            <h5 className="font-bold text-xl text-center text-gray-800 dark:text-white mb-3">🚀 What's Next?</h5>
             <div className="text-center text-sm text-green-800 dark:text-green-300 mb-8 flex items-center justify-center gap-2 font-semibold bg-green-100 dark:bg-green-900/30 py-2 px-4 rounded-full inline-flex mx-auto">
                <CheckCircleIcon className="w-4 h-4" />
                <span>Content automatically saved to Projects Workspace.</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <li key={index} className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm flex justify-between items-center gap-4 text-gray-800 dark:text-gray-200">
                <p className="flex-grow">{item}</p>
                </li>
            )}
            </ul>
        </div>
    );
    
    const renderGeneratedText = (text: string, title: string) => (
        <div className="mt-6">
            {title && <h4 className="font-semibold mb-3 text-gray-800 dark:text-gray-200">{title}</h4>}
            <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 font-mono text-sm shadow-sm max-h-[500px] overflow-y-auto">{text}</div>
        </div>
    );
    
    const renderQuestionInput = (question: string, index: number) => {
        const questionKey = `question_${index}`;
        const lowerQuestion = question.toLowerCase();

        // Heuristic for input type
        if (lowerQuestion.includes('upload') || lowerQuestion.includes('face')) {
            return (
                <div key={questionKey}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{question}</label>
                    <input
                        type="file"
                        accept="image/png, image/jpeg"
                        className="mt-1 block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 dark:file:bg-violet-900/30 file:text-violet-700 dark:file:text-violet-300 hover:file:bg-violet-100 dark:hover:file:bg-violet-900/50 transition-colors"
                        onChange={(e) => {
                            const fileName = e.target.files?.[0]?.name || 'No file selected';
                            setCopierState(s => ({...s, userResponses: {...s.userResponses, [question]: fileName }}));
                        }}
                    />
                </div>
            );
        }

        return (
            <div key={questionKey}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{question}</label>
                 <div className="relative w-full mt-1">
                    <WriteIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500 peer-focus:text-brand-red transition-colors pointer-events-none" />
                    <input
                        type="text"
                        className="peer w-full px-4 py-2.5 pl-10 bg-gray-50/70 dark:bg-gray-800/50 border-2 border-transparent rounded-lg focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white dark:focus:bg-gray-800 transition-all shadow-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 sm:text-sm"
                        value={copierState.userResponses[question] || ''}
                        onChange={(e) => setCopierState(s => ({...s, userResponses: {...s.userResponses, [question]: e.target.value}}))}
                    />
                </div>
            </div>
        );
    };

    const renderTitleGenerationResponse = (content: TitleGenerationResponse) => (
        <div className="mt-8 space-y-8">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/10 p-6 rounded-2xl border border-green-200 dark:border-green-800/50 shadow-sm">
                <h4 className="font-bold text-lg text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
                    🏆 Best Title Suggestion
                </h4>
                <p className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">{content.best_title.text}</p>
                <p className="text-sm text-green-800 dark:text-green-300 mt-3 font-medium flex items-center gap-2">
                    <span className="bg-green-200 dark:bg-green-800 px-2 py-0.5 rounded text-xs uppercase tracking-wider">Why</span>
                    {content.best_title.reason}
                </p>
            </div>
            
             <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-xl border border-blue-100 dark:border-blue-800/30">
                <h5 className="font-bold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
                    💡 Thumbnail Text Idea
                </h5>
                <p className="text-blue-800 dark:text-blue-200 text-lg font-bold">"{content.notes}"</p>
            </div>

            <div>
                <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-4">⭐ Top Alternative Picks</h4>
                <div className="grid gap-4">
                    {content.top_picks.map((pick, index) => (
                        <div key={index} className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-brand-red/30 transition-colors">
                            <p className="font-bold text-lg text-gray-900 dark:text-white">{pick.text}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{pick.reason}</p>
                        </div>
                    ))}
                </div>
            </div>

            <details className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 group">
                <summary className="font-semibold text-gray-700 dark:text-gray-300 cursor-pointer flex items-center justify-between">
                    <span>Show All {content.titles.length} Title Options & Scores</span>
                    <svg className="w-5 h-5 text-gray-500 transform group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7 7" /></svg>
                </summary>
                <div className="mt-4 space-y-3">
                    {content.titles.map((title, index) => (
                        <div key={index} className="p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg">
                            <div className="flex justify-between items-start gap-4">
                                <p className="font-medium text-gray-900 dark:text-white text-lg">{title.text}</p>
                                <span className="text-xs text-gray-400 whitespace-nowrap">{title.char_count} chars</span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 italic">"{title.rationale}"</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <span title="CTR Score" className="text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 px-2 py-1 rounded">CTR: {title.scores.ctr_score.toFixed(1)}</span>
                                <span title="Clarity" className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">Clarity: {title.scores.clarity}</span>
                                <span title="Curiosity" className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">Curiosity: {title.scores.curiosity}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </details>
        </div>
    );

    const renderDescriptionGenerationResponse = (content: DescriptionGenerationResponse) => (
        <div className="mt-8 space-y-8">
            <div>
                <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-3">📄 Generated Description</h4>
                <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 font-sans text-base shadow-sm leading-relaxed">
                    {content.description}
                </div>
            </div>
            
            {content.pinned_comment && (
                <div className="bg-purple-50 dark:bg-purple-900/10 p-5 rounded-xl border border-purple-100 dark:border-purple-800/30">
                    <h5 className="font-bold text-purple-900 dark:text-purple-100 mb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
                        📌 Suggested Pinned Comment
                    </h5>
                    <p className="text-purple-800 dark:text-purple-200 italic">"{content.pinned_comment}"</p>
                </div>
            )}
            
             {content.chapters && content.chapters.length > 0 && (
                <div>
                    <h5 className="font-bold text-gray-800 dark:text-white mb-3">🕒 Chapters</h5>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-sm space-y-2 text-gray-700 dark:text-gray-300 font-mono">
                        {content.chapters.map(ch => (
                            <div key={ch.timestamp} className="flex gap-4 border-b border-gray-200 dark:border-gray-700 last:border-0 pb-2 last:pb-0">
                                <span className="text-blue-600 dark:text-blue-400 font-bold w-12">{ch.timestamp}</span>
                                <span>{ch.title}</span>
                            </div>
                        ))}
                    </div>
                </div>
             )}
             
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {content.hashtags && content.hashtags.length > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
                        <h5 className="font-bold text-gray-700 dark:text-gray-200 mb-3 text-sm uppercase tracking-wider">#️⃣ Hashtags</h5>
                        <div className="flex flex-wrap gap-2">
                           {content.hashtags.map(tag => <code key={tag} className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">{tag}</code>)}
                        </div>
                    </div>
                 )}
                  {content.keywords && content.keywords.length > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
                        <h5 className="font-bold text-gray-700 dark:text-gray-200 mb-3 text-sm uppercase tracking-wider">🔑 Keywords</h5>
                         <div className="flex flex-wrap gap-2">
                           {content.keywords.map(kw => <span key={kw} className="text-xs bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded border border-gray-200 dark:border-gray-600">{kw}</span>)}
                        </div>
                    </div>
                 )}
            </div>
        </div>
    );

    const renderScriptGenerationResponse = (content: ScriptGenerationResponse) => (
        <div className="mt-8 space-y-8">
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">Tone</p>
                    <p className="text-gray-800 dark:text-white font-semibold capitalize">{content.metadata.tone}</p>
                </div>
                <div className="border-l border-r border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">Duration</p>
                    <p className="text-gray-800 dark:text-white font-semibold">{content.metadata.estimated_duration}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">Language</p>
                    <p className="text-gray-800 dark:text-white font-semibold uppercase">{content.metadata.language}</p>
                </div>
            </div>
            
            <div className="space-y-6 relative">
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700 -z-10 hidden md:block"></div>
                {[...content.sections, content.midroll_cta, content.final_cta].filter(Boolean).map((section: ScriptSection | ScriptCTA, index) => (
                    <div key={index} className="md:pl-14 relative">
                        <div className="hidden md:flex absolute left-2 top-6 w-8 h-8 bg-white dark:bg-gray-800 border-2 border-brand-red rounded-full items-center justify-center text-xs font-bold text-brand-red z-10">
                            {index + 1}
                        </div>
                        
                        <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex flex-wrap justify-between items-center mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">
                                <h5 className="font-bold text-lg text-gray-800 dark:text-white capitalize">
                                    {(section as ScriptSection).id ? (section as ScriptSection).id.replace('_', ' ') : (index === content.sections.length ? 'Mid-Roll CTA' : 'Final CTA')}
                                </h5>
                                {section.time_range && (
                                    <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-mono px-2 py-1 rounded">
                                        {section.time_range}
                                    </span>
                                )}
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <span className="text-xs font-bold text-brand-red uppercase tracking-wider mb-1 block">🎙️ Narration</span>
                                        <p className="text-gray-800 dark:text-gray-200 leading-relaxed text-lg font-medium">"{section.narration}"</p>
                                    </div>
                                    {section.on_screen_text && (
                                        <div>
                                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1 block">📝 On-Screen Text</span>
                                            <p className="text-gray-700 dark:text-gray-300 bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-100 dark:border-blue-800/30 inline-block">
                                                {section.on_screen_text}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700 space-y-3 text-sm">
                                    <div>
                                        <strong className="text-gray-900 dark:text-white block mb-1">🎬 Visuals / B-Roll</strong>
                                        <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1">
                                            {section.visuals_broll.map((v, i) => <li key={i}>{v}</li>)}
                                        </ul>
                                    </div>
                                    {(section as ScriptSection).graphics && (section as ScriptSection).graphics.length > 0 && (
                                        <div>
                                            <strong className="text-gray-900 dark:text-white block mb-1">🎨 Graphics</strong>
                                            <p className="text-gray-600 dark:text-gray-400">{(section as ScriptSection).graphics.join(', ')}</p>
                                        </div>
                                    )}
                                    {(section as ScriptSection).sfx_music && (section as ScriptSection).sfx_music.length > 0 && (
                                        <div>
                                            <strong className="text-gray-900 dark:text-white block mb-1">🎵 SFX / Music</strong>
                                            <p className="text-gray-600 dark:text-gray-400 italic">{(section as ScriptSection).sfx_music.join(', ')}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            
            <details className="bg-gray-50 dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700">
                <summary className="font-bold text-gray-700 dark:text-gray-300 cursor-pointer hover:text-brand-red dark:hover:text-brand-red transition-colors">
                    Show Alternative Options (Hooks, CTAs, Titles)
                </summary>
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <h6 className="font-bold text-gray-900 dark:text-white mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">🎣 Alternate Hooks</h6>
                        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">{content.alternatives.hooks.map((h, i) => <li key={i} className="p-2 bg-white dark:bg-gray-700 rounded shadow-sm">{h}</li>)}</ul>
                    </div>
                     <div>
                        <h6 className="font-bold text-gray-900 dark:text-white mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">📢 Alternate CTAs</h6>
                        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">{content.alternatives.ctas.map((c, i) => <li key={i} className="p-2 bg-white dark:bg-gray-700 rounded shadow-sm">{c}</li>)}</ul>
                    </div>
                     <div>
                        <h6 className="font-bold text-gray-900 dark:text-white mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">🏷️ Alternate Titles</h6>
                        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">{content.alternatives.title_ideas.map((t, i) => <li key={i} className="p-2 bg-white dark:bg-gray-700 rounded shadow-sm">{t}</li>)}</ul>
                    </div>
                </div>
            </details>
        </div>
    );

    const renderShortsIdeaResponse = (content: ShortsGenerationResponse) => (
        <div className="mt-8 space-y-6">
            {content.ideas.map((idea, index) => (
                <div key={index} className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <h4 className="font-bold text-xl text-gray-900 dark:text-white leading-tight">{idea.title}</h4>
                        <span className="bg-red-100 dark:bg-red-900/30 text-brand-red text-xs font-bold px-2 py-1 rounded uppercase">Short</span>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <h5 className="font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">🎣 Viral Hooks</h5>
                            <ul className="space-y-2">
                                {idea.hooks.map((hook, hookIndex) => (
                                    <li key={hookIndex} className="text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700 text-sm font-medium">
                                        "{hook}"
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h5 className="font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">📝 Concept Outline</h5>
                            <p className="text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700 text-sm leading-relaxed">
                                {idea.description}
                            </p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
    
    const renderShortsTitleDescResponse = (content: ShortsTitleDescResponse) => {
        const [isTitleCopied, copyTitle] = useCopyToClipboard();
        const [isDescCopied, copyDesc] = useCopyToClipboard();

        return (
            <div className="mt-8 space-y-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-bold text-lg text-gray-800 dark:text-white">Generated Title</h4>
                        <button onClick={() => copyTitle(content.title)} className="text-sm font-semibold text-brand-red hover:text-red-700 flex items-center gap-1 bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full transition-colors">
                             {isTitleCopied ? <ClipboardCheckIcon className="w-4 h-4" /> : <ClipboardIcon className="w-4 h-4" />}
                             {isTitleCopied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{content.title}</p>
                </div>
                
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-bold text-lg text-gray-800 dark:text-white">Generated Description</h4>
                        <button onClick={() => copyDesc(content.description)} className="text-sm font-semibold text-brand-red hover:text-red-700 flex items-center gap-1 bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full transition-colors">
                             {isDescCopied ? <ClipboardCheckIcon className="w-4 h-4" /> : <ClipboardIcon className="w-4 h-4" />}
                             {isDescCopied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{content.description}</p>
                </div>
                
                 <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700">
                    <h4 className="font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Suggested Hashtags</h4>
                    <div className="flex flex-wrap gap-2">
                        {content.hashtags.map(tag => <span key={tag} className="text-sm font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-700 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-900 shadow-sm">{tag}</span>)}
                    </div>
                </div>
            </div>
        );
    };

  const renderToolUI = () => {
    switch (tool.id) {
      case 'x-video-downloader':
        return (
            <>
                <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">X (Twitter) Post URL</label>
                <div className="relative w-full">
                    <WriteIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500 peer-focus:text-brand-red transition-colors pointer-events-none" />
                    <input
                      id="prompt"
                      type="url"
                      value={prompt}
                      onChange={(e) => { setPrompt(e.target.value) }}
                      placeholder="e.g., https://x.com/username/status/12345..."
                      className="peer w-full p-4 pl-12 bg-gray-50/70 dark:bg-gray-800/50 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white dark:focus:bg-gray-800 transition-all shadow-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-600"
                    />
                </div>
                {isLoading && <div className="text-center p-8 text-gray-500 dark:text-gray-400 flex flex-col items-center"><SpinnerIcon className="w-8 h-8 text-brand-red mb-2 animate-spin"/>Finding video...</div>}
                {generatedContent && typeof generatedContent === 'string' && (
                     <div className="mt-8 space-y-4">
                        <video
                            src={generatedContent}
                            controls
                            className="w-full max-w-md mx-auto rounded-xl shadow-xl bg-black"
                        />
                        <a
                            href={generatedContent}
                            download="x_video.mp4"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 w-full max-w-md mx-auto inline-flex items-center justify-center gap-2 bg-brand-red hover:bg-red-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md transform hover:scale-105"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            Download Video
                        </a>
                     </div>
                )}
            </>
        );
      case 'transcript-generator':
        return (
          <>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">YouTube Video URL</label>
            <div className="relative w-full">
                <WriteIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500 peer-focus:text-brand-red transition-colors pointer-events-none" />
                <input 
                  id="prompt" 
                  type="url"
                  value={prompt} 
                  onChange={(e) => { setPrompt(e.target.value) }} 
                  placeholder="e.g., https://www.youtube.com/watch?v=..." 
                  className="peer w-full p-4 pl-12 bg-gray-50/70 dark:bg-gray-800/50 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white dark:focus:bg-gray-800 transition-all shadow-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-600"
                />
            </div>
            {isLoading && !generatedContent && <div className="text-center p-12 text-gray-500 dark:text-gray-400 flex flex-col items-center"><SpinnerIcon className="w-10 h-10 text-brand-red mb-3 animate-spin"/>Fetching transcript... This may take a moment.</div>}
            {generatedContent && typeof generatedContent === 'string' && 
                renderGeneratedText(generatedContent, '📄 Generated Transcript:')
            }
          </>
        );
       case 'thumbnail-downloader':
        return (
          <>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">YouTube Video URL</label>
            <div className="relative w-full">
                <WriteIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500 peer-focus:text-brand-red transition-colors pointer-events-none" />
                <input 
                  id="prompt" 
                  type="url"
                  value={prompt} 
                  onChange={(e) => { setPrompt(e.target.value) }} 
                  placeholder="e.g., https://www.youtube.com/watch?v=..." 
                  className="peer w-full p-4 pl-12 bg-gray-50/70 dark:bg-gray-800/50 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white dark:focus:bg-gray-800 transition-all shadow-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-600"
                />
            </div>
            
            {videoID ? (
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { quality: 'maxresdefault', label: 'HD Quality', resolution: '1280x720' },
                        { quality: 'sddefault', label: 'SD Quality', resolution: '640x480' },
                        { quality: 'hqdefault', label: 'Normal Quality', resolution: '480x360' },
                    ].map(({ quality, label, resolution }) => (
                         <div key={quality} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden group hover:shadow-lg transition-all">
                            <div className="relative aspect-video bg-gray-100 dark:bg-gray-900">
                                <img 
                                    src={`https://img.youtube.com/vi/${videoID}/${quality}.jpg`} 
                                    alt={`${label} thumbnail`}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        if (quality === 'maxresdefault') {
                                            (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoID}/hqdefault.jpg`;
                                        }
                                    }}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                            </div>
                            <div className="p-5">
                                <h4 className="font-bold text-gray-900 dark:text-white">{label}</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{resolution}</p>
                                <a 
                                    href={`https://img.youtube.com/vi/${videoID}/${quality}.jpg`} 
                                    download={`thumbnail_${videoID}_${quality}.jpg`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full inline-flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-700 hover:bg-brand-red hover:text-white dark:hover:bg-brand-red text-gray-800 dark:text-gray-200 font-semibold py-2.5 px-4 rounded-xl transition-all text-sm"
                                >
                                    <DownloadIcon className="w-4 h-4" />
                                    Download
                                </a>
                            </div>
                         </div>
                    ))}
                </div>
            ) : (
                <div className="text-center p-10 text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/50 rounded-2xl mt-8 border border-dashed border-gray-200 dark:border-gray-700">
                    <p>Paste a YouTube video URL above to see the available thumbnails.</p>
                </div>
            )}
          </>
        );
      case 'image-generator':
        return (
            <div className="space-y-8">
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Describe the thumbnail you want to create</label>
                         <button type="button" onClick={handleEnhancePrompt} disabled={!prompt || isEnhancing || isLoading} className="text-xs font-bold text-brand-red hover:text-red-800 dark:hover:text-red-400 disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-not-allowed transition-colors flex items-center gap-1">
                            <SparklesIcon className="w-3 h-3"/>
                            {isEnhancing ? 'Enhancing...' : 'Enhance Prompt'}
                        </button>
                    </div>
                    <div className="relative w-full">
                      <WriteIcon className="absolute left-4 top-4 h-5 w-5 text-gray-400 dark:text-gray-500 peer-focus:text-brand-red transition-colors pointer-events-none" />
                      <textarea id="prompt" value={prompt} onChange={(e) => { setPrompt(e.target.value); setCreationContext(ctx => ({...ctx, topic: e.target.value})) }} placeholder="e.g., A hyper-realistic photo of an astronaut riding a horse on Mars, cinematic lighting." rows={4} className="peer w-full p-4 pl-12 bg-gray-50/70 dark:bg-gray-800/50 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white dark:focus:bg-gray-800 transition-all shadow-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-600"/>
                    </div>
                </div>
                <div>
                     <h4 className="font-bold mb-3 text-center text-gray-800 dark:text-gray-200">Generated Result</h4>
                     <div className="aspect-video bg-gray-100 dark:bg-gray-900 rounded-2xl flex items-center justify-center text-gray-400 dark:text-gray-600 overflow-hidden shadow-inner relative group border-2 border-dashed border-gray-200 dark:border-gray-700">
                        {isLoading ? (
                            <div className="flex flex-col items-center gap-3">
                                <SpinnerIcon className="animate-spin h-8 w-8 text-brand-red" />
                                <span className="font-medium">Generating... This may take a moment.</span>
                            </div>
                        ) : generatedContent && typeof generatedContent === 'string' ? (
                          <>
                            <img src={generatedContent} alt="Generated" className="object-cover w-full h-full" />
                            <a href={generatedContent} download="generated-image.jpg" aria-label="Download image" className="absolute top-4 right-4 bg-black/60 text-white rounded-full p-2 hover:bg-brand-red transition-all opacity-0 group-hover:opacity-100 shadow-lg transform hover:scale-110">
                                <DownloadIcon className="h-6 w-6" />
                            </a>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                              <SparklesIcon className="w-12 h-12 opacity-20"/>
                              <span>AI Result will appear here</span>
                          </div>
                        )}
                     </div>
                </div>
            </div>
        );
      case 'thumbnail-generator':
        return (
          <div className="grid lg:grid-cols-2 gap-10 items-start">
            <div className="space-y-6">
              <div>
                <label htmlFor="image-upload" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">1. Upload Thumbnail</label>
                <div className="mt-1">
                   {originalImageUrl && imageFile ? (
                    <div className="relative group">
                      <img src={originalImageUrl} alt="Thumbnail preview" className="w-full h-auto rounded-xl shadow-md object-cover aspect-video" />
                       <button onClick={clearFile} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/75 transition-opacity opacity-0 group-hover:opacity-100">
                         <XIcon className="h-4 w-4" />
                       </button>
                       <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 rounded-b-xl truncate">
                        {imageFile.name}
                      </div>
                    </div>
                  ) : (
                    <div
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        className={`flex justify-center px-6 pt-10 pb-10 border-2 border-dashed rounded-2xl transition-all duration-200 ${isDraggingOver ? 'border-brand-red bg-red-50 dark:bg-red-900/10' : 'border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    >
                      <div className="space-y-2 text-center">
                        <div className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500">
                             <svg className="w-full h-full" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                        </div>
                        <div className="flex text-sm text-gray-600 dark:text-gray-400 justify-center">
                          <label htmlFor="image-upload" className="relative cursor-pointer rounded-md font-bold text-brand-red hover:text-red-700 dark:hover:text-red-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-brand-red">
                            <span>{isDraggingOver ? "Drop your image here" : "Upload a file"}</span>
                            <input id="image-upload" name="image-upload" type="file" className="sr-only" accept="image/png, image/jpeg, image/gif" onChange={handleFileChange} />
                          </label>
                          {!isDraggingOver && <p className="pl-1">or drag and drop</p>}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-500">PNG, JPG, GIF up to 10MB</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                 <div className="flex justify-between items-center mb-2">
                    <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">2. Describe Your Edit</label>
                    <button type="button" onClick={handleEnhancePrompt} disabled={!prompt || isEnhancing || isLoading} className="text-xs font-bold text-brand-red hover:text-red-800 dark:hover:text-red-400 disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-not-allowed transition-colors flex items-center gap-1">
                        <SparklesIcon className="w-3 h-3"/>
                        {isEnhancing ? 'Enhancing...' : 'Enhance Prompt'}
                    </button>
                 </div>
                 <div className="relative w-full">
                    <WriteIcon className="absolute left-4 top-4 h-5 w-5 text-gray-400 dark:text-gray-500 peer-focus:text-brand-red transition-colors pointer-events-none" />
                    <textarea id="prompt" value={prompt} onChange={(e) => { setPrompt(e.target.value); setCreationContext(ctx => ({...ctx, topic: e.target.value})) }} placeholder="e.g., Make the background blurry and add the text 'SECRET WEAPON' in a bold, yellow font." rows={4} className="peer w-full p-4 pl-12 bg-gray-50/70 dark:bg-gray-800/50 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white dark:focus:bg-gray-800 transition-all shadow-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-600"/>
                 </div>
              </div>
            </div>
             {/* Preview Section */}
            <div className="space-y-4">
                 <div>
                     <h4 className="font-bold mb-3 text-center text-gray-800 dark:text-gray-200">Generated Result</h4>
                     <div className="aspect-video bg-gray-100 dark:bg-gray-900 rounded-2xl flex items-center justify-center text-gray-400 dark:text-gray-600 overflow-hidden shadow-inner relative group border-2 border-dashed border-gray-200 dark:border-gray-700">
                        {isLoading ? (
                            <div className="flex flex-col items-center gap-3">
                                <SpinnerIcon className="animate-spin h-8 w-8 text-brand-red"/>
                                <span className="font-medium">Processing...</span>
                            </div>
                        ) : generatedContent && typeof generatedContent === 'string' ? (
                          <>
                            <img src={generatedContent} alt="Generated" className="object-cover w-full h-full" />
                            <a href={generatedContent} download="generated-thumbnail.png" aria-label="Download image" className="absolute top-4 right-4 bg-black/60 text-white rounded-full p-2 hover:bg-brand-red transition-all opacity-0 group-hover:opacity-100 shadow-lg transform hover:scale-110">
                                <DownloadIcon className="h-6 w-6" />
                            </a>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                              <SparklesIcon className="w-12 h-12 opacity-20"/>
                              <span>AI Result will appear here</span>
                          </div>
                        )}
                     </div>
                  </div>
            </div>
          </div>
        );
      case 'x-financial-thread':
          return (
            <>
                <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Publicly Traded Company Name</label>
                <div className="relative w-full">
                    <BriefcaseIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500 peer-focus:text-brand-red transition-colors pointer-events-none" />
                    <input 
                      id="prompt" 
                      type="text"
                      value={prompt} 
                      onChange={(e) => { setPrompt(e.target.value) }} 
                      placeholder="e.g., Apple, Reliance Industries, etc." 
                      className="peer w-full p-4 pl-12 bg-gray-50/70 dark:bg-gray-800/50 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white dark:focus:bg-gray-800 transition-all shadow-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-600"
                    />
                </div>
                {isLoading && !generatedContent && <div className="text-center p-12 text-gray-500 dark:text-gray-400 flex flex-col items-center"><SpinnerIcon className="w-10 h-10 text-brand-red mb-3 animate-spin"/>Analyzing company and generating thread... This might take a moment.</div>}
                {generatedContent && Array.isArray(generatedContent) && <FinancialThreadResponseView thread={generatedContent} />}
            </>
        );
      case 'x-viral-post':
          return (
            <>
                <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Topic for your Viral Post</label>
                <div className="relative w-full">
                    <WriteIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500 peer-focus:text-brand-red transition-colors pointer-events-none" />
                    <input
                      id="prompt"
                      type="text"
                      value={prompt}
                      onChange={(e) => { setPrompt(e.target.value) }}
                      placeholder="e.g., The future of AI in content creation"
                      className="peer w-full p-4 pl-12 bg-gray-50/70 dark:bg-gray-800/50 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white dark:focus:bg-gray-800 transition-all shadow-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-600"
                    />
                </div>
                {isLoading && !generatedContent && <div className="text-center p-12 text-gray-500 dark:text-gray-400 flex flex-col items-center"><SpinnerIcon className="w-10 h-10 text-brand-red mb-3 animate-spin"/>Crafting your viral post...</div>}
                {generatedContent && typeof generatedContent === 'string' &&
                    <div className="mt-8">
                        <TweetCard text={generatedContent} onCopy={() => {}} />
                    </div>
                }
            </>
        );
      case 'x-post-reply':
        const tones = ['Witty', 'Professional', 'Supportive', 'Controversial', 'Curious'];
        const goals = ['Drive Engagement', 'Answer Question', 'Build Community', 'Add Value'];
        return (
            <div className="space-y-8">
                 <div>
                    <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Original Post Content or URL</label>
                    <div className="relative w-full">
                        <WriteIcon className="absolute left-4 top-4 h-5 w-5 text-gray-400 dark:text-gray-500 peer-focus:text-brand-red transition-colors pointer-events-none" />
                        <textarea id="prompt" value={prompt} onChange={(e) => { setPrompt(e.target.value); }} placeholder="Paste the content of the X post you want to reply to..." rows={4} className="peer w-full p-4 pl-12 bg-gray-50/70 dark:bg-gray-800/50 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white dark:focus:bg-gray-800 transition-all shadow-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-600"/>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Select a Tone</h4>
                        <div className="flex flex-wrap gap-2">
                            {tones.map(tone => (
                                <button
                                    key={tone}
                                    type="button"
                                    onClick={() => setReplyTone(tone)}
                                    className={`px-4 py-2 text-sm font-bold rounded-full border-2 transition-all ${replyTone === tone ? 'bg-brand-red text-white border-brand-red shadow-md transform scale-105' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'}`}
                                >
                                    {tone}
                                </button>
                            ))}
                        </div>
                    </div>
                     <div>
                        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Select a Goal</h4>
                        <div className="flex flex-wrap gap-2">
                            {goals.map(goal => (
                                <button
                                    key={goal}
                                    type="button"
                                    onClick={() => setReplyGoal(goal)}
                                    className={`px-4 py-2 text-sm font-bold rounded-full border-2 transition-all ${replyGoal === goal ? 'bg-brand-red text-white border-brand-red shadow-md transform scale-105' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'}`}
                                >
                                    {goal}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {isLoading && !generatedContent && <div className="text-center p-12 text-gray-500 dark:text-gray-400 flex flex-col items-center"><SpinnerIcon className="w-10 h-10 text-brand-red mb-3 animate-spin"/>Generating replies...</div>}
                {generatedContent && 'replies' in generatedContent && (
                     <div className="mt-8 space-y-4">
                        <h4 className="font-bold text-lg text-gray-800 dark:text-white">Generated Replies</h4>
                        <div className="space-y-4">
                            {(generatedContent as XReplyGenerationResponse).replies.map((reply, index) => (
                                <TweetCard key={index} text={reply} onCopy={() => {}} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
      case 'shorts-idea-generator':
        return (
            <>
                <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Video Topic or Keywords</label>
                <div className="relative w-full">
                    <WriteIcon className="absolute left-4 top-4 h-5 w-5 text-gray-400 dark:text-gray-500 peer-focus:text-brand-red transition-colors pointer-events-none" />
                    <textarea id="prompt" value={prompt} onChange={(e) => { setPrompt(e.target.value); setCreationContext(ctx => ({...ctx, topic: e.target.value})) }} placeholder="e.g., Easy 30-second magic tricks" rows={4} className="peer w-full p-4 pl-12 bg-gray-50/70 dark:bg-gray-800/50 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white dark:focus:bg-gray-800 transition-all shadow-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-600"/>
                </div>
                {isLoading && !generatedContent && <div className="text-center p-12 text-gray-500 dark:text-gray-400 flex flex-col items-center"><SpinnerIcon className="w-10 h-10 text-brand-red mb-3 animate-spin"/>Generating Shorts ideas...</div>}
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
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{labelTextList}</label>
            <div className="relative w-full">
                <WriteIcon className="absolute left-4 top-4 h-5 w-5 text-gray-400 dark:text-gray-500 peer-focus:text-brand-red transition-colors pointer-events-none" />
                <textarea id="prompt" value={prompt} onChange={(e) => { setPrompt(e.target.value); setCreationContext(ctx => ({...ctx, topic: e.target.value})) }} placeholder={placeholdersList[tool.id]} rows={4} className="peer w-full p-4 pl-12 bg-gray-50/70 dark:bg-gray-800/50 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white dark:focus:bg-gray-800 transition-all shadow-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-600"/>
            </div>
            {isLoading && !generatedContent && <div className="text-center p-12 text-gray-500 dark:text-gray-400 flex flex-col items-center"><SpinnerIcon className="w-10 h-10 text-brand-red mb-3 animate-spin"/>Generating suggestions...</div>}
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
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Video Topic or Keywords</label>
            <div className="relative w-full">
                <WriteIcon className="absolute left-4 top-4 h-5 w-5 text-gray-400 dark:text-gray-500 peer-focus:text-brand-red transition-colors pointer-events-none" />
                <textarea id="prompt" value={prompt} onChange={(e) => { setPrompt(e.target.value); setCreationContext(ctx => ({...ctx, topic: e.target.value})) }} placeholder={placeholders[tool.id]} rows={4} className="peer w-full p-4 pl-12 bg-gray-50/70 dark:bg-gray-800/50 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white dark:focus:bg-gray-800 transition-all shadow-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-600"/>
            </div>
            {isLoading && !generatedContent && <div className="text-center p-12 text-gray-500 dark:text-gray-400 flex flex-col items-center"><SpinnerIcon className="w-10 h-10 text-brand-red mb-3 animate-spin"/>Generating suggestions...</div>}
            {tool.id === 'hooks-generator' && generatedContent && Array.isArray(generatedContent) && renderGeneratedList(generatedContent)}
            {tool.id === 'title-generator' && generatedContent && typeof generatedContent === 'object' && 'best_title' in generatedContent && renderTitleGenerationResponse(generatedContent)}
          </>
        );
      case 'copy-assistant':
        return (
            <div className="space-y-8">
                 <div>
                    <label htmlFor="image-upload" className="block text-lg font-bold text-gray-800 dark:text-white mb-3">1. Upload Reference Thumbnail</label>
                    {originalImageUrl && imageFile ? (
                        <div className="relative group max-w-2xl mx-auto">
                            <img src={originalImageUrl} alt="Reference thumbnail" className="w-full h-auto rounded-2xl shadow-lg object-cover aspect-video border-4 border-white dark:border-gray-700" />
                            <button onClick={clearFile} className="absolute top-3 right-3 bg-black/50 text-white rounded-full p-2 hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 shadow-md transform hover:scale-110">
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>
                    ) : (
                        <div
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            className={`flex justify-center px-6 pt-10 pb-10 border-2 border-dashed rounded-2xl transition-all duration-200 ${isDraggingOver ? 'border-brand-red bg-red-50 dark:bg-red-900/10' : 'border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                        >
                        <div className="space-y-2 text-center">
                            <div className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500">
                                 <svg className="w-full h-full" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                            </div>
                            <div className="flex text-sm text-gray-600 dark:text-gray-400 justify-center">
                            <label htmlFor="image-upload" className="relative cursor-pointer rounded-md font-bold text-brand-red hover:text-red-700 dark:hover:text-red-400 focus-within:outline-none">
                                <span>{isDraggingOver ? "Drop to upload" : "Upload a competitor's thumbnail"}</span>
                                <input id="image-upload" name="image-upload" type="file" className="sr-only" accept="image/png, image/jpeg" onChange={handleFileChange} />
                            </label>
                             {!isDraggingOver && <p className="pl-1">or drag and drop</p>}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-500">The AI will analyze it and ask for your edits.</p>
                        </div>
                        </div>
                    )}
                 </div>

                {copierState.step === 'analyzing' && <div className="text-center p-8 text-gray-600 dark:text-gray-400 flex flex-col items-center"><SpinnerIcon className="w-8 h-8 text-brand-red mb-2 animate-spin"/> Analyzing Style Specs...</div>}
                
                {copierState.step === 'ask_questions' && copierState.analysisResult && (
                    <div className="grid lg:grid-cols-2 gap-8 items-start">
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white">2. Analysis Result (Style Spec)</h3>
                            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border dark:border-gray-700 max-h-[500px] overflow-y-auto font-mono text-xs shadow-inner text-gray-700 dark:text-gray-300">
                               <pre className="whitespace-pre-wrap">{JSON.stringify(copierState.analysisResult.style_spec, null, 2)}</pre>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white">3. Specify Your Changes</h3>
                            <div className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl space-y-5 shadow-sm">
                                {copierState.analysisResult.questions.map((q, i) => renderQuestionInput(q, i))}
                            </div>
                        </div>
                    </div>
                )}
                
                {copierState.step === 'planning' && <div className="text-center p-8 text-gray-600 dark:text-gray-400 flex flex-col items-center"><SpinnerIcon className="w-8 h-8 text-brand-red mb-2 animate-spin"/> Generating Edit Plan...</div>}

                {copierState.step === 'done' && copierState.finalEditPlan && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">4. Final Edit Plan</h3>
                        <div className="p-5 bg-gray-900 dark:bg-gray-950 text-green-400 rounded-xl border border-gray-700 max-h-[500px] overflow-y-auto font-mono text-xs shadow-inner">
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
              <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl shadow-sm">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 font-medium uppercase tracking-wider">Continuing with title:</p>
                <p className="font-bold text-blue-800 dark:text-blue-200 text-lg">"{creationContext.selectedTitle}"</p>
              </div>
            )}
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Video Topic / Title</label>
            <div className="relative w-full">
                <WriteIcon className="absolute left-4 top-4 h-5 w-5 text-gray-400 dark:text-gray-500 peer-focus:text-brand-red transition-colors pointer-events-none" />
                <textarea id="prompt" value={prompt} onChange={(e) => { setPrompt(e.target.value); setCreationContext(ctx => ({...ctx, topic: e.target.value, selectedTitle: ''})) }} placeholder="Enter the topic or title for your video here..." rows={3} className="peer w-full p-4 pl-12 bg-gray-50/70 dark:bg-gray-800/50 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white dark:focus:bg-gray-800 transition-all shadow-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-600"/>
            </div>
            
            <div className="my-6 flex items-center gap-4">
                <div className="h-px bg-gray-200 dark:bg-gray-700 flex-grow"></div>
                <span className="text-gray-400 dark:text-gray-500 text-xs font-bold uppercase tracking-wider">Optional</span>
                <div className="h-px bg-gray-200 dark:bg-gray-700 flex-grow"></div>
            </div>

            <label htmlFor="transcript" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Video Transcript (for better accuracy)</label>
            <div className="relative w-full">
                <WriteIcon className="absolute left-4 top-4 h-5 w-5 text-gray-400 dark:text-gray-500 peer-focus:text-brand-red transition-colors pointer-events-none" />
                <textarea id="transcript" value={transcript} onChange={(e) => { setTranscript(e.target.value); setCreationContext(ctx => ({...ctx, transcript: e.target.value})) }} placeholder="Paste your full video transcript here for a more detailed description..." rows={8} className="peer w-full p-4 pl-12 bg-gray-50/70 dark:bg-gray-800/50 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white dark:focus:bg-gray-800 transition-all shadow-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-600"/>
            </div>
            
            {isLoading && !generatedContent && <div className="text-center p-12 text-gray-500 dark:text-gray-400 flex flex-col items-center"><SpinnerIcon className="w-10 h-10 text-brand-red mb-3 animate-spin"/>Generating description...</div>}
            {generatedContent && typeof generatedContent === 'object' && 'description' in generatedContent && renderDescriptionGenerationResponse(generatedContent)}
          </>
        );
        case 'script-generator':
             return (
                <>
                    <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Video Topic</label>
                    <div className="relative w-full">
                        <WriteIcon className="absolute left-4 top-4 h-5 w-5 text-gray-400 dark:text-gray-500 peer-focus:text-brand-red transition-colors pointer-events-none" />
                        <textarea id="prompt" value={prompt} onChange={(e) => { setPrompt(e.target.value); setCreationContext(ctx => ({...ctx, topic: e.target.value})) }} placeholder="Enter the video topic or concept..." rows={4} className="peer w-full p-4 pl-12 bg-gray-50/70 dark:bg-gray-800/50 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white dark:focus:bg-gray-800 transition-all shadow-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-600"/>
                    </div>
                    {isLoading && !generatedContent && <div className="text-center p-12 text-gray-500 dark:text-gray-400 flex flex-col items-center"><SpinnerIcon className="w-10 h-10 text-brand-red mb-3 animate-spin"/>Generating script...</div>}
                    {generatedContent && typeof generatedContent === 'object' && 'metadata' in generatedContent && renderScriptGenerationResponse(generatedContent)}
                </>
             );
        case 'chapter-generator':
             return (
                <>
                    <label htmlFor="transcript" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Video Transcript</label>
                     <div className="relative w-full">
                        <WriteIcon className="absolute left-4 top-4 h-5 w-5 text-gray-400 dark:text-gray-500 peer-focus:text-brand-red transition-colors pointer-events-none" />
                        <textarea id="transcript" value={transcript} onChange={(e) => { setTranscript(e.target.value); setCreationContext(ctx => ({...ctx, transcript: e.target.value})) }} placeholder="Paste your video transcript here to generate chapters..." rows={10} className="peer w-full p-4 pl-12 bg-gray-50/70 dark:bg-gray-800/50 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white dark:focus:bg-gray-800 transition-all shadow-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-600"/>
                    </div>
                     {isLoading && !generatedContent && <div className="text-center p-12 text-gray-500 dark:text-gray-400 flex flex-col items-center"><SpinnerIcon className="w-10 h-10 text-brand-red mb-3 animate-spin"/>Generating chapters...</div>}
                     {generatedContent && typeof generatedContent === 'string' && renderGeneratedText(generatedContent, 'Generated Chapters')}
                </>
             );
        case 'shorts-video-generator':
             // Check API Key logic
             if (!hasApiKey) {
                 return (
                     <div className="text-center p-10 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                         <ShortsMagicIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                         <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Veo Video Generation</h3>
                         <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                             Generating videos requires a paid API key with access to the Veo model.
                             Please select a project with billing enabled.
                             <br/>
                             <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-brand-red hover:underline text-sm">Learn more about billing</a>
                         </p>
                         <button
                             onClick={() => (window as any).aistudio.openSelectKey()}
                             className="bg-brand-red hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-md"
                         >
                             Select API Key
                         </button>
                     </div>
                 );
             }
             
             return (
                 <>
                    <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Video Prompt</label>
                    <div className="relative w-full">
                        <WriteIcon className="absolute left-4 top-4 h-5 w-5 text-gray-400 dark:text-gray-500 peer-focus:text-brand-red transition-colors pointer-events-none" />
                        <textarea id="prompt" value={prompt} onChange={(e) => { setPrompt(e.target.value); setCreationContext(ctx => ({...ctx, topic: e.target.value})) }} placeholder="Describe the video you want Veo to generate..." rows={4} className="peer w-full p-4 pl-12 bg-gray-50/70 dark:bg-gray-800/50 border-2 border-transparent rounded-xl focus:ring-2 focus:ring-brand-red/70 focus:border-transparent focus:bg-white dark:focus:bg-gray-800 transition-all shadow-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-600"/>
                    </div>
                    
                     {isLoading && (
                        <div className="text-center p-12 text-gray-500 dark:text-gray-400 flex flex-col items-center space-y-4">
                            <SpinnerIcon className="w-10 h-10 text-brand-red animate-spin"/>
                            <p className="font-semibold text-lg text-gray-800 dark:text-gray-200">{loadingMessage}</p>
                            <p className="text-sm max-w-md">Video generation with Veo takes a few minutes. You can leave this tab open, we'll notify you when it's done.</p>
                        </div>
                     )}

                    {generatedContent && typeof generatedContent === 'string' && (
                        <div className="mt-8 space-y-4 text-center">
                            <h4 className="font-bold text-lg text-gray-800 dark:text-white">Generated Video</h4>
                             <video
                                src={generatedContent}
                                controls
                                autoPlay
                                loop
                                className="w-full max-w-xs mx-auto rounded-xl shadow-xl bg-black aspect-[9/16]"
                            />
                            <a
                                href={generatedContent}
                                download="shorts_video.mp4"
                                className="w-full max-w-xs mx-auto flex items-center justify-center gap-2 bg-brand-red hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md"
                            >
                                <DownloadIcon className="w-5 h-5" />
                                Download Video
                            </a>
                        </div>
                    )}
                 </>
             );
        case 'shorts-title-desc-generator':
             return (
                <div className="space-y-6">
                  <div>
                    <label htmlFor="video-upload" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Upload Short Video</label>
                    <div className="mt-1">
                       {videoFile ? (
                        <div className="relative group max-w-xs mx-auto">
                            <video src={videoPreviewUrl!} className="w-full rounded-xl shadow-md aspect-[9/16] bg-black" controls />
                           <button onClick={clearFile} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/75 transition-opacity opacity-0 group-hover:opacity-100">
                             <XIcon className="h-4 w-4" />
                           </button>
                           <div className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400 truncate">
                            {videoFile.name}
                          </div>
                        </div>
                      ) : (
                        <div
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            className={`flex justify-center px-6 pt-10 pb-10 border-2 border-dashed rounded-2xl transition-all duration-200 ${isDraggingOver ? 'border-brand-red bg-red-50 dark:bg-red-900/10' : 'border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                        >
                          <div className="space-y-2 text-center">
                            <div className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500">
                                 <svg className="w-full h-full" stroke="currentColor" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
                            </div>
                            <div className="flex text-sm text-gray-600 dark:text-gray-400 justify-center">
                              <label htmlFor="video-upload" className="relative cursor-pointer rounded-md font-bold text-brand-red hover:text-red-700 dark:hover:text-red-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-brand-red">
                                <span>{isDraggingOver ? "Drop video here" : "Upload a video"}</span>
                                <input id="video-upload" name="video-upload" type="file" className="sr-only" accept="video/*" onChange={handleFileChange} />
                              </label>
                              {!isDraggingOver && <p className="pl-1">or drag and drop</p>}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-500">MP4, MOV up to 50MB</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {isLoading && !generatedContent && <div className="text-center p-12 text-gray-500 dark:text-gray-400 flex flex-col items-center"><SpinnerIcon className="w-10 h-10 text-brand-red mb-3 animate-spin"/>Analyzing video content...</div>}
                  {generatedContent && typeof generatedContent === 'object' && 'title' in generatedContent && renderShortsTitleDescResponse(generatedContent)}
                </div>
             );
        default: 
             return <div className="p-4 text-red-500">Tool UI not implemented for {tool.id}</div>;
     }
  };
  
  return (
      <div className="max-w-4xl mx-auto">
        <form onSubmit={tool.id === 'shorts-video-generator' ? handleVideoGenerationSubmit : tool.id === 'copy-assistant' && copierState.step === 'ask_questions' ? handleCopierPlanGeneration : handleSubmit}>
             {renderToolUI()}
             
             {/* Render Submit Button if not loading and if tool requires one (most do) */}
             {/* Exclude tools that have their own flow or if loading */}
             {!isLoading && !generatedContent && !['copy-assistant', 'thumbnail-downloader', 'shorts-video-generator', 'shorts-title-desc-generator', 'x-video-downloader'].includes(tool.id) && (
                  <div className="mt-8">
                    <button type="submit" className="w-full bg-brand-red hover:bg-red-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg flex items-center justify-center gap-3">
                        <SparklesIcon className="w-6 h-6" />
                        <span>Generate Content</span>
                    </button>
                  </div>
             )}
             
             {tool.id === 'x-video-downloader' && !isLoading && !generatedContent && (
                <div className="mt-8">
                    <button type="submit" className="w-full bg-brand-red hover:bg-red-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg flex items-center justify-center gap-3">
                        <DownloadIcon className="w-6 h-6" />
                        <span>Download Video</span>
                    </button>
                </div>
             )}
             
             {tool.id === 'shorts-title-desc-generator' && videoFile && !isLoading && !generatedContent && (
                 <div className="mt-8">
                    <button type="submit" className="w-full bg-brand-red hover:bg-red-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg flex items-center justify-center gap-3">
                        <SparklesIcon className="w-6 h-6" />
                        <span>Generate Title & Description</span>
                    </button>
                  </div>
             )}

             {/* Special Submit Button for Copy Assistant Step 2 */}
             {tool.id === 'copy-assistant' && copierState.step === 'ask_questions' && !isLoading && (
                 <div className="mt-8">
                    <button type="submit" className="w-full bg-brand-red hover:bg-red-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg flex items-center justify-center gap-3">
                        <SparklesIcon className="w-6 h-6" />
                        <span>Generate Edit Plan</span>
                    </button>
                  </div>
             )}
             
             {/* Special Submit Button for Shorts Video Generator */}
             {tool.id === 'shorts-video-generator' && hasApiKey && !isLoading && !generatedContent && (
                  <div className="mt-8">
                    <button type="submit" className="w-full bg-brand-red hover:bg-red-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg flex items-center justify-center gap-3">
                        <ShortsMagicIcon className="w-6 h-6" />
                        <span>Generate Video with Veo</span>
                    </button>
                  </div>
             )}
        </form>
        
        {renderNextSteps()}
      </div>
  );
};

export default ToolView;
