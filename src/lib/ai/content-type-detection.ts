/**
 * Content Type Detection
 * 
 * Automatically detects content type from raw text to suggest appropriate
 * templates and adjust AI processing behavior.
 */

export type ContentType =
    | "code"
    | "meeting"
    | "research"
    | "article"
    | "brainstorm"
    | "lecture"
    | "email"
    | "list"
    | "general";

export interface ContentTypeResult {
    type: ContentType;
    confidence: number; // 0-1
    reason: string;
    suggestedTemplate: string;
    detectedFeatures: string[];
}

// Pattern definitions for each content type
const CONTENT_PATTERNS: Record<ContentType, {
    patterns: RegExp[];
    keywords: string[];
    template: string;
    weight: number;
}> = {
    code: {
        patterns: [
            /```[\s\S]+?```/g, // Code blocks
            /function\s+\w+\s*\(/gi,
            /const\s+\w+\s*=/gi,
            /import\s+.*from/gi,
            /class\s+\w+/gi,
            /def\s+\w+\s*\(/gi, // Python
            /<\w+[\s>]/g, // HTML/JSX tags
            /\{\s*\w+:\s*/g, // Object notation
            /=>\s*\{/g, // Arrow functions
            /npm\s+(install|run)/gi,
            /git\s+(commit|push|pull)/gi,
        ],
        keywords: ["function", "const", "import", "export", "class", "return", "async", "await", "npm", "git", "api", "endpoint", "bug", "fix", "refactor", "pr", "pull request", "code review"],
        template: "code-review",
        weight: 1.2,
    },
    meeting: {
        patterns: [
            /attendees?:?\s/gi,
            /agenda:?\s/gi,
            /action items?:?\s/gi,
            /next steps?:?\s/gi,
            /discussed:?\s/gi,
            /decided:?\s/gi,
            /\b(john|jane|team|everyone)\s+(said|mentioned|suggested)/gi,
            /@\w+/g, // @mentions
            /\b\d{1,2}[:\s]\d{2}\s*(am|pm)?\b/gi, // Times
        ],
        keywords: ["meeting", "attendees", "agenda", "discussed", "action items", "follow up", "sync", "standup", "retro", "sprint", "1:1", "call", "zoom", "teams", "decision"],
        template: "meeting",
        weight: 1.3,
    },
    research: {
        patterns: [
            /\[\d+\]/g, // Citations [1], [2]
            /et\s+al\.?/gi,
            /hypothesis:?\s/gi,
            /methodology:?\s/gi,
            /findings?:?\s/gi,
            /conclusion:?\s/gi,
            /abstract:?\s/gi,
            /references?:?\s/gi,
            /source:?\s/gi,
            /study\s+(shows?|suggests?|found)/gi,
        ],
        keywords: ["research", "study", "hypothesis", "methodology", "findings", "conclusion", "abstract", "references", "source", "data", "analysis", "literature", "review", "survey", "experiment"],
        template: "research",
        weight: 1.2,
    },
    article: {
        patterns: [
            /^#\s+.+$/gm, // Main heading
            /\n\n.{100,}/g, // Long paragraphs
            /according\s+to/gi,
            /in\s+this\s+article/gi,
            /the\s+author\s/gi,
            /"[^"]{20,}"/g, // Long quotes
        ],
        keywords: ["article", "author", "published", "editorial", "opinion", "argues", "conclusion", "introduction", "summary", "key points", "takeaway"],
        template: "article",
        weight: 1.0,
    },
    brainstorm: {
        patterns: [
            /^[-*+]\s+/gm, // Bullet points
            /what\s+if\s+we/gi,
            /idea:?\s/gi,
            /could\s+we\s+/gi,
            /maybe\s+we\s+(should|could)/gi,
            /\?\s*$/gm, // Questions ending lines
        ],
        keywords: ["idea", "brainstorm", "creative", "options", "alternatives", "possibilities", "explore", "concept", "proposal", "suggestion", "think about", "consider"],
        template: "brainstorm",
        weight: 1.1,
    },
    lecture: {
        patterns: [
            /learning\s+objectives?:?\s/gi,
            /chapter\s+\d+/gi,
            /lesson\s+\d+/gi,
            /module\s+\d+/gi,
            /key\s+(concepts?|terms?):?\s/gi,
            /definition:?\s/gi,
            /example:?\s/gi,
            /note:?\s/gi,
            /remember:?\s/gi,
        ],
        keywords: ["lecture", "lesson", "chapter", "module", "learning", "definition", "concept", "example", "exercise", "quiz", "test", "assignment", "student", "professor", "class"],
        template: "lecture",
        weight: 1.1,
    },
    email: {
        patterns: [
            /^(from|to|subject|cc|bcc):?\s/gim,
            /dear\s+\w+/gi,
            /hi\s+\w+,?$/gim,
            /best\s+regards?,?$/gim,
            /sincerely,?$/gim,
            /thanks?,?$/gim,
            /\w+@\w+\.\w+/g, // Email addresses
        ],
        keywords: ["email", "subject", "inbox", "reply", "forward", "regards", "sincerely"],
        template: "auto",
        weight: 1.0,
    },
    list: {
        patterns: [
            /^(\d+\.|-|\*|\+)\s+/gm, // List items
            /^\s*\[\s*[xX\s]?\s*\]/gm, // Checkboxes
        ],
        keywords: ["todo", "checklist", "list", "items", "tasks"],
        template: "auto",
        weight: 0.8,
    },
    general: {
        patterns: [],
        keywords: [],
        template: "auto",
        weight: 0.5,
    },
};

/**
 * Detect the content type of raw text
 */
export function detectContentType(content: string): ContentTypeResult {
    if (!content || content.trim().length < 20) {
        return {
            type: "general",
            confidence: 0.5,
            reason: "Content too short to analyze",
            suggestedTemplate: "auto",
            detectedFeatures: [],
        };
    }

    const contentLower = content.toLowerCase();
    const scores: Record<ContentType, { score: number; features: string[] }> = {
        code: { score: 0, features: [] },
        meeting: { score: 0, features: [] },
        research: { score: 0, features: [] },
        article: { score: 0, features: [] },
        brainstorm: { score: 0, features: [] },
        lecture: { score: 0, features: [] },
        email: { score: 0, features: [] },
        list: { score: 0, features: [] },
        general: { score: 0, features: [] },
    };

    // Score each content type
    for (const [type, config] of Object.entries(CONTENT_PATTERNS) as [ContentType, typeof CONTENT_PATTERNS[ContentType]][]) {
        // Pattern matching
        for (const pattern of config.patterns) {
            const matches = content.match(pattern);
            if (matches && matches.length > 0) {
                const patternScore = Math.min(matches.length * 0.15, 0.5);
                scores[type].score += patternScore;
                scores[type].features.push(`${matches.length} pattern matches`);
            }
        }

        // Keyword matching
        let keywordCount = 0;
        for (const keyword of config.keywords) {
            if (contentLower.includes(keyword.toLowerCase())) {
                keywordCount++;
            }
        }
        if (keywordCount > 0) {
            const keywordScore = Math.min(keywordCount * 0.1, 0.4);
            scores[type].score += keywordScore;
            scores[type].features.push(`${keywordCount} keywords found`);
        }

        // Apply weight
        scores[type].score *= config.weight;
    }

    // Find the best match
    let bestType: ContentType = "general";
    let bestScore = 0;

    for (const [type, data] of Object.entries(scores) as [ContentType, { score: number; features: string[] }][]) {
        if (data.score > bestScore) {
            bestScore = data.score;
            bestType = type;
        }
    }

    // Normalize confidence to 0-1 range
    const confidence = Math.min(Math.max(bestScore, 0.3), 1.0);

    // Generate reason
    const features = scores[bestType].features;
    const reason = features.length > 0
        ? `Detected ${bestType} content: ${features.slice(0, 2).join(", ")}`
        : "General content - no specific type detected";

    return {
        type: bestType,
        confidence,
        reason,
        suggestedTemplate: CONTENT_PATTERNS[bestType].template,
        detectedFeatures: features,
    };
}

/**
 * Get icon and color for content type
 */
export function getContentTypeDisplay(type: ContentType): {
    icon: string;
    label: string;
    color: string;
} {
    const displays: Record<ContentType, { icon: string; label: string; color: string }> = {
        code: { icon: "Code", label: "Code/Technical", color: "text-orange-500" },
        meeting: { icon: "Users", label: "Meeting Notes", color: "text-blue-500" },
        research: { icon: "BookOpen", label: "Research", color: "text-green-500" },
        article: { icon: "FileText", label: "Article", color: "text-cyan-500" },
        brainstorm: { icon: "Lightbulb", label: "Brainstorm", color: "text-yellow-500" },
        lecture: { icon: "GraduationCap", label: "Lecture/Study", color: "text-purple-500" },
        email: { icon: "Mail", label: "Email", color: "text-pink-500" },
        list: { icon: "ListTodo", label: "List/Tasks", color: "text-indigo-500" },
        general: { icon: "FileText", label: "General", color: "text-muted-foreground" },
    };

    return displays[type] || displays.general;
}
