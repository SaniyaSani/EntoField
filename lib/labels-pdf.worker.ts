import { createLabelsPdf } from "./labels-pdf";
import type { LabelJob, LabelPageOptions } from "./labels";

export type LabelPdfRequest = {
  jobs: LabelJob[];
  title: string;
  options: LabelPageOptions;
};

export type LabelPdfResponse =
  | { result: { bytes: Uint8Array; overflowCount: number } }
  | { error: string };

self.onmessage = async (event: MessageEvent<LabelPdfRequest>) => {
  try {
    const { jobs, title, options } = event.data;
    const result = await createLabelsPdf(jobs, title, options);
    self.postMessage({ result } satisfies LabelPdfResponse, {
      transfer: [result.bytes.buffer as ArrayBuffer],
    });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "The PDF could not be created.",
    } satisfies LabelPdfResponse);
  }
};
