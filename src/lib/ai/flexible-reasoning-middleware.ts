import { type LanguageModelMiddleware } from "ai";

function getPotentialStartIndex(text: string, searchedText: string): number | null {
  if (searchedText.length === 0) {
    return null;
  }
  const directIndex = text.indexOf(searchedText);
  if (directIndex !== -1) {
    return directIndex;
  }
  for (let i = text.length - 1; i >= 0; i--) {
    const suffix = text.substring(i);
    if (searchedText.startsWith(suffix)) {
      return i;
    }
  }
  return null;
}

export interface FlexibleReasoningMiddlewareOptions {
  separator?: string;
}

export function extractFlexibleReasoningMiddleware({
  separator = "\n",
}: FlexibleReasoningMiddlewareOptions = {}): LanguageModelMiddleware {
  const pairs = [
    { opening: "<think>", closing: "</think>" },
    { opening: "<|channel>thought", closing: "<|channel>text" },
    { opening: "<|channel>thought", closing: "<channel|>" },
    { opening: "<|channel>thought", closing: "<|channel|>" },
    { opening: "<|thought|>", closing: "<|thought|>" }
  ];

  return {
    specificationVersion: "v4",
    wrapGenerate: async ({ doGenerate }) => {
      const { content, ...rest } = await doGenerate();
      const transformedContent: any[] = [];
      
      for (const part of content) {
        if (part.type !== "text") {
          transformedContent.push(part);
          continue;
        }

        const text = part.text;
        
        // Find which pair matches first
        let matchedPair: typeof pairs[0] | null = null;
        let earliestMatchIndex = -1;
        let matchedRegex: RegExp | null = null;

        for (const pair of pairs) {
          const escapedOpening = pair.opening.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const escapedClosing = pair.closing.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const regexp = new RegExp(`${escapedOpening}(.*?)${escapedClosing}`, "gs");
          
          const index = text.indexOf(pair.opening);
          if (index !== -1) {
            if (earliestMatchIndex === -1 || index < earliestMatchIndex) {
              earliestMatchIndex = index;
              matchedPair = pair;
              matchedRegex = regexp;
            }
          }
        }

        if (!matchedPair || !matchedRegex) {
          transformedContent.push(part);
          continue;
        }

        const matches = Array.from(text.matchAll(matchedRegex));
        const reasoningText = matches.map((match) => match[1]).join(separator);
        let textWithoutReasoning = text;
        for (let i = matches.length - 1; i >= 0; i--) {
          const match = matches[i];
          const beforeMatch = textWithoutReasoning.slice(0, match.index);
          const afterMatch = textWithoutReasoning.slice(
            match.index! + match[0].length
          );
          textWithoutReasoning = beforeMatch + (beforeMatch.length > 0 && afterMatch.length > 0 ? separator : "") + afterMatch;
        }

        transformedContent.push({
          type: "reasoning",
          text: reasoningText
        });
        
        transformedContent.push({
          type: "text",
          text: textWithoutReasoning
        });
      }
      return { content: transformedContent, ...rest };
    },
    wrapStream: async ({ doStream }) => {
      const { stream, ...rest } = await doStream();
      const reasoningExtractions = Object.create(null);
      let delayedTextStart: any;
      
      return {
        stream: stream.pipeThrough(
          new TransformStream({
            transform: (chunk, controller) => {
              if (chunk.type === "text-start") {
                delayedTextStart = chunk;
                return;
              }
              if (chunk.type === "text-end" && delayedTextStart) {
                controller.enqueue(delayedTextStart);
                delayedTextStart = void 0;
              }
              if (chunk.type !== "text-delta") {
                controller.enqueue(chunk);
                return;
              }

              if (reasoningExtractions[chunk.id] == null) {
                reasoningExtractions[chunk.id] = {
                  isFirstReasoning: true,
                  isFirstText: true,
                  afterSwitch: false,
                  isReasoning: false,
                  matchedPair: null,
                  buffer: "",
                  idCounter: 0,
                  textId: chunk.id
                };
              }
              const activeExtraction = reasoningExtractions[chunk.id];
              activeExtraction.buffer += chunk.delta;

              function publish(text2: string) {
                if (text2.length > 0) {
                  const prefix = activeExtraction.afterSwitch && (activeExtraction.isReasoning ? !activeExtraction.isFirstReasoning : !activeExtraction.isFirstText) ? separator : "";
                  if (activeExtraction.isReasoning && (activeExtraction.afterSwitch || activeExtraction.isFirstReasoning)) {
                    controller.enqueue({
                      type: "reasoning-start",
                      id: `reasoning-${activeExtraction.idCounter}`
                    });
                  }
                  if (activeExtraction.isReasoning) {
                    controller.enqueue({
                      type: "reasoning-delta",
                      delta: prefix + text2,
                      id: `reasoning-${activeExtraction.idCounter}`
                    });
                  } else {
                    if (delayedTextStart) {
                      controller.enqueue(delayedTextStart);
                      delayedTextStart = void 0;
                    }
                    controller.enqueue({
                      type: "text-delta",
                      delta: prefix + text2,
                      id: activeExtraction.textId
                    });
                  }
                  activeExtraction.afterSwitch = false;
                  if (activeExtraction.isReasoning) {
                    activeExtraction.isFirstReasoning = false;
                  } else {
                    activeExtraction.isFirstText = false;
                  }
                }
              }

              do {
                if (activeExtraction.isReasoning && activeExtraction.matchedPair) {
                  // We are in reasoning mode, look for the closing tag of the matched pair
                  const nextTag = activeExtraction.matchedPair.closing;
                  const startIndex = getPotentialStartIndex(
                    activeExtraction.buffer,
                    nextTag
                  );
                  if (startIndex == null) {
                    publish(activeExtraction.buffer);
                    activeExtraction.buffer = "";
                    break;
                  }
                  publish(activeExtraction.buffer.slice(0, startIndex));
                  const foundFullMatch = startIndex + nextTag.length <= activeExtraction.buffer.length;
                  if (foundFullMatch) {
                    activeExtraction.buffer = activeExtraction.buffer.slice(
                      startIndex + nextTag.length
                    );
                    if (activeExtraction.isFirstReasoning) {
                      controller.enqueue({
                        type: "reasoning-start",
                        id: `reasoning-${activeExtraction.idCounter}`
                      });
                    }
                    controller.enqueue({
                      type: "reasoning-end",
                      id: `reasoning-${activeExtraction.idCounter++}`
                    });
                    activeExtraction.isReasoning = false;
                    activeExtraction.matchedPair = null;
                    activeExtraction.afterSwitch = true;
                  } else {
                    activeExtraction.buffer = activeExtraction.buffer.slice(startIndex);
                    break;
                  }
                } else {
                  // We are in text mode, look for any of the opening tags
                  let earliestStartIndex: number | null = null;
                  let selectedPair: typeof pairs[0] | null = null;

                  for (const pair of pairs) {
                    const idx = getPotentialStartIndex(
                      activeExtraction.buffer,
                      pair.opening
                    );
                    if (idx != null) {
                      if (earliestStartIndex == null || idx < earliestStartIndex) {
                        earliestStartIndex = idx;
                        selectedPair = pair;
                      }
                    }
                  }

                  if (earliestStartIndex == null || selectedPair == null) {
                    publish(activeExtraction.buffer);
                    activeExtraction.buffer = "";
                    break;
                  }

                  publish(activeExtraction.buffer.slice(0, earliestStartIndex));
                  const foundFullMatch = earliestStartIndex + selectedPair.opening.length <= activeExtraction.buffer.length;
                  if (foundFullMatch) {
                    activeExtraction.buffer = activeExtraction.buffer.slice(
                      earliestStartIndex + selectedPair.opening.length
                    );
                    activeExtraction.isReasoning = true;
                    activeExtraction.matchedPair = selectedPair;
                    activeExtraction.afterSwitch = true;
                  } else {
                    activeExtraction.buffer = activeExtraction.buffer.slice(earliestStartIndex);
                    break;
                  }
                }
              } while (true);
            }
          })
        ),
        ...rest
      };
    }
  };
}
