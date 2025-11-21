import { GoogleGenAI, Modality, Type, GenerateContentResponse } from "@google/genai";
import { TitleGenerationResponse, DescriptionGenerationResponse, ScriptGenerationResponse, ShortsGenerationResponse, ShortsTitleDescResponse, XReplyGenerationResponse } from '../types';

// Ensure the API key is available from environment variables
if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Helper Functions ---

/**
 * A helper to safely parse JSON from a model's text response.
 * Handles both raw JSON strings and markdown-fenced ```json ... ``` blocks.
 */
const parseJsonFromText = <T,>(text: string): T | null => {
  const match = text.match(/```json\n([\s\S]*?)\n```/);
  const jsonString = match ? match[1].trim() : text.trim();
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("Failed to parse JSON:", jsonString);
    return null;
  }
};

// --- Transcript Generation ---
export const getYouTubeTranscript = async (videoUrl: string): Promise<string> => {
    const prompt = `
You are an API calling agent. Your task is to fetch the transcript for the given YouTube video URL by making a POST request to 'https://tactiq-apps-prod.tactiq.io/transcript'.
The request body must be a JSON object with this exact structure:
{
    "videoUrl": "${videoUrl}",
    "langCode": "en"
}
The response you receive will be a JSON object containing a "captions" array. Each object in that array has a "text" property.
Your job is to extract the value of the "text" property from every object in the "captions" array.
Then, join all these text values together, separated by a newline character ('\\n').

CRITICAL: Return ONLY the final, joined transcript string. Do not include any other words, greetings, explanations, or markdown formatting.

If the API call fails for any reason, or if the "captions" array is empty or does not exist in the response, you MUST return the exact string: "No transcript could be found for this video."
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: prompt,
    });

    const transcript = response.text.trim();

    if (!transcript) {
        throw new Error("The AI model failed to return a response for the transcript request.");
    }
    
    return transcript;
};


// --- Image Generation & Editing ---

export const generateImage = async (prompt: string): Promise<string> => {
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '16:9',
        },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
        const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
        return `data:image/jpeg;base64,${base64ImageBytes}`;
    }
    
    throw new Error("No image was generated. The model may have refused the prompt.");
};

export const editImage = async (base64ImageData: string, mimeType: string, prompt: string): Promise<string> => {
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                {
                    inlineData: {
                        data: base64ImageData,
                        mimeType: mimeType,
                    },
                },
                {
                    text: prompt,
                },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    throw new Error("No image was generated. The model may have refused the prompt.");
};


// --- Text Generation ---
export const enhanceImageEditPrompt = async (prompt: string): Promise<string> => {
    const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: `A user wants to edit a YouTube thumbnail. Their instruction is: "${prompt}". 
        Enhance this instruction to be a more detailed and effective prompt for an AI image editor. 
        Focus on clarity, specific actions, and visual details. 
        For example, if the user says "add text", suggest what kind of font, color, and placement. 
        If they say "make it pop", suggest changes to saturation, contrast, or adding a glow effect.
        Return only the enhanced prompt as a single string, without any preamble.`,
    });
    return response.text.trim();
};

export const enhanceImageGenerationPrompt = async (prompt: string): Promise<string> => {
    const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: `A user wants to generate an image for a YouTube thumbnail. Their prompt is: "${prompt}". 
        Enhance this prompt to be more descriptive and detailed for a powerful AI image generation model (like Imagen). 
        Add details about style (e.g., photorealistic, cartoon, watercolor), lighting (e.g., cinematic, soft), composition, and mood. 
        Return only the enhanced prompt as a single string, without any preamble.`,
    });
    return response.text.trim();
};

export const generateTitles = async (topic: string): Promise<TitleGenerationResponse> => {
    const systemPrompt = `You are a YouTube Title Strategist. Create accurate, high-CTR, SEO-friendly titles without being misleading.

Inputs you may receive:
- topic: {topic}
- primary_keywords: {primary_keywords}   // comma-separated
- audience: {audience}
- tone_voice: {tone_voice}               // e.g., energetic, expert, friendly
- constraints: {constraints}             // e.g., avoid words, include brand, etc.
- language: {language}                   // default to input language

Rules:
- Generate 12–15 distinct title options spanning formats: How-to, List/Numbered, Vs/Comparison, Myth-bust, Case study/Results, Challenge, Tutorial, Question, News/Update.
- Keep most titles ≤ 60–65 characters; provide 2 slightly longer variants (≤ 75) if useful.
- Place a primary keyword early when natural. No ALL CAPS. Avoid clickbait, false urgency, or unverifiable claims.
- Optimize for clarity + curiosity + specificity. If the topic is time-sensitive/news, add recency cues (e.g., “2025”, “Update”, “New”).
- If language is not specified, write in the language of the input.

Scoring rubric (0–10 each): clarity, curiosity, specificity, keyword placement, length fit. Compute average as ctr_score.

Output as compact JSON only:
{
  "titles": [
    {
      "text": "...",
      "style_tags": ["how_to","curiosity_gap"],
      "keyword_included": true,
      "char_count": 0,
      "scores": { "clarity": 0, "curiosity": 0, "specificity": 0, "keyword": 0, "length_fit": 0, "ctr_score": 0.0 },
      "rationale": "1 short sentence on why it works"
    }
  ],
  "top_picks": [ { "text": "...", "reason": "..." }, { "text": "...", "reason": "..." }, { "text": "...", "reason": "..." } ],
  "best_title": { "text": "...", "reason": "why this is best for the audience/keyword intent" },
  "notes": "any quick guidance for thumbnail text (≤4 words) that pairs with the best title"
}`;

    const populatedPrompt = systemPrompt.replace('{topic}', topic)
                                        .replace('{primary_keywords}', 'N/A')
                                        .replace('{audience}', 'general')
                                        .replace('{tone_voice}', 'engaging')
                                        .replace('{constraints}', 'N/A')
                                        .replace('{language}', 'en');

    const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: populatedPrompt,
        config: {
             responseMimeType: "application/json",
        },
    });

    const titles = parseJsonFromText<TitleGenerationResponse>(response.text);
    if (!titles || !titles.best_title) {
        throw new Error("Could not generate titles. The response was not in the expected format.");
    }
    return titles;
};

export const generateDescription = async (transcript?: string, title?: string): Promise<DescriptionGenerationResponse> => {
    const systemPrompt = `You are a YouTube Description Optimizer. Write a concise, SEO-smart description that ranks and converts.

Inputs you may receive:
- title: {title}
- topic_or_summary: {topic_or_summary}
- transcript: {transcript}               // optional full/partial
- primary_keywords: {primary_keywords}   // list or comma-separated
- cta: {cta}                             // e.g., subscribe, download, join newsletter
- links: {links}                         // object with {website, socials, sponsor, affiliates[]}
- brand_voice: {brand_voice}             // e.g., friendly expert
- include_chapters: {include_chapters}   // true/false
- video_duration_minutes: {duration_minutes} // optional
- language: {language}

Rules:
- First 2 lines must hook and include a primary keyword; keep them punchy.
- Keep total length 150–400 words unless transcript requires more context (max 5,000 chars).
- Don’t fabricate facts; if details are missing, be generic but useful.
- Chapters: If transcript OR clear structure is provided, generate skimmable chapters. If exact times are unknown, estimate logically from duration and label as approximate.
- Include 3–5 relevant hashtags (not spammy) and 10–20 SEO keywords at the end.
- Preserve brand voice and language.

Output as JSON only:
{
  "description": "Full multi-paragraph description text with link placeholders where provided.",
  "chapters": [
    { "title": "Intro & Promise", "timestamp": "0:00" },
    { "title": "Key Point 1", "timestamp": "1:12" }
  ],
  "hashtags": ["#Example","#Topic"],
  "keywords": ["keyword1","keyword2","long tail..."],
  "pinned_comment": "Optional single-sentence CTA or summary for comments."
}`;

    const populatedPrompt = systemPrompt
        .replace('{title}', title || 'N/A')
        .replace('{topic_or_summary}', title || 'N/A')
        .replace('{transcript}', transcript || 'N/A')
        .replace('{primary_keywords}', 'N/A')
        .replace('{cta}', 'subscribe for more tips')
        .replace('{links}', '{}')
        .replace('{brand_voice}', 'friendly expert')
        .replace('{include_chapters}', transcript ? 'true' : 'false')
        .replace('{duration_minutes}', '10')
        .replace('{language}', 'en');

    const response = await ai.models.generateContent({
        model: transcript ? 'gemini-2.5-pro' : 'gemini-flash-lite-latest',
        contents: populatedPrompt,
         config: {
             responseMimeType: "application/json",
        },
    });
    
    const description = parseJsonFromText<DescriptionGenerationResponse>(response.text);
    if (!description || !description.description) {
         throw new Error("Could not generate description. The response was not in the expected format.");
    }
    return description;
};

export const generateHooks = async (topic: string): Promise<string[]> => {
    const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: `Generate 5 short, punchy, and engaging opening hooks (less than 15 words each) for a YouTube video about "${topic}". The hooks should grab the viewer's attention immediately. Return the result as a JSON array of strings inside a \`\`\`json block. Do not include any other text, preamble, or explanation.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        },
    });

    const hooks = parseJsonFromText<string[]>(response.text);
    if (!hooks || !Array.isArray(hooks)) {
        throw new Error("Could not generate hooks. The response was not in the expected format.");
    }
    return hooks;
};

