# Creator Studio AI: YouTube Automation Suite

Creator Studio AI is a powerful suite of professional tools designed to help YouTube creators automate their content creation workflow and scale their channel's growth. Powered by the Google Gemini API, this application provides a seamless experience from idea generation to final SEO optimization.

## ✨ Key Features

This application offers two main ways to supercharge your content creation: a fully automated agent and a collection of specialized individual tools.

### 🤖 YouTube Automation Agent

The flagship feature of the suite. Simply provide a video topic, and the AI agent will execute a complete content creation workflow, delivering:
- **Viral Titles:** A selection of click-worthy titles, with the best one automatically chosen by AI.
- **Catchy Hooks:** Engaging opening lines to capture viewer attention.
- **Full Script:** A structured video script with talking points and a call-to-action.
- **SEO-Optimized Description:** A well-written description based on the video title and content.
- **Relevant Tags:** A list of tags to improve search discovery.

### 🛠️ Individual Tools

For more granular control, you can use any of the following standalone tools:

- **Content Idea Generator:** Brainstorm viral video ideas from a keyword or niche.
- **YouTube Script Generator:** Outline full scripts with pacing and CTAs.
- **Catchy Hooks Generator:** Create engaging opening lines for better retention.
- **YouTube Title Generator:** Craft click-worthy, SEO-friendly titles.
- **YouTube Description Generator:** Draft optimized descriptions from a transcript or topic.
- **YouTube Tag Generator:** Find relevant, high-traffic tags to boost your video's ranking.
- **YT Thumbnail Generator:** Generate high-quality, unique 16:9 images from a text prompt for your YouTube thumbnails.
- **YouTube Thumbnail Editor:** Edit your existing thumbnails using simple text prompts for AI-powered modifications.
- **YouTube Chapter Generator:** Automatically propose timestamped chapters from a video transcript.
- **YouTube Name Generator:** Get ideas for unique and catchy channel names.
- **YT Thumbnail Copier:** Reconstruct a reference thumbnail with high precision and apply only your requested changes.
- **X Video Downloader:** Enter an X (Twitter) post URL to download the embedded video.

## 🚀 Technology Stack

This project leverages a modern, AI-first technology stack:

- **Frontend:**
  - **React:** For building the user interface.
  - **TypeScript:** For static typing and improved code quality.
  - **Tailwind CSS:** For rapid, utility-first styling.

- **AI & Backend Logic:**
  - **Google Gemini API (`@google/genai`):** The core engine powering all generative features.
    - **`gemini-2.5-pro`:** Used for complex, long-form content generation like video scripts and detailed descriptions.
    - **`gemini-2.5-flash`:** Used for faster, concise tasks like generating titles, tags, hooks, and orchestrating the automation workflow.
    - **`imagen-4.0-generate-001`:** The state-of-the-art model for generating high-quality images from text.
    - **`gemini-2.5-flash-image`:** Used for powerful, prompt-based image editing capabilities.
    - **Google Search Grounding:** Integrated into the Title and Trending Topics tools to provide real-time, relevant results.

## 📂 Project Structure

The codebase is organized logically to separate concerns and enhance maintainability.

```
/
├── components/
│   ├── Icons.tsx               # Reusable SVG icon components
│   ├── ToolCard.tsx            # UI for each tool on the main dashboard
│   ├── ToolPage.tsx            # Wrapper page for a selected tool
│   └── ToolView.tsx            # Core UI and logic for individual tools
├── services/
│   └── geminiService.ts        # All interactions with the Google Gemini API
├── App.tsx                     # Main application component, state management, and routing
├── index.html                  # The single HTML entry point
├── index.tsx                   # React application root
├── types.ts                    # TypeScript type definitions for the project
└── README.md                   # You are here!
```

## How It Works

The application is a single-page app (SPA) built with React. All AI functionality is handled by the `geminiService.ts` file, which acts as a dedicated layer for communicating with the Google Gemini API.

- **State Management:** The main `App.tsx` component manages the active tool and the `creationContext`, which is a shared state object that allows generated content (like a title or topic) to be passed seamlessly between different tools.
- **Dynamic UI:** The `ToolView.tsx` component dynamically renders the appropriate UI based on the `tool.id` prop it receives, making it a flexible and central part of the user experience.
- **AI Workflow:** The `runFullWorkflow` function in `geminiService.ts` demonstrates a powerful chaining pattern. It calls different Gemini models sequentially, using the output of one step as the input for the next, to fully automate the content creation process. It even uses an AI call (`selectBestOption`) to reason about and choose the most effective title from a generated list.

## ⚙️ Getting Started

This is a browser-based application with no server-side component.

1.  **API Key:** The application requires a Google Gemini API key. It is designed to be securely provided via an environment variable `process.env.API_KEY`.
2.  **Running:** Simply open the `index.html` file in a modern web browser. All dependencies are loaded via an import map from a CDN, so no local installation (`npm install`) is required.