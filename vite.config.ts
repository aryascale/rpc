import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Vite plugin: handles POST /api/scan
 * RFID/NFC software sends:  POST http://localhost:5173/api/scan
 * Body: JSON { "code": "..." } or plain text
 *
 * The code is injected into the client-side global queue via a
 * special SSE endpoint at GET /api/scan/stream.
 */
function rfidApiPlugin(): Plugin {
  // In-memory queue shared between POST handler and SSE clients
  const pendingCodes: string[] = [];
  const sseClients: ServerResponse[] = [];

  function broadcast(code: string) {
    for (const res of sseClients) {
      try {
        res.write(`data: ${JSON.stringify({ code })}\n\n`);
      } catch {
        // dead client — will be pruned on next write
      }
    }
    pendingCodes.push(code);
  }

  return {
    name: "rfid-api",
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        // ── POST /api/scan ──────────────────────────────────────
        if (req.method === "POST" && req.url === "/api/scan") {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const body = Buffer.concat(chunks).toString();

          let codes: string[] = [];
          try {
            const parsed = JSON.parse(body);
            if (Array.isArray(parsed)) {
              for (const item of parsed) {
                const c = item?.e ?? item?.epc ?? item?.EPC ?? item?.code ?? item?.bib ?? item?.id ?? item?.data;
                if (c) codes.push(String(c).trim());
              }
            } else if (parsed && typeof parsed === "object") {
              const c = parsed.e ?? parsed.epc ?? parsed.EPC ?? parsed.code ?? parsed.bib ?? parsed.id ?? parsed.data;
              if (c) codes.push(String(c).trim());
            }
          } catch {
            const matches = [...body.matchAll(/"(?:e|epc|code)"\s*:\s*"([^"]+)"/gi)];
            if (matches.length > 0) {
              codes = matches.map((m) => m[1].trim());
            }
          }

          if (codes.length === 0 && body.trim()) {
            codes = [body.trim()];
          }

          for (const code of codes) {
            broadcast(code);
          }

          res.writeHead(200, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          });
          res.end(JSON.stringify({ ok: true, codes, code: codes[0] ?? "" }));
          return;
        }

        // ── OPTIONS /api/scan (CORS preflight) ──────────────────
        if (req.method === "OPTIONS" && req.url === "/api/scan") {
          res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          });
          res.end();
          return;
        }

        // ── GET /api/scan/stream (SSE) ──────────────────────────
        if (req.method === "GET" && req.url === "/api/scan/stream") {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*",
          });
          res.write(": connected\n\n");

          // Drain any buffered codes
          while (pendingCodes.length > 0) {
            const c = pendingCodes.shift();
            if (c) res.write(`data: ${JSON.stringify({ code: c })}\n\n`);
          }

          sseClients.push(res);
          req.on("close", () => {
            const idx = sseClients.indexOf(res);
            if (idx !== -1) sseClients.splice(idx, 1);
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), rfidApiPlugin()],
});