export const generateChapters = async (transcript: string): Promise<string> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `Analyze the following video transcript and create a list of YouTube video chapters. For each chapter, provide a "MM:SS" timestamp and a concise, descriptive title. The first chapter must start at "00:00". The output should be a clean list formatted for easy copying into a YouTube description. Return ONLY the list of chapters, without any introductory phrases like "Here are the chapters...".\n\nTranscript:\n${transcript}`,
    });
    return response.text;
};

export const summarizeForTopic = async (transcript: string): Promise<string> => {
    const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: `Read the following transcript and summarize its main topic into a short, concise phrase suitable for a YouTube video topic. Return only the topic phrase itself.\n\nTranscript:\n${transcript}`,
    });
    return response.text.trim();
};

export const generateContentIdeas = async (topic: string): Promise<string[]> => {
    const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: `Brainstorm 5 creative and engaging YouTube video ideas based on the topic: "${topic}". For each idea, provide a short, catchy title. Return the result as a JSON array of strings inside a \`\`\`json block. Do not include any other text, preamble, or explanation.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        },
    });

    const ideas = parseJsonFromText<string[]>(response.text);
    if (!ideas || !Array.isArray(ideas)) {
        throw new Error("Could not generate ideas. The response was not in the expected format.");
    }
    return ideas;
};

export const generateShortsIdeas = async (topic: string): Promise<ShortsGenerationResponse> => {
    const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: `Brainstorm 3-5 distinct, viral YouTube Shorts ideas based on the topic: "${topic}".
        For each idea, provide a catchy title, 2-3 short hooks to grab attention, and a brief 1-2 sentence description or outline of the short.
        The goal is high engagement and watch time.

        Return the result as a JSON object with a single key "ideas" which is an array of objects.
        Each object should have "title", "hooks" (an array of strings), and "description" keys.
        Format the entire output inside a \`\`\`json block. Do not include any other text, preamble, or explanation.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    ideas: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                hooks: {
                                    type: Type.ARRAY,
                                    items: { type: Type.STRING }
                                },
                                description: { type: Type.STRING }
                            },
                            required: ["title", "hooks", "description"]
                        }
                    }
                },
                required: ["ideas"]
            }
        },
    });

    const shortsIdeas = parseJsonFromText<ShortsGenerationResponse>(response.text);
    if (!shortsIdeas || !Array.isArray(shortsIdeas.ideas)) {
        throw new Error("Could not generate Shorts ideas. The response was not in the expected format.");
    }
    return shortsIdeas;
};

export const generateTags = async (topic: string): Promise<string[]> => {
    const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: `Generate a list of 10-15 relevant and SEO-optimized YouTube tags for a video about "${topic}". Include a mix of broad and specific tags. Return the result as a single JSON array of strings inside a \`\`\`json block. Do not include any other text, preamble, or explanation.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        },
    });
    const tags = parseJsonFromText<string[]>(response.text);
    if (!tags || !Array.isArray(tags)) {
        throw new Error("Could not generate tags. The response was not in the expected format.");
    }
    return tags;
};

export const generateChannelNames = async (topic: string): Promise<string[]> => {
    const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: `Brainstorm 10 unique, catchy, and available-sounding YouTube channel names related to the topic: "${topic}". Return the result as a JSON array of strings inside a \`\`\`json block. Do not include any other text, preamble, or explanation.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        },
    });

    const names = parseJsonFromText<string[]>(response.text);
    if (!names || !Array.isArray(names)) {
        throw new Error("Could not generate channel names. The response was not in the expected format.");
    }
    return names;
};

export const generateScript = async (topic: string): Promise<ScriptGenerationResponse> => {
    const systemPrompt = `You are a YouTube Script Architect. Build a tight, shoot-ready script with pacing, beats, and visual notes.

Inputs you may receive:
- topic: {topic}
- audience: {audience}
- goal: {goal}                           // educate, entertain, review, news, story
- target_duration_minutes: {duration_minutes}
- brand_voice: {brand_voice}             // e.g., energetic, authoritative, playful
- must_cover_points: {bullet_points}     // array of key talking points
- product_or_offer: {product_or_offer}   // optional, for reviews/sponsors
- cta: {cta}                             // e.g., subscribe, signup URL
- constraints: {constraints}             // avoid topics, compliance notes
- language: {language}

Structure & rules:
- Include: Hook (5–10s), Setup/Promise, Sections with clear beats, Mini-CTA mid-video, Strong final CTA, and Outro.
- Allocate timestamps across sections to match target duration. Keep intros short; deliver value fast.
- Use plain, speakable sentences. Mark on-screen text separately. Propose B-roll, cutaways, or graphics per beat.
- If educational or technical, add quick analogies and a recap.
- Provide 3 alternate hooks and 3 alternate CTAs at the end.
- Do not invent unverifiable claims. If a fact needs citation, mark "cite needed".

Output JSON only:
{
  "metadata": {
    "estimated_duration": "00:07:30",
    "tone": "friendly expert",
    "language": "en"
  },
  "sections": [
    {
      "id": "hook",
      "time_range": "00:00-00:10",
      "narration": "Opening line...",
      "on_screen_text": "BIG IDEA IN 3–5 WORDS",
      "visuals_broll": ["Quick cut of ...", "Close-up of ..."],
      "graphics": ["Lower-third title"],
      "sfx_music": ["whoosh","uptempo bed -12dB"]
    },
    {
      "id": "section_1",
      "time_range": "00:10-01:30",
      "narration": "Core point 1...",
      "beats": ["Problem", "Why it matters", "Quick win"],
      "on_screen_text": "Key stat or step",
      "visuals_broll": ["Screen capture of ...", "Over-the-shoulder shot ..."],
      "graphics": ["Bullet list pop-in"],
      "sfx_music": ["light tick"]
    }
  ],
  "midroll_cta": {
    "time_range": "MM:SS-MM:SS",
    "narration": "If this helps, subscribe for ...",
    "on_screen_text": "Subscribe + Bell",
    "visuals_broll": ["Pointer animation to Subscribe button"]
  },
  "final_cta": {
    "narration": "Grab the free checklist at {link} and watch this next: {suggested_video}.",
    "on_screen_text": "Free Checklist ↓",
    "visuals_broll": ["End card with two video slots"]
  },
  "alternatives": {
    "hooks": ["Alt Hook 1","Alt Hook 2","Alt Hook 3"],
    "ctas": ["Alt CTA 1","Alt CTA 2","Alt CTA 3"],
    "title_ideas": ["Bonus Title 1","Bonus Title 2","Bonus Title 3"]
  }
}`;
    
    const populatedPrompt = systemPrompt
        .replace('{topic}', topic)
        .replace('{audience}', 'general audience')
        .replace('{goal}', 'educate')
        .replace('{duration_minutes}', '8')
        .replace('{brand_voice}', 'energetic')
        .replace('{must_cover_points}', '[]')
        .replace('{product_or_offer}', 'N/A')
        .replace('{cta}', 'subscribe')
        .replace('{constraints}', 'N/A')
        .replace('{language}', 'en');
        
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: populatedPrompt,
         config: {
             responseMimeType: "application/json",
        },
    });

    const script = parseJsonFromText<ScriptGenerationResponse>(response.text);
    if (!script || !script.metadata) {
         throw new Error("Could not generate script. The response was not in the expected format.");
    }
    return script;
};

// --- YT Thumbnail Copier ---

export interface ThumbnailAnalysis {
  style_spec: Record<string, any>;
  mask_plan: Array<Record<string, any>>;
  questions: string[];
  edit_plan: Record<string, any>;
}

export const analyzeThumbnailForCopying = async (base64ImageData: string, mimeType: string): Promise<ThumbnailAnalysis> => {
    const prompt = `You are a High-Fidelity Thumbnail Copier. Your job is to reconstruct the uploaded reference thumbnail with minimal drift and apply only the user’s requested changes.

Hard rules:
- Base image for editing must be the reference thumbnail (not the user’s current thumbnail).
- Lock the original composition. Aim for ≥90% similarity: 
  - Text and major shapes must remain in the same bounding boxes (±5% tolerance in width/height/position).
  - Colors must match within a small delta (give hex + gradient stops).
  - Do not reinterpret layout, angles, 3D depth, or effects.
- Use masks and region-specific edits. Never regenerate the whole frame unless explicitly asked.
- Do not copy third-party logos/watermarks; mark them as {placeholder_logo}. Do not identify real people.
- If any spec is uncertain, ask a clarifying question instead of guessing.

Workflow (always follow in order):
1) Extract Exact Style Spec from the reference:
   - canvas: width/height, 16:9 confirmation.
   - palette: top 6 hex colors; for each gradient, provide stops with percentages and angle.
   - typography per text block (top→bottom order):
     - text_exact (OCR, preserve casing), bbox {x%, y%, w%, h%}, rotation°, perspective/warp axes.
     - font_guess (up to 3), weight, tracking (approx em), line-height, outline/stroke color+px, inner/outer glow, drop shadow (angle, distance, blur, color, opacity), 3D/extrusion depth (px) and bevel style.
   - background:
     - pattern description, key shapes/icons (count estimate), blur or depth, vignette, rays/lines, gradient/base colors.
   - effects: motion lines, stickers, arrows, overlays with bbox + sizes.
   - technical: sharpness, noise, compression artifacts to preserve/remove.

