/**
 * AI Dump Prompt Templates v3
 *
 * Enhanced prompt templates for high-quality AI Dump processing.
 * Optimized for Gemini 2.0 Flash and similar instruction-following models.
 */

import type { AIDumpTone } from "@/lib/validations/ai-dump";

// ============================================================================
// Types
// ============================================================================

export interface PromptTemplate {
    id: string;
    version: string;
    system: string;
    template: string;
    temperature: number;
}

// ============================================================================
// Tone Instructions
// ============================================================================

const TONE_INSTRUCTIONS: Record<AIDumpTone, string> = {
    balanced:
        "Write in a balanced, professional tone that is clear, accessible, and confident. Suitable for most professional contexts.",
    formal:
        "Write in a formal, academic tone. Use complete sentences, avoid contractions, and maintain scholarly precision.",
    casual:
        "Write in a casual, conversational tone. Feel friendly and approachable, like explaining to a colleague over coffee.",
    technical:
        "Write in a technical tone with precise terminology. Assume the reader is a developer or engineer familiar with technical concepts.",
};

// ============================================================================
// Prompt Templates
// ============================================================================

export const PROMPTS = {
    /**
     * Generate 3 title variants, ranked tags, and TL;DR
     */
    TITLE_TAGS_TLDR: {
        id: "title_tags_tldr",
        version: "v3",
        system: `You are an expert content analyst specializing in creating compelling titles, relevant tags, and concise summaries.

Your output MUST be valid JSON matching the exact schema provided. No markdown, no explanations, no text outside the JSON object.

Quality guidelines:
- Titles should be engaging and accurately represent the content
- Tags should be specific and useful for categorization/search
- TL;DR should capture the essence in 1-2 punchy sentences`,

        getTemplate: (tone: AIDumpTone) => `Analyze this content and generate titles, tags, and a TL;DR summary.

## Requirements

### Titles (exactly 3 variants)
1. **short**: 3-7 words, catchy and memorable. Front-load the key concept.
2. **descriptive**: 8-15 words, complete and informative. Include context.
3. **shareable**: Optimized for search engines and social sharing. Use power words.

### Tags (exactly 5)
- Use lowercase with hyphens for multi-word tags (e.g., "machine-learning")
- Be specific: "react-hooks" is better than "programming"
- Order by relevance (most relevant first)
- Avoid generic tags like "notes", "document", "article"

### TL;DR
- Maximum 2 sentences
- Capture the main takeaway or value proposition
- ${TONE_INSTRUCTIONS[tone]}

## Output Format (JSON only)
{
  "titles": [
    {"variant": "short", "text": "Your Short Title", "score": 0.95},
    {"variant": "descriptive", "text": "Your Descriptive Title With More Context", "score": 0.90},
    {"variant": "shareable", "text": "Keyword-Rich Title for Sharing", "score": 0.85}
  ],
  "tags": [
    {"name": "primary-topic", "confidence": 0.95},
    {"name": "secondary-topic", "confidence": 0.88},
    {"name": "specific-concept", "confidence": 0.82},
    {"name": "related-field", "confidence": 0.75},
    {"name": "technology-used", "confidence": 0.70}
  ],
  "tldr": "One or two sentences summarizing the key point."
}

## Content to Analyze
`,
        temperature: 0.2,
    },

    /**
     * Generate structured Markdown document
     */
    MARKDOWN_STRUCTURE: {
        id: "markdown_structure",
        version: "v3",
        system: `You are an expert technical writer who transforms raw notes into beautifully structured Markdown documents.

Your output should be ONLY the Markdown content, ready to render. No explanations before or after.

You excel at:
- Identifying logical structure in messy notes
- Creating clear hierarchical organization
- Preserving technical accuracy while improving readability
- Using appropriate Markdown formatting for different content types`,

        getTemplate: (
            tone: AIDumpTone,
            options: { preserveCode: boolean; template: string }
        ) => {
            const templateInstructions: Record<string, string> = {
                auto: `Analyze the content and structure it appropriately. Use your judgment to organize it logically.`,
                meeting: `Structure as meeting notes:
- Start with meeting metadata (date, attendees if mentioned)
- Group discussion points by topic
- Highlight decisions with ✅ or similar markers
- End with action items in a checklist format`,
                research: `Structure as research notes:
- Start with the research question or thesis
- Organize findings into logical sections
- Include methodology details if present
- Add a "Key Takeaways" section
- Preserve all citations and references`,
                code: `Structure as technical documentation:
- Start with a brief overview/purpose
- Include a "Quick Start" section if applicable
- Document all code with explanations
- Add usage examples
- List dependencies and requirements
- Include troubleshooting tips if relevant`,
                "code-review": `Structure as code review notes:
- Summarize what the code/change does
- List files or components affected
- Document issues found (bugs, security, performance)
- Suggest improvements with code examples
- Note positive aspects (good patterns, clean code)
Use headers: ## Overview, ## Changes, ## Issues, ## Suggestions, ## Positive Notes`,
                brainstorm: `Structure as brainstorming session:
- Group related ideas together by theme
- Preserve all ideas - don't filter out anything
- Highlight the most promising concepts with ⭐
- Connect ideas that build on each other
- Add a prioritization section
Use headers: ## Main Themes, ## Ideas by Category, ## Top Concepts, ## Connections`,
                lecture: `Structure as study notes:
- Start with topic and learning objectives
- Define key terms and concepts
- Use examples to illustrate abstract ideas
- Include diagrams descriptions if mentioned
- End with a summary and key takeaways`,
                article: `Structure as article summary:
- Lead with the main thesis or argument
- Extract key points in order of importance
- Note the author's perspective if evident
- Preserve important quotes with attribution
- End with actionable takeaways
Use headers: ## Main Thesis, ## Key Points, ## Notable Quotes, ## Takeaways`,
            };

            return `Transform this raw content into a polished, well-structured Markdown document.

## Template Context
${templateInstructions[options.template] || templateInstructions.auto}

## Tone
${TONE_INSTRUCTIONS[tone]}

## Markdown Formatting Guidelines

### Structure
- Use **## Heading 2** for major sections
- Use **### Heading 3** for subsections
- Keep the hierarchy consistent (don't skip levels)

### Lists
- Use **bullet points (-)** for unordered items
- Use **numbered lists (1.)** for sequential steps or ranked items
- Use **task lists (- [ ])** for action items

### Emphasis
- Use **bold** for key terms and important concepts
- Use *italics* for emphasis or technical terms on first use
- Use \`inline code\` for code, commands, file names, and technical identifiers

### Code Blocks
${options.preserveCode
                    ? `- Preserve ALL code blocks exactly as they appear
- Always include language identifiers (\`\`\`python, \`\`\`javascript, etc.)
- Keep code formatting intact`
                    : `- Summarize long code blocks with key highlights
- Keep short, important code snippets intact`}

### Other Elements
- Use **> blockquotes** for important quotes or callouts
- Use **---** (horizontal rule) to separate major sections if needed
- Use **tables** when presenting comparative or structured data

### Content Guidelines
- Start with a brief summary or overview (3-5 bullet points max)
- Organize content from most to least important
- Remove redundancy while preserving all unique information
- Convert informal notes to complete sentences where appropriate
- Preserve all specific facts, numbers, names, and dates exactly

## Output
Provide ONLY the Markdown content. No explanations, no "Here is the document:" prefix.

## Raw Content
`;
        },
        temperature: 0.25,
    },

    /**
     * Extract action items from content
     */
    ACTION_EXTRACTION: {
        id: "action_extraction",
        version: "v3",
        system: `You are an assistant that identifies and extracts actionable tasks from text.

CRITICAL: Only extract actions that are EXPLICITLY stated in the content.
- You must NOT invent, assume, or infer any actions
- You must NOT create placeholder or example actions
- If no actions exist, return an empty "actions" array`,

        template: `Extract ONLY explicitly stated action items, tasks, and to-dos from this content.

## Extraction Rules

### What TO extract:
- Direct task assignments: "John needs to finish the report"
- Action statements: "We should update the documentation"
- Todo items: "TODO: fix the login bug"
- Follow-ups: "Follow up with Sarah about budget"
- Deadlines with actions: "Complete by Friday"

### What NOT TO extract:
- General statements or facts
- Suggestions without commitment
- Historical actions already completed
- Hypothetical or conditional actions
- Your own ideas - ONLY what's in the content

## Output Format
Return an object with an "actions" array. Each action item has:
- "text": The specific action (verb + object)
- "assignee": Person responsible ("" if not specified)
- "due_date": ISO date YYYY-MM-DD if explicitly stated (null otherwise)
- "confidence": Your confidence 0.0-1.0 in this extraction

If there are NO action items in the content, return an empty "actions" array.

## Content to Analyze
`,
        temperature: 0.0,
    },

    /**
     * Generate long-form summary
     */
    SUMMARY: {
        id: "summary",
        version: "v3",
        system: `You are an expert summarizer who creates comprehensive yet concise summaries.

Your summaries should:
- Capture all key points without unnecessary padding
- Be well-organized and easy to scan
- Maintain the original meaning and accuracy
- Be standalone - reader shouldn't need the original

Output ONLY the summary text. No "Here is the summary:" prefix.`,

        getTemplate: (tone: AIDumpTone) => `Create a comprehensive summary of this content.

## Requirements
- **Length**: 2-4 paragraphs (150-300 words ideal)
- **Structure**: Start with the main point, then supporting details
- **Completeness**: Cover all major topics and key facts
- **Accuracy**: Preserve specific names, numbers, dates, and decisions
- **Tone**: ${TONE_INSTRUCTIONS[tone]}

## What to Include
- Main topic or purpose
- Key findings, decisions, or conclusions
- Important facts and figures
- Any notable implications or next steps

## What to Avoid
- Starting with "This document..." or "The content discusses..."
- Adding information not in the original
- Excessive hedging language
- Unnecessary filler words

## Content to Summarize
`,
        temperature: 0.2,
    },

    /**
     * Refine an already-generated Markdown document according to a user
     * instruction (e.g. "make it shorter", "add bullet points"). Operates on
     * the CURRENT output, not the raw input, so successive refinements compound.
     */
    MARKDOWN_REFINE: {
        id: "markdown_refine",
        version: "v1",
        system: `You are an expert editor who revises Markdown documents according to specific instructions.

Apply the user's instruction to the document while:
- Preserving all factual content unless the instruction explicitly asks to remove it
- Keeping valid, well-formed Markdown
- Maintaining specific facts, numbers, names, dates, and code blocks exactly

Output ONLY the revised Markdown. No explanations, no "Here is the revised document:" prefix.`,

        getTemplate: (tone: AIDumpTone, instruction: string) =>
            `Revise the following Markdown document according to this instruction:

## Instruction
${instruction}

## Tone
${TONE_INSTRUCTIONS[tone]}

## Output
Provide ONLY the revised Markdown content.

## Current Document
`,
        temperature: 0.3,
    },
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the full prompt ID with version for provenance tracking
 */
export function getPromptId(
    promptKey: keyof typeof PROMPTS
): string {
    const prompt = PROMPTS[promptKey];
    return `${prompt.id}_${prompt.version}`;
}

/**
 * Get a prompt snapshot for provenance (without the actual content for privacy)
 */
export function getPromptSnapshot(
    promptKey: keyof typeof PROMPTS
): string {
    const prompt = PROMPTS[promptKey];
    return JSON.stringify({
        id: prompt.id,
        version: prompt.version,
        temperature: prompt.temperature,
    });
}
