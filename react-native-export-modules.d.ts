declare module "react-native-html-to-pdf" {
  type PdfOptions = {
    html: string;
    fileName?: string;
    directory?: string;
  };

  type PdfResult = {
    filePath?: string;
  };

  export function generatePDF(options: PdfOptions): Promise<PdfResult>;
}

declare module "react-native-view-shot" {
  import type { RefObject } from "react";
  import type { View } from "react-native";

  type CaptureOptions = {
    format?: "png" | "jpg" | "webm" | "raw";
    quality?: number;
    result?: "tmpfile" | "base64" | "data-uri";
  };

  export function captureRef(ref: RefObject<View | null> | View, options?: CaptureOptions): Promise<string>;
}