2) Build a Mask Plan:
   - List precise regions to edit (text blocks, face areas, logos). Provide polygon points or bbox in percentages relative to canvas.
   - Everything else is “frozen”.

3) Change Request:
   - Ask the user exactly what to change (text replacement, face swap, color tweaks, font swap, background tweak). Default to “no change” for anything unspecified.

4) Produce an Edit Plan with zero drift:
   - mode: "edit"
   - base_image: "reference_thumbnail"
   - creativity_strength: 0.1  // keep extremely low to preserve original look
   - operations: ordered steps. Only include operations that affect masked regions.
     - type (one of): ["text_replace","face_swap","recolor","add_outline","add_glow","add_drop_shadow","reposition","resize","replace_background","color_grade","cutout_subject","remove_logo","add_logo"]
     - target_region: bbox or polygon from Mask Plan
     - parameters: exact hex, stroke px, glow radius, shadow angle/distance/blur, extrusion depth, font name/size/case, gradient stops+angle.
   - output_specs: { width: 1280, height: 720, format: "PNG" }

Output format (JSON only):
{
  "style_spec": { "...exact details..." },
  "mask_plan": [
    { "id": "text_1", "shape": "bbox", "coords_pct": { "x": 0.08, "y": 0.22, "w": 0.84, "h": 0.18 }, "rotation_deg": 0, "warp": "slight arc" }
  ],
  "questions": [
    "Replace text line 1 with what?",
    "Any face swap? Upload new face if yes.",
    "Keep the same blue/cyan palette or change? If change, provide hex codes."
  ],
  "edit_plan": { "mode":"edit","base_image":"reference_thumbnail","creativity_strength":0.1,"operations":[ /* none until user answers */ ],"output_specs":{"width":1280,"height":720,"format":"PNG"} }
}

