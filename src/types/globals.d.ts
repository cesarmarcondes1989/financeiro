interface DetectorQr {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
}

interface Window {
  BarcodeDetector?: new (opts?: { formats: string[] }) => DetectorQr;
}
