import { extractFlexibleReasoningMiddleware } from "@/lib/ai/flexible-reasoning-middleware";

describe("extractFlexibleReasoningMiddleware", () => {
  describe("wrapGenerate", () => {
    it("should extract standard think tags", async () => {
      const middleware = extractFlexibleReasoningMiddleware();
      const doGenerate = jest.fn().mockResolvedValue({
        content: [
          { type: "text", text: "<think>thinking process</think>final answer" },
        ],
      });

      const result = await middleware.wrapGenerate!({
        doGenerate,
        params: {} as any,
        model: {} as any,
      });

      expect(result.content).toEqual([
        { type: "reasoning", text: "thinking process" },
        { type: "text", text: "final answer" },
      ]);
    });

    it("should extract Gemma channel thought tags with <|channel>text", async () => {
      const middleware = extractFlexibleReasoningMiddleware();
      const doGenerate = jest.fn().mockResolvedValue({
        content: [
          { type: "text", text: "<|channel>thoughtthinking process<|channel>textfinal answer" },
        ],
      });

      const result = await middleware.wrapGenerate!({
        doGenerate,
        params: {} as any,
        model: {} as any,
      });

      expect(result.content).toEqual([
        { type: "reasoning", text: "thinking process" },
        { type: "text", text: "final answer" },
      ]);
    });

    it("should extract Gemma channel thought tags with <channel|>", async () => {
      const middleware = extractFlexibleReasoningMiddleware();
      const doGenerate = jest.fn().mockResolvedValue({
        content: [
          { type: "text", text: "<|channel>thoughtthinking process<channel|>final answer" },
        ],
      });

      const result = await middleware.wrapGenerate!({
        doGenerate,
        params: {} as any,
        model: {} as any,
      });

      expect(result.content).toEqual([
        { type: "reasoning", text: "thinking process" },
        { type: "text", text: "final answer" },
      ]);
    });

    it("should pass through text without reasoning tags", async () => {
      const middleware = extractFlexibleReasoningMiddleware();
      const doGenerate = jest.fn().mockResolvedValue({
        content: [
          { type: "text", text: "regular text content without tags" },
        ],
      });

      const result = await middleware.wrapGenerate!({
        doGenerate,
        params: {} as any,
        model: {} as any,
      });

      expect(result.content).toEqual([
        { type: "text", text: "regular text content without tags" },
      ]);
    });
  });

  describe("wrapStream", () => {
    async function collectStream(stream: ReadableStream<any>) {
      const reader = stream.getReader();
      const chunks: any[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      return chunks;
    }

    it("should stream standard think tags", async () => {
      const middleware = extractFlexibleReasoningMiddleware();
      
      const inputChunks = [
        { type: "text-start", id: "1" },
        { type: "text-delta", delta: "hello <th", id: "1" },
        { type: "text-delta", delta: "ink>thinking", id: "1" },
        { type: "text-delta", delta: " process</th", id: "1" },
        { type: "text-delta", delta: "ink> final", id: "1" },
        { type: "text-delta", delta: " answer", id: "1" },
        { type: "text-end", id: "1" },
      ];

      const readable = new ReadableStream({
        start(controller) {
          for (const chunk of inputChunks) {
            controller.enqueue(chunk);
          }
          controller.close();
        },
      });

      const doStream = jest.fn().mockResolvedValue({
        stream: readable,
      });

      const { stream } = await middleware.wrapStream!({
        doStream,
        params: {} as any,
        model: {} as any,
      });

      const outputChunks = await collectStream(stream);

      // Verify that reasoning-start, reasoning-delta, reasoning-end, and text-delta
      // are generated and tagged correctly.
      expect(outputChunks).toContainEqual(expect.objectContaining({ type: "reasoning-start" }));
      expect(outputChunks).toContainEqual(expect.objectContaining({ type: "reasoning-delta", delta: "thinking" }));
      expect(outputChunks).toContainEqual(expect.objectContaining({ type: "reasoning-delta", delta: " process" }));
      expect(outputChunks).toContainEqual(expect.objectContaining({ type: "reasoning-end" }));
      expect(outputChunks).toContainEqual(expect.objectContaining({ type: "text-delta", delta: "hello " }));
      expect(outputChunks).toContainEqual(expect.objectContaining({ type: "text-delta", delta: " final" }));
      expect(outputChunks).toContainEqual(expect.objectContaining({ type: "text-delta", delta: " answer" }));
    });

    it("should stream Gemma channel thought tags", async () => {
      const middleware = extractFlexibleReasoningMiddleware();
      
      const inputChunks = [
        { type: "text-start", id: "1" },
        { type: "text-delta", delta: "<|channel>th", id: "1" },
        { type: "text-delta", delta: "oughtthinking", id: "1" },
        { type: "text-delta", delta: " process<|chan", id: "1" },
        { type: "text-delta", delta: "nel>text final answer", id: "1" },
        { type: "text-end", id: "1" },
      ];

      const readable = new ReadableStream({
        start(controller) {
          for (const chunk of inputChunks) {
            controller.enqueue(chunk);
          }
          controller.close();
        },
      });

      const doStream = jest.fn().mockResolvedValue({
        stream: readable,
      });

      const { stream } = await middleware.wrapStream!({
        doStream,
        params: {} as any,
        model: {} as any,
      });

      const outputChunks = await collectStream(stream);

      expect(outputChunks).toContainEqual(expect.objectContaining({ type: "reasoning-start" }));
      expect(outputChunks).toContainEqual(expect.objectContaining({ type: "reasoning-delta", delta: "thinking" }));
      expect(outputChunks).toContainEqual(expect.objectContaining({ type: "reasoning-delta", delta: " process" }));
      expect(outputChunks).toContainEqual(expect.objectContaining({ type: "reasoning-end" }));
      expect(outputChunks).toContainEqual(expect.objectContaining({ type: "text-delta", delta: " final answer" }));
    });
  });
});