If the user already provided changes, fill operations immediately; otherwise, ask questions and wait.
If no image is attached, ask for the reference image first.
`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: {
            parts: [
                { text: prompt },
                {
                    inlineData: {
                        data: base64ImageData,
                        mimeType: mimeType,
                    },
                },
            ],
        },
        config: {
            responseMimeType: "application/json",
        },
    });

    const analysis = parseJsonFromText<ThumbnailAnalysis>(response.text);
    if (!analysis || !analysis.style_spec) {
        throw new Error("Failed to analyze the thumbnail. The response was not in the expected JSON format.");
    }
    return analysis;
};

export const generateCopyEditPlan = async (analysis: ThumbnailAnalysis, userResponses: Record<string, string>): Promise<Record<string, any>> => {
    const prompt = `You are an AI assistant that creates actionable edit plans for image models.
You have already provided a detailed analysis of a reference thumbnail.

Here is the original analysis you provided:
--- ANALYSIS ---
${JSON.stringify(analysis, null, 2)}
--- END ANALYSIS ---

The user has replied with their requested changes.

--- USER RESPONSES ---
${JSON.stringify(userResponses, null, 2)}
--- END USER RESPONSES ---

Based on the user's responses, update the \`edit_plan\` from the original analysis.
Specifically, populate the \`operations\` array with concrete, actionable steps that reflect the user's requests.
Each operation must have a \`type\`, a \`target_region\` from the \`mask_plan\`, and detailed \`parameters\`.
Follow the hard rules from the initial analysis (e.g., low creativity, do not reinterpret).
Do not change any part of the \`style_spec\` or \`mask_plan\`.

Output the final, completed JSON object which is the edit plan. It should contain the populated \`operations\` array and other details like mode, base_image, creativity_strength, and output_specs.
Return ONLY the JSON object for the edit plan. Do not add any commentary or markdown formatting.
`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
        },
    });
    
    const editPlan = parseJsonFromText<any>(response.text);
    if (!editPlan || !editPlan.operations) {
         throw new Error("Failed to generate the edit plan. The response was not in the expected JSON format.");
    }
    return editPlan;
};



