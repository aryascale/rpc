/**
 * useQrScanner — Camera-based QR code reader using html5-qrcode.
 *
 * Activates the device camera (preferring the rear camera on mobile),
 * scans for QR codes, and calls `onScan(rawText)` for each unique scan.
 * The rawText is fed directly into `extractLookup` so it handles:
 *   - https://.../verify/<uuid>  → UUID check-in links
 *   - Plain BIB numbers          → "1017"
 *   - Raw EPC hex                → "E280116060000204A8B9C101"
 *   - JSON payloads              → {"e":"...","bib":"..."}
 *
 * Usage:
 *   useQrScanner(onScan, enabled)
 */

import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

type Handler = (code: string) => void;

const QR_ELEMENT_ID = "qr-scanner-container";
// Debounce: ignore the same code within this many ms
const DEBOUNCE_MS = 3000;

export function useQrScanner(onScan: Handler, enabled: boolean) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  useEffect(() => {
    if (!enabled) return;

    let scanner: Html5Qrcode | null = null;
    let stopped = false;

    async function start() {
      try {
        scanner = new Html5Qrcode(QR_ELEMENT_ID, { verbose: false });

        await scanner.start(
          { facingMode: "environment" }, // Rear camera preferred
          {
            fps: 15,
            qrbox: { width: 280, height: 280 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (stopped) return;
            const now = Date.now();
            if (
              lastRef.current.code === decodedText &&
              now - lastRef.current.at < DEBOUNCE_MS
            ) {
              return;
            }
            lastRef.current = { code: decodedText, at: now };
            onScanRef.current(decodedText);
          },
          undefined // ignore decode errors
        );
      } catch (err) {
        console.warn("[useQrScanner] Failed to start camera:", err);
      }
    }

    start();

    return () => {
      stopped = true;
      const instance = scanner;
      if (instance) {
        instance
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              instance.clear();
            } catch {
              // ignore clear errors
            }
          });
      }
    };
  }, [enabled]);
}

export { QR_ELEMENT_ID };
