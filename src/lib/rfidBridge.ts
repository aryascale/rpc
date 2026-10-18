/**
 * useRfidBridge — Subscribes to GET /api/scan/stream (Server-Sent Events)
 * which is fed by POST /api/scan (called by the RFID/NFC software).
 *
 * RFID software integration:
 *   POST http://localhost:5173/api/scan
 *   Content-Type: application/json
 *   Body: { "code": "<bib_number_or_uuid>" }
 *
 *   OR plain-text body with just the code string.
 *
 * Response: { "ok": true, "code": "..." }
 *
 * The hook reconnects automatically if the connection drops.
 */

import { useEffect, useRef } from "react";

type Handler = (code: string) => void;

export function useRfidBridge(onScan: Handler, enabled: boolean) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let dead = false;

    function connect() {
      if (dead) return;
      es = new EventSource("/api/scan/stream");

      es.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data) as { code?: string };
          if (parsed.code) onScanRef.current(parsed.code);
        } catch {
          // not JSON — use raw data
          if (e.data) onScanRef.current(e.data.trim());
        }
      };

      es.onerror = () => {
        es?.close();
        if (!dead) {
          retryTimeout = setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      dead = true;
      es?.close();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [enabled]);
}