// --- YouTube Automation Agent ---

interface ListContent {
    alternatives: string[];
    chosen: string | null;
}

type StepContent = string | string[] | ListContent | null;
type StepStatus = 'pending' | 'running' | 'selecting' | 'completed' | 'failed';

export interface WorkflowProgressUpdate {
    stepId: string;
    status: StepStatus;
    data?: StepContent;
}

export const fetchTrendingTopics = async (): Promise<string[]> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', // Kept as flash for tools
        contents: `Find 5 current trending topics or news headlines that would make for engaging YouTube videos. Use Google Search for up-to-date information. Return the result as a JSON array of strings inside a \`\`\`json block. Do not include any other text or preamble.`,
        config: {
            tools: [{ googleSearch: {} }],
        },
    });
    const topics = parseJsonFromText<string[]>(response.text);
    if (!topics || !Array.isArray(topics)) {
        throw new Error("Could not fetch trending topics. The response was not in the expected format.");
    }
    return topics;
};

const selectBestOption = async (options: string[], purpose: string): Promise<string> => {
    if (options.length === 0) throw new Error("Cannot select from an empty list.");
    if (options.length === 1) return options[0];

    const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: `From the following list, select the single best option for the purpose of "${purpose}". Return ONLY the selected option as a string, with no explanation or preamble.\n\nOptions:\n- ${options.join('\n- ')}`,
    });
    
    const choice = response.text.trim();
    // Ensure the model returns one of the original options
    return options.includes(choice) ? choice : options[0];
};

