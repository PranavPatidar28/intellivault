// Canned input→output pairs for the hero product demo. Each sample mirrors the
// real AI Dump output shape (src/lib/validations/ai-dump.ts) — a short title,
// 5 lowercase-hyphenated tags, a TL;DR, a structured body and action items with
// assignee/due badges — so the demo is faithful to what the product actually
// emits. No network: the hero never calls the model.

export type DemoSectionKind = "list" | "quote";

export interface DemoSection {
  heading: string;
  kind: DemoSectionKind;
  /** For "list": bullet items (markdown bold ** ** is rendered). For "quote": a single line. */
  items: string[];
}

export interface DemoActionItem {
  text: string;
  assignee?: string;
  due?: string;
}

export interface DemoSample {
  id: string;
  /** Preset-chip label. */
  label: string;
  /** Messy raw input that the typewriter types into the left pane. */
  raw: string;
  result: {
    title: string;
    tags: string[];
    tldr: string;
    sections: DemoSection[];
    actions: DemoActionItem[];
  };
}

export const SAMPLES: DemoSample[] = [
  {
    id: "meeting",
    label: "Meeting notes",
    raw: "ok so sync today — q3 launch. priya said the api is basically done just needs the rate limiting stuff. marcus pushed back on the mar 15 date, thinks design needs another week. we agreed to ship beta to the 50 waitlist ppl first. someone needs to email them. also still no decision on pricing?? marcus to draft 3 tiers by fri. oh and the staging db keeps timing out, raj is looking into it",
    result: {
      title: "Q3 Launch Sync: Beta Rollout & Open Decisions",
      tags: ["q3-launch", "product-planning", "beta-release", "pricing", "api"],
      tldr: "The team aligned on a phased beta to 50 waitlist users before general launch, but the March 15 date and pricing model remain unresolved.",
      sections: [
        {
          heading: "Decisions",
          kind: "list",
          items: [
            "Ship beta to the **50 waitlist users** first, ahead of general availability",
            "API is feature-complete pending rate limiting",
          ],
        },
        {
          heading: "Open Questions",
          kind: "list",
          items: [
            "Launch date: Marcus pushing back on **March 15** — design may need another week",
            "Pricing model undecided (3 tiers proposed)",
          ],
        },
        {
          heading: "Risks",
          kind: "quote",
          items: ["Staging database timing out intermittently — under investigation"],
        },
      ],
      actions: [
        { text: "Email the 50 waitlist users about beta access" },
        { text: "Draft 3 pricing tiers", assignee: "Marcus", due: "Fri" },
        { text: "Investigate staging DB timeouts", assignee: "Raj" },
        { text: "Finish API rate limiting", assignee: "Priya" },
      ],
    },
  },
  {
    id: "research",
    label: "Research paper",
    raw: "notes on the retrieval paper — they use a two-stage reranker, bi-encoder for recall then cross-encoder on top 100. claims +14% ndcg over bm25 baseline on the internal set. interesting bit: hard negative mining matters way more than model size?? ablation shows it. limitations — only english, eval set is kinda small. todo: try their hard-neg trick on our index, ping the author about the eval split",
    result: {
      title: "Two-Stage Reranking for Retrieval: Key Findings",
      tags: ["retrieval", "reranking", "search-quality", "ml-research", "embeddings"],
      tldr: "A bi-encoder recall stage followed by a cross-encoder reranker lifts nDCG +14% over BM25, with hard-negative mining mattering more than model size.",
      sections: [
        {
          heading: "Method",
          kind: "list",
          items: [
            "Two-stage: **bi-encoder** for recall → **cross-encoder** rerank on top 100",
            "Reports **+14% nDCG** over the BM25 baseline",
          ],
        },
        {
          heading: "Key Insight",
          kind: "list",
          items: [
            "**Hard-negative mining** drives gains more than model size (shown via ablation)",
          ],
        },
        {
          heading: "Limitations",
          kind: "quote",
          items: ["English-only, and the evaluation set is relatively small"],
        },
      ],
      actions: [
        { text: "Test the hard-negative trick on our index" },
        { text: "Email the author about the eval split" },
      ],
    },
  },
  {
    id: "recipe",
    label: "Recipe",
    raw: "thai basil chicken from memory — get ground chicken, thai basil (lots), garlic, thai chilies, fish sauce, oyster sauce, bit of sugar, soy. high heat, smash garlic+chili, fry chicken till crisp edges, sauces in, kill heat then basil. serve over rice w a fried egg. takes like 15 min. note: don't skip the egg",
    result: {
      title: "Thai Basil Chicken (Pad Krapow Gai)",
      tags: ["recipe", "thai", "weeknight", "chicken", "15-minute"],
      tldr: "A 15-minute high-heat stir-fry of ground chicken with garlic, chili and Thai basil, served over rice with a fried egg.",
      sections: [
        {
          heading: "Ingredients",
          kind: "list",
          items: [
            "Ground chicken, **Thai basil** (lots), garlic, Thai chilies",
            "Fish sauce, oyster sauce, soy, a little sugar",
          ],
        },
        {
          heading: "Method",
          kind: "list",
          items: [
            "High heat: smash **garlic + chili**, fry chicken to crisp edges",
            "Add sauces, kill the heat, then fold in basil",
          ],
        },
        {
          heading: "Serve",
          kind: "quote",
          items: ["Over rice with a fried egg — don't skip the egg"],
        },
      ],
      actions: [
        { text: "Buy ground chicken and Thai basil" },
        { text: "Prep garlic and chilies ahead" },
      ],
    },
  },
];

export const DEFAULT_SAMPLE_ID = "meeting";
