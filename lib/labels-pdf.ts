import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import type { PDFFont, PDFPage } from "pdf-lib";
import type {
  LabelJob,
  LabelLine,
  LabelLineStyle,
  LabelSettings,
} from "./labels";

const POINTS_PER_MM = 72 / 25.4;
const A4_WIDTH = 210 * POINTS_PER_MM;
const A4_HEIGHT = 297 * POINTS_PER_MM;
const PAGE_MARGIN = 7 * POINTS_PER_MM;
const LABEL_GAP = 1.5 * POINTS_PER_MM;
const INNER_PADDING = 0.45 * POINTS_PER_MM;
const MINIMUM_FONT_SIZE = 3;

type EmbeddedFonts = Record<LabelLineStyle, PDFFont>;

let fontBytesPromise:
  | Promise<{ regular: ArrayBuffer; bold: ArrayBuffer; italic: ArrayBuffer }>
  | undefined;

function getFontBytes() {
  if (!fontBytesPromise) {
    fontBytesPromise = Promise.all([
      fetch("/fonts/DejaVuSans.ttf").then((response) => {
        if (!response.ok) throw new Error("Could not load the regular PDF font.");
        return response.arrayBuffer();
      }),
      fetch("/fonts/DejaVuSans-Bold.ttf").then((response) => {
        if (!response.ok) throw new Error("Could not load the bold PDF font.");
        return response.arrayBuffer();
      }),
      fetch("/fonts/DejaVuSans-Oblique.ttf").then((response) => {
        if (!response.ok) throw new Error("Could not load the italic PDF font.");
        return response.arrayBuffer();
      }),
    ]).then(([regular, bold, italic]) => ({ regular, bold, italic }));
  }
  return fontBytesPromise;
}

async function embedFonts(document: PDFDocument): Promise<EmbeddedFonts> {
  document.registerFontkit(fontkit);
  const bytes = await getFontBytes();
  const [regular, bold, italic] = await Promise.all([
    document.embedFont(bytes.regular, { subset: true }),
    document.embedFont(bytes.bold, { subset: true }),
    document.embedFont(bytes.italic, { subset: true }),
  ]);
  return { regular, bold, italic };
}

function splitLongToken(
  token: string,
  font: PDFFont,
  fontSize: number,
  maximumWidth: number,
): string[] {
  const fragments: string[] = [];
  let fragment = "";
  for (const character of token) {
    const candidate = `${fragment}${character}`;
    if (fragment && font.widthOfTextAtSize(candidate, fontSize) > maximumWidth) {
      fragments.push(fragment);
      fragment = character;
    } else {
      fragment = candidate;
    }
  }
  if (fragment) fragments.push(fragment);
  return fragments;
}

function wrapLine(
  line: LabelLine,
  font: PDFFont,
  fontSize: number,
  maximumWidth: number,
): LabelLine[] {
  const words = line.text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const output: LabelLine[] = [];
  let current = "";

  for (const rawWord of words) {
    const fragments =
      font.widthOfTextAtSize(rawWord, fontSize) > maximumWidth
        ? splitLongToken(rawWord, font, fontSize, maximumWidth)
        : [rawWord];
    for (const fragment of fragments) {
      const candidate = current ? `${current} ${fragment}` : fragment;
      if (
        current &&
        font.widthOfTextAtSize(candidate, fontSize) > maximumWidth
      ) {
        output.push({ text: current, style: line.style });
        current = fragment;
      } else {
        current = candidate;
      }
    }
  }
  if (current) output.push({ text: current, style: line.style });
  return output;
}