export const runFullWorkflow = async (
    topic: string, 
    onProgress: (update: WorkflowProgressUpdate) => void
): Promise<void> => {
    const runStep = async <T>(stepId: string, fn: () => Promise<T>): Promise<T> => {
        try {
            onProgress({ stepId, status: 'running' });
            const result = await fn();
            
            // A result that is a list of alternatives for selection is handled outside this function.
            // All other results (strings, arrays of strings to be displayed) are considered complete here.
            const isSelectionObject = typeof result === 'object' && result !== null && 'alternatives' in result;
            if (!isSelectionObject) {
                 onProgress({ stepId, status: 'completed', data: result as StepContent });
            }
            return result;
        } catch (error) {
            console.error(`Error in workflow step ${stepId}:`, error);
            onProgress({ stepId, status: 'failed' });
            throw error; // Propagate the error to stop the workflow
        }
    };
    
    try {
        // This workflow needs an update to handle the new Title object.
        // For now, it's simplified to just use the best title text.
        const titleResponse = await runStep('titles', () => generateTitles(topic));
        const titles = titleResponse.titles.map(t => t.text);

        onProgress({ stepId: 'titles', status: 'selecting', data: { alternatives: titles, chosen: null } });
        const bestTitle = titleResponse.best_title.text;
        onProgress({ stepId: 'titles', status: 'completed', data: { alternatives: titles, chosen: bestTitle } });
        
        const hooks = await runStep('hooks', () => generateHooks(bestTitle));
        
        const scriptResponse = await runStep('script', () => generateScript(bestTitle));
        onProgress({ stepId: 'script', status: 'completed', data: "Script generated successfully. View in the tool for full details." });

        
        const descriptionResponse = await runStep('description', () => generateDescription(undefined, bestTitle));
        onProgress({ stepId: 'description', status: 'completed', data: descriptionResponse.description });
        
        await runStep('tags', () => generateTags(bestTitle));

    } catch (error) {
        // The error is already logged and the UI is updated by runStep.
        // This catch block prevents the uncaught promise rejection.
        console.error("YouTube Automation workflow failed.");
    }
};

