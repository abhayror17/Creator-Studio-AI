import React, { useState, useCallback } from 'react';
import { Project, ProjectStatus, Tool, FeedbackComment, ShortsTitleDescResponse } from '../types';
import { BriefcaseIcon, CheckCircleIcon, ChatBubbleLeftEllipsisIcon, PaperAirplaneIcon } from './Icons';
import ToolView from './ToolView'; // Re-use the renderer from ToolView

const statusStyles: { [key in ProjectStatus]: { bg: string; text: string; } } = {
  [ProjectStatus.Draft]: { bg: 'bg-gray-100', text: 'text-gray-800' },
  [ProjectStatus.InReview]: { bg: 'bg-blue-100', text: 'text-blue-800' },
  [ProjectStatus.Approved]: { bg: 'bg-green-100', text: 'text-green-800' },
};

const statusOptions = [ProjectStatus.Draft, ProjectStatus.InReview, ProjectStatus.Approved];

interface ProjectsDashboardProps {
    projects: Project[];
    onUpdateProject: (project: Project) => void;
    tools: Tool[];
}

const ProjectsDashboard: React.FC<ProjectsDashboardProps> = ({ projects, onUpdateProject, tools }) => {
    const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
    const [newComment, setNewComment] = useState('');

    const getToolById = useCallback((toolId: string) => {
        return tools.find(t => t.id === toolId);
    }, [tools]);

    const handleToggleExpand = (projectId: string) => {
        setExpandedProjectId(prevId => (prevId === projectId ? null : projectId));
    };

    const handleStatusChange = (project: Project, newStatus: ProjectStatus) => {
        onUpdateProject({ ...project, status: newStatus });
    };

    const handleAddComment = (e: React.FormEvent, project: Project) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        const comment: FeedbackComment = {
            id: `comment_${Date.now()}`,
            author: 'Team Member', // Simulated author
            text: newComment,
            timestamp: new Date().toISOString(),
        };

        onUpdateProject({ ...project, feedback: [...project.feedback, comment] });
        setNewComment('');
    };
    
    // This is a placeholder renderer. A more robust solution would re-use the rendering
    // logic from ToolView, but that would require significant refactoring.
    // For now, we'll just stringify the content to show it works.
    const renderGeneratedContent = (project: Project) => {
         const content = project.generatedContent;

         // Simple heuristic to render different types of content
         if (typeof content === 'string') {
             if (content.startsWith('data:image')) {
                 return <img src={content} alt="Generated Thumbnail" className="rounded-lg shadow-md aspect-video object-cover" />;
             }
             if (content.startsWith('blob:')) {
                 return <video src={content} controls className="w-full rounded-lg shadow-md aspect-video" />;
             }
             return <div className="whitespace-pre-wrap p-4 bg-gray-50 border rounded-md font-mono text-sm">{content}</div>;
         }
         if (Array.isArray(content)) {
            if (project.toolId === 'x-financial-thread') {
                 return <div className="space-y-3">{content.map((post, i) => <div key={i} className="p-3 bg-gray-50 border rounded-md">{post}</div>)}</div>
            }
             return <ul className="space-y-2">{content.map((item, i) => <li key={i} className="p-3 bg-gray-50 border rounded-md">{item}</li>)}</ul>;
         }
         if (typeof content === 'object' && content !== null) {
              if (project.toolId === 'shorts-title-desc-generator' && 'title' in content) {
                const shortsContent = content as ShortsTitleDescResponse;
                return (
                    <div className="space-y-3">
                        <div>
                            <h6 className="font-semibold text-xs text-gray-500">Title</h6>
                            <p className="p-2 bg-gray-50 border rounded-md">{shortsContent.title}</p>
                        </div>
                         <div>
                            <h6 className="font-semibold text-xs text-gray-500">Description</h6>
                            <p className="p-2 bg-gray-50 border rounded-md text-sm">{shortsContent.description}</p>
                        </div>
                    </div>
                );
              }
              return <pre className="whitespace-pre-wrap p-4 bg-gray-800 text-green-300 rounded-md font-mono text-xs max-h-96 overflow-y-auto">{JSON.stringify(content, null, 2)}</pre>;
         }
         return <p>Cannot render content of this type.</p>;
    };

    return (
        <section className="max-w-4xl mx-auto mb-16">
            <div className="text-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800 flex items-center justify-center gap-3">
                    <BriefcaseIcon className="w-8 h-8 text-brand-red" />
                    <span>Projects Workspace</span>
                </h2>
                <p className="text-gray-500 mt-2">
                    Review generated content, provide feedback, and track status.
                    <span className="block text-xs mt-1">(Note: Projects are not saved permanently and will be lost on page refresh.)</span>
                </p>
            </div>

            <div className="space-y-4">
                {projects.length === 0 ? (
                    <div className="text-center p-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                        <p className="text-gray-500 font-semibold">Your workspace is empty.</p>
                        <p className="text-gray-400 text-sm mt-1">Generate content with a tool and save it as a project to get started.</p>
                    </div>
                ) : (
                    projects.map(project => {
                        const tool = getToolById(project.toolId);
                        const isExpanded = expandedProjectId === project.id;

                        return (
                            <div key={project.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 transition-all">
                                <div className="flex items-center gap-4 cursor-pointer" onClick={() => handleToggleExpand(project.id)}>
                                    <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                                        {/* FIX: Explicitly type props for cloneElement to allow passing className. */}
                                        {tool?.icon && React.cloneElement(tool.icon as React.ReactElement<{ className?: string }>, { className: "w-5 h-5" })}
                                    </div>
                                    <div className="flex-grow">
                                        <h4 className="font-bold text-gray-800">{project.title}</h4>
                                        <p className="text-xs text-gray-500">{tool?.title || 'Unknown Tool'}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyles[project.status].bg} ${statusStyles[project.status].text}`}>
                                            {project.status}
                                        </span>
                                    </div>
                                     <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Left Side: Content & Status */}
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <h5 className="font-semibold text-gray-700">Generated Content</h5>
                                                <select
                                                    value={project.status}
                                                    onChange={(e) => handleStatusChange(project, e.target.value as ProjectStatus)}
                                                    className={`text-xs font-semibold border-none rounded-full focus:ring-2 focus:ring-offset-2 ${statusStyles[project.status].bg} ${statusStyles[project.status].text}`}
                                                >
                                                    {statusOptions.map(status => (
                                                        <option key={status} value={status}>{status}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            {renderGeneratedContent(project)}
                                        </div>

                                        {/* Right Side: Feedback */}
                                        <div className="space-y-4 flex flex-col">
                                            <h5 className="font-semibold text-gray-700 flex items-center gap-2">
                                                <ChatBubbleLeftEllipsisIcon className="w-5 h-5" />
                                                Feedback
                                            </h5>
                                            <div className="flex-grow space-y-3 bg-gray-50 p-3 rounded-lg border max-h-80 overflow-y-auto">
                                                {project.feedback.length === 0 ? (
                                                     <p className="text-xs text-gray-400 text-center py-4">No feedback yet.</p>
                                                ) : (
                                                    project.feedback.map(comment => (
                                                        <div key={comment.id} className="text-sm">
                                                            <p className="p-2 bg-white rounded-md border border-gray-200">{comment.text}</p>
                                                            <div className="text-xs text-gray-400 mt-1 flex justify-between">
                                                                <span>{comment.author}</span>
                                                                <span>{new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                            <form onSubmit={(e) => handleAddComment(e, project)} className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={newComment}
                                                    onChange={(e) => setNewComment(e.target.value)}
                                                    placeholder="Add a comment..."
                                                    className="flex-grow w-full px-3 py-2 bg-white border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red/70 focus:border-transparent transition-all shadow-sm text-gray-900 placeholder:text-gray-400 sm:text-sm"
                                                />
                                                <button type="submit" className="p-2.5 bg-brand-red text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm">
                                                    <PaperAirplaneIcon className="w-5 h-5" />
                                                </button>
                                            </form>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>
        </section>
    );
};

export default ProjectsDashboard;