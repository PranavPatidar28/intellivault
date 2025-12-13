/**
 * AI Dump Template Presets
 * 
 * Predefined templates for common content types that adjust the AI processing
 * to produce better structured output for specific use cases.
 */

export interface TemplatePreset {
    id: string;
    name: string;
    description: string;
    icon: string; // Lucide icon name
    example: string;
    promptContext: string;
    suggestedTags: string[];
    suggestedSections: string[];
}

export const TEMPLATE_PRESETS: TemplatePreset[] = [
    {
        id: "auto",
        name: "Auto-detect",
        description: "Let AI automatically detect the content type and choose the best format",
        icon: "Sparkles",
        example: "Any type of content - the AI will analyze and format accordingly",
        promptContext: "",
        suggestedTags: [],
        suggestedSections: [],
    },
    {
        id: "meeting",
        name: "Meeting Notes",
        description: "Format meeting notes with attendees, decisions, and action items",
        icon: "Users",
        example: "Stand-up notes, client calls, team meetings, 1-on-1s",
        promptContext: `This is meeting notes content. Structure the output as follows:
- Extract meeting metadata (date, attendees if mentioned)
- Organize discussion points by topic
- Highlight key decisions made
- Extract action items with owners and deadlines
- Summarize next steps
Use clear headers: ## Meeting Overview, ## Discussion Points, ## Decisions, ## Action Items, ## Next Steps`,
        suggestedTags: ["meeting", "notes", "action-items"],
        suggestedSections: ["Overview", "Attendees", "Discussion", "Decisions", "Action Items", "Follow-up"],
    },
    {
        id: "research",
        name: "Research Notes",
        description: "Structure research with sources, key findings, and references",
        icon: "BookOpen",
        example: "Literature reviews, market research, technical research, studies",
        promptContext: `This is research content. Structure the output as follows:
- Summarize the research topic and objectives
- Organize key findings by theme or category
- Preserve citations and sources
- Highlight methodology if present
- Note limitations and gaps
- Add a synthesis section connecting findings
Use headers: ## Research Topic, ## Key Findings, ## Methodology, ## Sources & References, ## Conclusions`,
        suggestedTags: ["research", "study", "findings"],
        suggestedSections: ["Topic", "Objectives", "Methodology", "Key Findings", "Sources", "Conclusions"],
    },
    {
        id: "code-review",
        name: "Code Review",
        description: "Document code changes, issues, and improvement suggestions",
        icon: "Code",
        example: "PR reviews, code walkthroughs, technical debt documentation",
        promptContext: `This is code review or technical documentation. Structure the output as follows:
- Summarize what the code/change does
- List files or components affected
- Document issues found (bugs, security, performance)
- Suggest improvements
- Note positive aspects (good patterns, clean code)
- Preserve code snippets in proper markdown code blocks
Use headers: ## Overview, ## Changes, ## Issues Found, ## Suggestions, ## Positive Notes`,
        suggestedTags: ["code-review", "technical", "development"],
        suggestedSections: ["Overview", "Scope", "Issues", "Suggestions", "Approved Patterns"],
    },
    {
        id: "brainstorm",
        name: "Brainstorm",
        description: "Organize ideas and concepts from brainstorming sessions",
        icon: "Lightbulb",
        example: "Idea dumps, creative sessions, planning discussions, feature ideas",
        promptContext: `This is brainstorming content. Structure the output as follows:
- Group related ideas together by theme
- Don't filter out "bad" ideas - preserve creativity
- Highlight the most promising concepts
- Connect ideas that build on each other
- Add a prioritization or voting section
- Keep the energy and enthusiasm of the original
Use headers: ## Main Themes, ## Ideas by Category, ## Top Concepts, ## Connections, ## Next Steps`,
        suggestedTags: ["brainstorm", "ideas", "creative"],
        suggestedSections: ["Themes", "Ideas", "Top Picks", "Connections", "To Explore"],
    },
    {
        id: "lecture",
        name: "Lecture Notes",
        description: "Format educational content with key concepts and examples",
        icon: "GraduationCap",
        example: "Class notes, workshop content, webinar summaries, tutorials",
        promptContext: `This is educational/lecture content. Structure the output as follows:
- Start with learning objectives or main topics
- Organize content by logical sections/modules
- Highlight key concepts with bold text
- Preserve examples and exercises
- Add definitions for technical terms
- Create a quick review/summary section
Use headers: ## Learning Objectives, ## Key Concepts, ## Detailed Notes, ## Examples, ## Summary, ## Review Questions`,
        suggestedTags: ["lecture", "learning", "education"],
        suggestedSections: ["Objectives", "Key Concepts", "Notes", "Examples", "Summary"],
    },
    {
        id: "article",
        name: "Article Summary",
        description: "Summarize articles or blog posts with key takeaways",
        icon: "FileText",
        example: "News articles, blog posts, essays, opinion pieces",
        promptContext: `This is an article or written piece. Structure the output as follows:
- Lead with the main thesis or argument
- Extract key points in order of importance
- Note the author's perspective or bias if evident
- Preserve important quotes
- Add context where helpful
- End with implications or actionable takeaways
Use headers: ## Main Thesis, ## Key Points, ## Notable Quotes, ## Analysis, ## Takeaways`,
        suggestedTags: ["article", "summary", "reading"],
        suggestedSections: ["Thesis", "Key Points", "Quotes", "Analysis", "Takeaways"],
    },
];

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): TemplatePreset | undefined {
    return TEMPLATE_PRESETS.find(t => t.id === id);
}

/**
 * Get the prompt context for a template
 */
export function getTemplateContext(templateId: string): string {
    const template = getTemplateById(templateId);
    if (!template || templateId === "auto") {
        return "";
    }
    return `\n\n[CONTENT TYPE CONTEXT]\n${template.promptContext}`;
}