export const generateFinancialThread = async (companyName: string): Promise<string[]> => {
    const systemPrompt = `You are a senior equity analyst and expert social media copywriter, specializing in clear, data-driven, and engaging financial commentary for an audience on X (formerly Twitter), with a focus on Indian markets.

**HARD RULES:**
1.  **DATA SOURCE:** You MUST use Google Search to find the latest, most relevant data. For Indian companies, you MUST prioritize data from \`screener.in\`. Mentioning this source adds credibility.
2.  **ACCURACY:** All financial data (revenue, profit, ratios, etc.) must be accurate and recent.
3.  **TONE:** Your tone should be insightful, objective, and slightly bullish but balanced. Avoid hype, speculation, or financial advice.
4.  **FORMATTING:**
    *   Each post must be under 280 characters.
    *   Number each post clearly (e.g., "1/12", "2/12").
    *   Use relevant hashtags (e.g., #StockMarket, #Investing, #Finance) and the company's cashtag (e.g., $RELIANCE).
    *   The final post MUST include the disclaimer: "Disclaimer: This is not financial advice. I may have a position in this stock. Please do your own research."

**THREAD STRUCTURE (Follow this sequence exactly):**
1.  **Hook & Context (1/12):** A catchy hook about the company and what it does.
2.  **The Scale (2/12):** Key metrics like Market Cap, Revenue, and Net Profit to show its size.
3.  **Business Model (3/12):** How does the company make money? What are its key segments?
4.  **The Financials (4/12):** 3-5 year trends in Revenue and Profit growth (CAGR).
5.  **Balance Sheet (5/12):** Mention Debt-to-Equity ratio and Reserves. Is it strong?
6.  **Cash Flows (6/12):** Is the company generating cash from operations? Is it reinvesting?
7.  **Competitive Moat (7/12):** What gives it a competitive advantage? (e.g., brand, distribution, tech)
8.  **Risks & Constraints (8/12):** What are the key risks? (e.g., competition, regulation, debt)
9.  **Valuation (9/12):** Current Stock P/E vs. Industry P/E or historical average. Overvalued or undervalued?
10. **Catalysts (10/12):** What are the future growth triggers or upcoming positive events?
11. **Bull vs. Bear Case (11/12):** A concise summary of the optimistic and pessimistic viewpoints.
12. **The Bottom Line & Disclaimer (12/12):** A concluding thought on the investment thesis and the mandatory disclaimer.

**User Request:**
Generate the 12-post thread for the company: **${companyName}**

**Output Format:**
Return your response as a single, compact JSON array of strings inside a markdown code block.
Example: \`\`\`json
["Post 1/12 text...", "Post 2/12 text...", ...]
\`\`\`
Do not include any other text, preamble, or markdown formatting around the JSON block.
`;
    
    // Using flash for tool usage
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: systemPrompt,
        config: {
            tools: [{ googleSearch: {} }],
        },
    });

    const thread = parseJsonFromText<string[]>(response.text);
    if (!thread || !Array.isArray(thread) || thread.length < 10) { // Check for at least 10 posts for robustness
        throw new Error("Could not generate the financial thread. The response was not in the expected format.");
    }
    return thread;
};

// --- New X (Twitter) Tools ---

export const getXVideoDownloadLink = async (tweetUrl: string): Promise<string> => {
    const prompt = `
You are a specialized API calling agent. Your task is to find a downloadable MP4 link for a video embedded in an X (formerly Twitter) post.

The user has provided this X post URL: "${tweetUrl}"

**Workflow:**
1.  Use Google Search to find a free, public API service that can download Twitter videos. A good example is a service like "ssstwitter.com" or "twittervideodownloader.com", which often have underlying APIs.
2.  Formulate a POST request to one of these services' API endpoints. The request body usually contains the tweet URL. For example, for a service like 'savetweetvid', the request might look like a POST to an endpoint with a body like \`{ "url": "${tweetUrl}" }\`.
3.  Analyze the JSON response from the API. The response typically contains an array of video formats with different qualities.
4.  Identify the object representing the highest quality MP4 video. It usually has a "quality" field like "HD" or "720p" and a "url" or "link" field.
5.  Extract the URL from that object.

**CRITICAL OUTPUT:**
- Return ONLY the final, direct MP4 video URL as a plain string.
- Do NOT include any other text, greetings, explanations, or markdown formatting.
- The URL must be a direct link to a video file (ending in .mp4 or with query parameters that point to a video).

**ERROR HANDLING:**
- If you cannot find a working API, cannot parse the response, or if the post does not contain a video, you MUST return the exact string: "Could not find a downloadable video for this post."
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro', // Pro is better for multi-step reasoning like this
        contents: prompt,
        config: {
            tools: [{ googleSearch: {} }],
        },
    });

    const videoLink = response.text.trim();

    if (videoLink.startsWith('http')) {
        return videoLink;
    } else {
        // Throw an error with the model's response for debugging
        throw new Error(videoLink || "The AI model failed to return a valid video link.");
    }
};

export const generateViralXPost = async (topic: string): Promise<string> => {
    const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: `You are an expert X (Twitter) copywriter known for creating viral posts.
        Your goal is to write a single, highly engaging post based on the following topic: "${topic}".

        **Rules for Virality:**
        1.  **Strong Hook:** Start with a question, a bold statement, or a surprising fact.
        2.  **Provide Value:** Offer a key insight, a useful tip, a quick story, or a unique perspective.
        3.  **Readability:** Use simple language, short sentences, and line breaks to make it easy to scan.
        4.  **Call to Engagement (CTE):** End with a question that encourages replies (e.g., "What's your take?", "Am I missing anything?").
        5.  **Hashtags:** Include 1-3 relevant and popular hashtags.

        Return ONLY the text of the post. Do not include any preamble, explanation, or markdown formatting.`,
    });
    return response.text.trim();
};

export const generateXPostReply = async (originalPost: string, tone: string, goal: string): Promise<XReplyGenerationResponse> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `You are an AI assistant specializing in crafting strategic replies on X (Twitter).
        Your task is to generate 3 distinct reply options for the post below.

        **Original Post:**
        """
        ${originalPost}
        """

        **Your Instructions:**
        - **Tone:** Your replies must adopt a **${tone}** tone.
        - **Goal:** Your primary goal with these replies is to **${goal}**.

        **Guidelines:**
        - Keep replies concise and under 280 characters.
        - Make sure the replies are directly relevant to the original post.
        - Do not be generic. Add specific value, a question, or a unique perspective.

        Return the result as a single JSON object with a key "replies" which is an array of 3 strings.
        Format the entire output inside a \`\`\`json block. Do not include any other text, preamble, or explanation.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    replies: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                },
                required: ["replies"]
            }
        },
    });

    const result = parseJsonFromText<XReplyGenerationResponse>(response.text);
    if (!result || !Array.isArray(result.replies)) {
        throw new Error("Could not generate X replies. The response was not in the expected format.");
    }
    return result;
};


// --- New Shorts Tools ---

export const generateShortsTitleDescFromVideo = async (base64VideoData: string, mimeType: string): Promise<ShortsTitleDescResponse> => {
    const prompt = `You are a YouTube Shorts expert specializing in viral content. Analyze the provided short video and generate a viral title, a short SEO-friendly description, and 5 relevant hashtags.

    **Rules:**
    - **Title:** Must be under 70 characters. It should be catchy, create curiosity, or clearly state the video's value.
    - **Description:** Must be under 150 characters. It should summarize the video and encourage engagement.
    - **Hashtags:** Provide 5 relevant hashtags, always including #shorts.
    
    Return the response as a single JSON object with the keys "title", "description", and "hashtags" (an array of strings). Do not include any other text or markdown formatting.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', // Use Flash for multimodal efficiency
        contents: {
            parts: [
                {
                    inlineData: {
                        data: base64VideoData,
                        mimeType: mimeType,
                    },
                },
                { text: prompt },
            ],
        },
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    hashtags: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                    },
                },
                required: ["title", "description", "hashtags"],
            },
        },
    });

    const result = parseJsonFromText<ShortsTitleDescResponse>(response.text);
    if (!result || !result.title) {
        throw new Error("Could not generate title and description from video. The response was not in the expected format.");
    }
    return result;
};

