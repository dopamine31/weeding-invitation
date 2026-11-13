/** Server-Sent Events helper: pushes `produce()` output every `ms`, cleans up on disconnect. */
export function sseResponse(req: Request, produce: () => Promise<unknown>, ms = 3000): Response {
  const enc = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const push = async () => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(await produce())}\n\n`));
        } catch {
          controller.enqueue(enc.encode(`event: error\ndata: {}\n\n`));
        }
      };
      controller.enqueue(enc.encode("retry: 3000\n\n"));
      void push();
      timer = setInterval(push, ms);
      req.signal.addEventListener("abort", () => {
        closed = true;
        if (timer) clearInterval(timer);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() { if (timer) clearInterval(timer); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