function prepareLabel(
  rawLines: LabelLine[],
  settings: LabelSettings,
  fonts: EmbeddedFonts,
  availableWidth: number,
  availableHeight: number,
) {
  const upperFontSize = Math.max(
    settings.preferredFontSize,
    settings.maximumFontSize,
  );
  for (
    let fontSize = upperFontSize;
    fontSize >= MINIMUM_FONT_SIZE;
    fontSize -= 0.25
  ) {
    const lines = rawLines.flatMap((line) =>
      wrapLine(line, fonts[line.style], fontSize, availableWidth),
    );
    const lineHeight = fontSize * settings.lineSpacing;
    const height = lines.length
      ? fontSize + Math.max(0, lines.length - 1) * lineHeight
      : 0;
    if (height <= availableHeight) {
      return { lines, fontSize, lineHeight, fits: true };
    }
  }

  const fontSize = MINIMUM_FONT_SIZE;
  const lines = rawLines.flatMap((line) =>
    wrapLine(line, fonts[line.style], fontSize, availableWidth),
  );
  return {
    lines,
    fontSize,
    lineHeight: fontSize * settings.lineSpacing,
    fits: false,
  };
}

function drawLabel(
  page: PDFPage,
  job: LabelJob,
  fonts: EmbeddedFonts,
  x: number,
  y: number,
): boolean {
  const width = job.settings.widthMm * POINTS_PER_MM;
  const height = job.settings.heightMm * POINTS_PER_MM;
  const availableWidth = width - 2 * INNER_PADDING;
  const availableHeight = height - 2 * INNER_PADDING;
  const prepared = prepareLabel(
    job.lines,
    job.settings,
    fonts,
    availableWidth,
    availableHeight,
  );

  if (job.settings.drawBorders) {
    page.drawRectangle({
      x,
      y,
      width,
      height,
      borderColor: rgb(0.25, 0.25, 0.25),
      borderWidth: 0.2,
    });
  }

  const blockHeight = prepared.lines.length
    ? prepared.fontSize +
      Math.max(0, prepared.lines.length - 1) * prepared.lineHeight
    : 0;
  let textY =
    y +
    INNER_PADDING +
    (availableHeight + blockHeight) / 2 -
    prepared.fontSize;
  const minimumY = y + INNER_PADDING - 0.01;

  for (const line of prepared.lines) {
    if (textY < minimumY) break;
    page.drawText(line.text, {
      x: x + INNER_PADDING,
      y: textY,
      size: prepared.fontSize,
      font: fonts[line.style],
      color: rgb(0.05, 0.05, 0.05),
    });
    textY -= prepared.lineHeight;
  }
  return prepared.fits;
}

export async function createLabelsPdf(
  jobs: LabelJob[],
  title: string,
): Promise<{ bytes: Uint8Array; overflowCount: number }> {
  if (!jobs.length) throw new Error("There are no labels to create.");
  const document = await PDFDocument.create();
  document.setTitle(title);
  document.setCreator("EntoField · integrated EntoLabel");
  document.setCreationDate(new Date());
  const fonts = await embedFonts(document);
  let page = document.addPage([A4_WIDTH, A4_HEIGHT]);
  let x = PAGE_MARGIN;
  let top = A4_HEIGHT - PAGE_MARGIN;
  let rowHeight = 0;
  let overflowCount = 0;

  for (const job of jobs) {
    const width = job.settings.widthMm * POINTS_PER_MM;
    const height = job.settings.heightMm * POINTS_PER_MM;
    if (x + width > A4_WIDTH - PAGE_MARGIN + 0.01) {
      x = PAGE_MARGIN;
      top -= rowHeight + LABEL_GAP;
      rowHeight = 0;
    }
    if (top - height < PAGE_MARGIN) {
      page = document.addPage([A4_WIDTH, A4_HEIGHT]);
      x = PAGE_MARGIN;
      top = A4_HEIGHT - PAGE_MARGIN;
      rowHeight = 0;
    }
    if (!drawLabel(page, job, fonts, x, top - height)) overflowCount += 1;
    x += width + LABEL_GAP;
    rowHeight = Math.max(rowHeight, height);
  }

  return { bytes: await document.save(), overflowCount };
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
