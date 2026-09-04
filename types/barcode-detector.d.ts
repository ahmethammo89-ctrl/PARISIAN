// Minimal ambient typing for the native Barcode Detection API — not yet in
// TypeScript's lib.dom.d.ts. Supported on Chrome/Edge/Android; ScanClient
// feature-detects `"BarcodeDetector" in window` before using it and falls
// back to manual/HID-scanner text entry everywhere else.
interface DetectedBarcode {
  rawValue: string;
  format: string;
}

declare class BarcodeDetector {
  constructor(options?: { formats?: string[] });
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

interface Window {
  BarcodeDetector?: typeof BarcodeDetector;
}
