// Fix: Added missing import for React and removed circular self-import of ToolStatus.
import React from 'react';

export enum ToolStatus {
  Live = 'Live',
  Beta = 'Beta',
  Soon = 'Soon',
}

export interface Tool {
  id: string;
  title: string;
  description: string;
  status: ToolStatus;
  tags: string[];
  icon?: React.ReactNode;
  category: string;
}

// Types for the YouTube Automation Agent Workflow
export interface ListContent {
    alternatives: string[];
    chosen: string | null;
}

export type StepContent = string | string[] | ListContent | null;

export interface WorkflowStep {
    id:string;
    label: string;
    status: 'pending' | 'running' | 'selecting' | 'completed' | 'failed';
    content: StepContent;
}

// --- New Types for Collaboration Feature ---
export enum ProjectStatus {
    Draft = 'Draft',
    InReview = 'In Review',
    Approved = 'Approved',
}

export interface FeedbackComment {
    id: string;
    author: string; // Will be simulated with "Team Member"
    text: string;
    timestamp: string;
}

export interface Project {
    id:string;
    title: string;
    toolId: string;
    generatedContent: any;
    status: ProjectStatus;
    feedback: FeedbackComment[];
}


// --- New Types for Structured Generation ---

// For Title Generator
export interface TitleScore {
  clarity: number;
  curiosity: number;
  specificity: number;
  keyword: number;
  length_fit: number;
  ctr_score: number;
}

export interface TitleOption {
  text: string;
  style_tags: string[];
  keyword_included: boolean;
  char_count: number;
  scores: TitleScore;
  rationale: string;
}

export interface TopPick {
    text: string;
    reason: string;
}

export interface TitleGenerationResponse {
  titles: TitleOption[];
  top_picks: TopPick[];
  best_title: TopPick;
  notes: string;
}

// For Description Generator
export interface Chapter {
    title: string;
    timestamp: string;
}

export interface DescriptionGenerationResponse {
    description: string;
    chapters: Chapter[];
    hashtags: string[];
    keywords: string[];
    pinned_comment: string;
}

// For Script Generator
export interface ScriptMetadata {
    estimated_duration: string;
    tone: string;
    language: string;
}

export interface ScriptSection {
    id: string;
    time_range: string;
    narration: string;
    on_screen_text: string;
    visuals_broll: string[];
    graphics: string[];
    sfx_music: string[];
    beats?: string[];
}

export interface ScriptCTA {
    time_range?: string;
    narration: string;
    on_screen_text: string;
    visuals_broll: string[];
}

export interface ScriptAlternatives {
    hooks: string[];
    ctas: string[];
    title_ideas: string[];
}

export interface ScriptGenerationResponse {
    metadata: ScriptMetadata;
    sections: ScriptSection[];
    midroll_cta: ScriptCTA;
    final_cta: ScriptCTA;
    alternatives: ScriptAlternatives;
}

// For Shorts Idea Generator
export interface ShortsIdea {
    title: string;
    hooks: string[];
    description: string;
}

export interface ShortsGenerationResponse {
    ideas: ShortsIdea[];
}