export const startVideoGeneration = async (prompt: string) => {
    // Re-create instance to ensure the latest API key from the dialog is used.
    const localAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let operation = await localAi.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: '9:16'
        }
    });
    return operation;
};

export const checkVideoGenerationStatus = async (operation: any) => {
    const localAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let updatedOperation = await localAi.operations.getVideosOperation({ operation: operation });
    return updatedOperation;
};

// --- New Generic X Tools for Automation Agent ---

export const generateGenericThread = async (topic: string): Promise<string[]> => {
    const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: `Generate a 5-tweet Twitter thread about "${topic}". 
        Make it engaging, informative, and formatted for X. 
        Each tweet should be concise (under 280 chars).
        Return the result as a JSON array of strings (one string per tweet) inside a \`\`\`json block.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        },
    });
    const thread = parseJsonFromText<string[]>(response.text);
    if (!thread || !Array.isArray(thread)) throw new Error("Failed to generate thread");
    return thread;
};

export const generateXHashtags = async (topic: string): Promise<string[]> => {
    const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: `Generate 10 popular and relevant hashtags for an X (Twitter) post about "${topic}". Return as a JSON array of strings inside a \`\`\`json block.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        },
    });
    const tags = parseJsonFromText<string[]>(response.text);
    if (!tags || !Array.isArray(tags)) throw new Error("Failed to generate hashtags");
    return tags;
};

export const runXWorkflow = async (
    topic: string, 
    onProgress: (update: WorkflowProgressUpdate) => void
): Promise<void> => {
    const runStep = async <T>(stepId: string, fn: () => Promise<T>): Promise<T> => {
        try {
            onProgress({ stepId, status: 'running' });
            const result = await fn();
            // X workflow doesn't have "selection" steps like YouTube, so we just complete
            onProgress({ stepId, status: 'completed', data: result as StepContent });
            return result;
        } catch (error) {
            console.error(`Error in workflow step ${stepId}:`, error);
            onProgress({ stepId, status: 'failed' });
            throw error; 
        }
    };
    
    try {
        await runStep('viral_post', () => generateViralXPost(topic));
        await runStep('thread', () => generateGenericThread(topic));
        await runStep('hashtags', () => generateXHashtags(topic));
    } catch (error) {
        console.error("X Automation workflow failed.");
    }
};