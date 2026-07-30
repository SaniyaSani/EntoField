import type ExcelJS from "exceljs";
import JSZip from "jszip";
import { getPhotoBlob } from "./entofield-db";
import type { CollectingEvent, PhotoMeta, SpecimenRecord } from "./types";

type ExportRow = Record<string, string | number>;
type PhotoExportRow = {
  recordId: string;
  eventId: string;
  ownerType: "collecting event" | "specimen / lot";
  photo: PhotoMeta;
};
type PhotoThumbnail = {
  base64: string;
  extension: "jpeg" | "png";
  width: number;
  height: number;
};
export type PhotoThumbnailProvider = (
  photo: PhotoMeta,
) => Promise<PhotoThumbnail | null>;
type CachedWorkbookPhoto = {
  imageId: number;
  thumbnail: PhotoThumbnail;
};
type WorkbookPhotoCache = (
  photo: PhotoMeta,
) => Promise<CachedWorkbookPhoto | null>;

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function dateTime(event: CollectingEvent): string {
  return event.time ? `${event.date}T${event.time}` : event.date;
}

function nameParts(name: string) {
  const parts = name.trim().split(/\s+/);
  return {
    genus: parts[0] ?? "",
    species: parts.length >= 2 ? parts[1] : "",
    subspecies: parts.length >= 3 ? parts[2] : "",
  };
}

export function buildEntoLabelRows(
  events: CollectingEvent[],
  specimens: SpecimenRecord[],
): ExportRow[] {
  const eventMap = new Map(events.map((event) => [event.id, event]));

  return specimens.flatMap((specimen) => {
    const event = eventMap.get(specimen.eventId);
    if (!event) return [];
    const names = nameParts(specimen.scientificName);
    return [
      {
        "Specimen ID": specimen.id,
        "Event ID": event.id,
        Country: event.country,
        Region: event.region,
        Locality: event.locality,
        Latitude: event.latitude ?? "",
        Longitude: event.longitude ?? "",
        "Coordinate uncertainty (m)": event.uncertainty ?? "",
        Altitude: event.altitude ?? "",
        "Collection date": event.date,
        "Collection time": event.time,
        Collector: event.collector,
        "Collecting method": event.method,
        Habitat: event.habitat,
        Host: event.host,
        Weather: event.weather,
        "Record type": specimen.recordType,
        Quantity: specimen.quantity,
        "Scientific name": specimen.scientificName,
        Genus: names.genus,
        Species: names.species,
        Subspecies: names.subspecies,
        Sex: specimen.sex,
        "Life stage": specimen.lifeStage,
        Identifier: specimen.identifier,
        Notes: [event.notes, specimen.notes].filter(Boolean).join(" | "),
        "Photo filenames": [
          ...event.photos.map((photo) => photo.filename),
          ...specimen.photos.map((photo) => photo.filename),
        ].join("; "),
      },
    ];
  });
}

export function buildDarwinCoreRows(
  events: CollectingEvent[],
  specimens: SpecimenRecord[],
): ExportRow[] {
  const eventMap = new Map(events.map((event) => [event.id, event]));

  return specimens.flatMap((specimen) => {
    const event = eventMap.get(specimen.eventId);
    if (!event) return [];
    return [
      {
        catalogNumber: specimen.id,
        eventID: event.id,
        basisOfRecord: "PreservedSpecimen",
        eventDate: dateTime(event),
        country: event.country,
        stateProvince: event.region,
        locality: event.locality,
        decimalLatitude: event.latitude ?? "",
        decimalLongitude: event.longitude ?? "",
        coordinateUncertaintyInMeters: event.uncertainty ?? "",
        minimumElevationInMeters: event.altitude ?? "",
        recordedBy: event.collector,
        samplingProtocol: event.method,
        habitat: event.habitat,
        associatedTaxa: event.host,
        individualCount: specimen.quantity,
        scientificName: specimen.scientificName,
        identifiedBy: specimen.identifier,
        sex: specimen.sex,
        lifeStage: specimen.lifeStage,
        occurrenceRemarks: [event.weather, event.notes, specimen.notes]
          .filter(Boolean)
          .join(" | "),
      },
    ];
  });
}

function csvValue(value: string | number): string {
  const stringValue = String(value ?? "");
  return /[",\n\r]/.test(stringValue)
    ? `"${stringValue.replaceAll('"', '""')}"`
    : stringValue;
}

export function rowsToCsv(rows: ExportRow[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.map(csvValue).join(","),
    ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(",")),
  ].join("\r\n");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function downloadCsv(rows: ExportRow[], filename: string) {
  downloadBlob(
    new Blob([`\uFEFF${rowsToCsv(rows)}`], {
      type: "text/csv;charset=utf-8",
    }),
    filename,
  );
}

function styleHeader(row: ExcelJS.Row) {
  row.height = 24;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF3B0D32" },
    };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
}

function addEntoLabelSheet(workbook: ExcelJS.Workbook, rows: ExportRow[]) {
  const worksheet = workbook.addWorksheet("EntoLabel import", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const headers = Object.keys(rows[0] ?? {});
  if (!headers.length) return;

  styleHeader(worksheet.addRow(headers));
  for (const row of rows) {
    worksheet.addRow(headers.map((header) => row[header] ?? ""));
  }

  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, worksheet.rowCount), column: headers.length },
  };
  headers.forEach((header, index) => {
    const contentWidth = rows.reduce(
      (maximum, row) => Math.max(maximum, String(row[header] ?? "").length),
      header.length,
    );
    worksheet.getColumn(index + 1).width = Math.min(
      34,
      Math.max(12, contentWidth + 2),
    );
  });
}

function collectPhotoRows(
  events: CollectingEvent[],
  specimens: SpecimenRecord[],
): PhotoExportRow[] {
  return [
    ...events.flatMap((event) =>
      event.photos.map((photo) => ({
        recordId: event.id,
        eventId: event.id,
        ownerType: "collecting event" as const,
        photo,
      })),
    ),
    ...specimens.flatMap((specimen) =>
      specimen.photos.map((photo) => ({
        recordId: specimen.id,
        eventId: specimen.eventId,
        ownerType: "specimen / lot" as const,
        photo,
      })),
    ),
  ];
}

async function thumbnailForExcel(blob: Blob): Promise<PhotoThumbnail | null> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    const maximumWidth = 300;
    const maximumHeight = 168;
    const scale = Math.min(
      maximumWidth / image.naturalWidth,
      maximumHeight / image.naturalHeight,
      1,
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return {
      base64: canvas.toDataURL("image/jpeg", 0.78),
      extension: "jpeg" as const,
      width,
      height,
    };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function createWorkbookPhotoCache(
  workbook: ExcelJS.Workbook,
  thumbnailProvider: PhotoThumbnailProvider,
): WorkbookPhotoCache {
  const cachedPhotos = new Map<
    string,
    Promise<CachedWorkbookPhoto | null>
  >();

  return (photo: PhotoMeta) => {
    const existing = cachedPhotos.get(photo.id);
    if (existing) return existing;

    const pending = (async () => {
      const thumbnail = await thumbnailProvider(photo);
      if (!thumbnail) return null;
      return {
        thumbnail,
        imageId: workbook.addImage({
          base64: thumbnail.base64,
          extension: thumbnail.extension,
        }),
      };
    })();
    cachedPhotos.set(photo.id, pending);
    return pending;
  };
}

function fittedDimensions(
  thumbnail: PhotoThumbnail,
  maximumWidth: number,
  maximumHeight: number,
) {
  const scale = Math.min(
    maximumWidth / thumbnail.width,
    maximumHeight / thumbnail.height,
    1,
  );
  return {
    width: Math.max(1, Math.round(thumbnail.width * scale)),
    height: Math.max(1, Math.round(thumbnail.height * scale)),
  };
}

async function placePhoto(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  columnNumber: number,
  photo: PhotoMeta | undefined,
  photoCache: WorkbookPhotoCache,
  maximumWidth: number,
  maximumHeight: number,
) {
  if (!photo) return false;
  const cached = await photoCache(photo);
  if (!cached) return false;
  const dimensions = fittedDimensions(
    cached.thumbnail,
    maximumWidth,
    maximumHeight,
  );
  worksheet.addImage(cached.imageId, {
    tl: { col: columnNumber - 0.92, row: rowNumber - 0.94 },
    ext: dimensions,
    editAs: "oneCell",
  });
  return true;
}

function joinedLines(values: Array<string | number | undefined>) {
  return values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join("\n");
}

async function addVisualCatalogSheet(
  workbook: ExcelJS.Workbook,
  events: CollectingEvent[],
  specimens: SpecimenRecord[],
  photoCache: WorkbookPhotoCache,
) {
  const worksheet = workbook.addWorksheet("Visual specimen catalog", {
    views: [
      {
        state: "frozen",
        xSplit: 2,
        ySplit: 4,
        topLeftCell: "C5",
        showGridLines: false,
      },
    ],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  const columnCount = 11;
  const eventMap = new Map(events.map((event) => [event.id, event]));

  worksheet.mergeCells("A1:K1");
  worksheet.mergeCells("A2:K2");
  for (let row = 1; row <= 2; row += 1) {
    for (let column = 1; column <= columnCount; column += 1) {
      worksheet.getCell(row, column).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: row === 1 ? "FF3B0D32" : "FF5B254E" },
      };
    }
  }
  worksheet.getCell("A1").value = "Visual specimen catalog";
  worksheet.getCell("A1").font = {
    bold: true,
    size: 19,
    color: { argb: "FFFFFFFF" },
  };
  worksheet.getCell("A1").alignment = {
    vertical: "middle",
    horizontal: "left",
  };
  worksheet.getCell("A2").value =
    `${specimens.length} specimen / lot rows from ${events.length} collecting ` +
    `event${events.length === 1 ? "" : "s"}` +
    "  •  embedded previews  •  full originals remain in the complete ZIP";
  worksheet.getCell("A2").font = {
    size: 10,
    color: { argb: "FFFFF5EE" },
  };
  worksheet.getCell("A2").alignment = { vertical: "middle" };
  worksheet.getRow(1).height = 34;
  worksheet.getRow(2).height = 24;
  worksheet.getRow(3).height = 8;

  worksheet.columns = [
    { key: "specimenPhoto", width: 34 },
    { key: "eventPhoto", width: 34 },
    { key: "specimenId", width: 27 },
    { key: "eventId", width: 24 },
    { key: "scientificName", width: 23 },
    { key: "record", width: 18 },
    { key: "collected", width: 18 },
    { key: "locality", width: 29 },
    { key: "habitat", width: 29 },
    { key: "method", width: 24 },
    { key: "identification", width: 34 },
  ];
  const headers = [
    "Specimen photo",
    "Event / habitat photo",
    "Specimen ID",
    "Event ID",
    "Scientific name",
    "Record",
    "Collected",
    "Locality & GPS",
    "Habitat / host / weather",
    "Method / collector",
    "Identification & notes",
  ];
  const headerRow = worksheet.getRow(4);
  headerRow.values = headers;
  styleHeader(headerRow);
  headerRow.height = 32;
  worksheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: Math.max(4, specimens.length + 4), column: columnCount },
  };

  let previousEventId = "";
  for (const specimen of specimens) {
    const event = eventMap.get(specimen.eventId);
    if (!event) continue;
    const specimenPhotoCount = specimen.photos.length;
    const eventPhotoCount = event.photos.length;
    const excelRow = worksheet.addRow({
      specimenPhoto: specimenPhotoCount
        ? `${specimenPhotoCount} specimen photo${specimenPhotoCount === 1 ? "" : "s"}`
        : "No specimen photo",
      eventPhoto: eventPhotoCount
        ? `${eventPhotoCount} event photo${eventPhotoCount === 1 ? "" : "s"}`
        : "No event photo",
      specimenId: specimen.id,
      eventId: event.id,
      scientificName: specimen.scientificName || "Not identified",
      record: joinedLines([
        `${specimen.recordType} · qty ${specimen.quantity}`,
        specimen.sex,
        specimen.lifeStage,
        `Photos: ${specimenPhotoCount} specimen / ${eventPhotoCount} event`,
      ]),
      collected: joinedLines([event.date, event.time]),
      locality: joinedLines([
        [event.locality, event.region, event.country].filter(Boolean).join(", "),
        event.latitude !== undefined && event.longitude !== undefined
          ? `${event.latitude.toFixed(5)}, ${event.longitude.toFixed(5)}`
          : "",
        event.uncertainty ? `± ${Math.round(event.uncertainty)} m` : "",
        event.altitude !== undefined ? `${event.altitude} m a.s.l.` : "",
      ]),
      habitat: joinedLines([
        event.habitat,
        event.host ? `Host: ${event.host}` : "",
        event.weather,
      ]),
      method: joinedLines([event.method, event.collector]),
      identification: joinedLines([
        specimen.identifier ? `Identified by: ${specimen.identifier}` : "",
        event.notes,
        specimen.notes,
      ]),
    });
    excelRow.height = 132;
    excelRow.alignment = { vertical: "middle", wrapText: true };

    const alternatingFill =
      excelRow.number % 2 === 0 ? "FFFFFBF6" : "FFF5F9F6";
    excelRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: alternatingFill },
      };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE7DDE4" } },
      };
      cell.font = { size: 10, color: { argb: "FF262126" } };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
    if (event.id !== previousEventId) {
      excelRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          ...cell.border,
          top: { style: "medium", color: { argb: "FF4E7D6E" } },
        };
      });
      previousEventId = event.id;
    }
    excelRow.getCell(3).font = {
      bold: true,
      size: 10,
      color: { argb: "FF3B0D32" },
    };
    excelRow.getCell(5).font = {
      italic: Boolean(specimen.scientificName),
      bold: Boolean(specimen.scientificName),
      size: 11,
      color: { argb: "FF3B0D32" },
    };
    excelRow.getCell(1).font = {
      italic: true,
      size: 9,
      color: { argb: "FF6F646B" },
    };
    excelRow.getCell(2).font = {
      italic: true,
      size: 9,
      color: { argb: "FF6F646B" },
    };

    const specimenPlaced = await placePhoto(
      worksheet,
      excelRow.number,
      1,
      specimen.photos[0],
      photoCache,
      220,
      145,
    );
    const eventPlaced = await placePhoto(
      worksheet,
      excelRow.number,
      2,
      event.photos[0],
      photoCache,
      220,
      145,
    );
    if (specimenPlaced) excelRow.getCell(1).value = "";
    else if (specimen.photos[0]) {
      excelRow.getCell(1).value =
        `Preview unavailable\n${specimen.photos[0].filename}`;
    }
    if (eventPlaced) excelRow.getCell(2).value = "";
    else if (event.photos[0]) {
      excelRow.getCell(2).value =
        `Preview unavailable\n${event.photos[0].filename}`;
    }
  }
}

async function addPhotosSheet(
  workbook: ExcelJS.Workbook,
  events: CollectingEvent[],
  specimens: SpecimenRecord[],
  photoCache: WorkbookPhotoCache,
) {
  const worksheet = workbook.addWorksheet("Photos", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  worksheet.columns = [
    { header: "Record ID", key: "recordId", width: 27 },
    { header: "Event ID", key: "eventId", width: 24 },
    { header: "Owner type", key: "ownerType", width: 18 },
    { header: "Filename", key: "filename", width: 34 },
    { header: "Photo", key: "preview", width: 44 },
  ];
  styleHeader(worksheet.getRow(1));
  worksheet.autoFilter = "A1:E1";

  const rows = collectPhotoRows(events, specimens);
  if (!rows.length) {
    worksheet.addRow({
      recordId: "No photographs are attached to this export.",
    });
    worksheet.mergeCells("A2:E2");
    worksheet.getCell("A2").font = { italic: true, color: { argb: "FF666666" } };
    return;
  }

  for (const item of rows) {
    const excelRow = worksheet.addRow({
      recordId: item.recordId,
      eventId: item.eventId,
      ownerType: item.ownerType,
      filename: item.photo.filename,
      preview: "Preparing preview…",
    });
    excelRow.height = 132;
    excelRow.alignment = { vertical: "middle", wrapText: true };

    const placed = await placePhoto(
      worksheet,
      excelRow.number,
      5,
      item.photo,
      photoCache,
      300,
      168,
    );
    if (!placed) {
      excelRow.getCell(5).value =
        "Preview unavailable. The original photograph is included in the complete ZIP export.";
      excelRow.getCell(5).font = { italic: true, color: { argb: "FF666666" } };
      continue;
    }

    excelRow.getCell(5).value = "";
  }
}

async function storedPhotoThumbnail(photo: PhotoMeta) {
  const blob = await getPhotoBlob(photo.id);
  return blob ? thumbnailForExcel(blob) : null;
}

export async function createEntoFieldWorkbookBuffer(
  events: CollectingEvent[],
  specimens: SpecimenRecord[],
  thumbnailProvider: PhotoThumbnailProvider = storedPhotoThumbnail,
) {
  const { default: ExcelJSRuntime } = await import("exceljs");
  const workbook = new ExcelJSRuntime.Workbook();
  workbook.creator = "EntoField";
  workbook.created = new Date();
  workbook.modified = new Date();
  addEntoLabelSheet(workbook, buildEntoLabelRows(events, specimens));
  const photoCache = createWorkbookPhotoCache(workbook, thumbnailProvider);
  await addVisualCatalogSheet(workbook, events, specimens, photoCache);
  await addPhotosSheet(workbook, events, specimens, photoCache);
  return workbook.xlsx.writeBuffer();
}

async function workbookBlobWithPhotos(
  events: CollectingEvent[],
  specimens: SpecimenRecord[],
): Promise<Blob> {
  const data = await createEntoFieldWorkbookBuffer(events, specimens);
  return new Blob([data as unknown as ArrayBuffer], { type: XLSX_MIME });
}

export async function downloadXlsxWithPhotos(
  events: CollectingEvent[],
  specimens: SpecimenRecord[],
  filename: string,
) {
  downloadBlob(await workbookBlobWithPhotos(events, specimens), filename);
}

function safeFilename(value: string): string {
  return value.replace(/[^\p{L}\p{N}._-]+/gu, "_");
}

export async function downloadCompleteZip(
  events: CollectingEvent[],
  specimens: SpecimenRecord[],
) {
  const zip = new JSZip();
  const entoRows = buildEntoLabelRows(events, specimens);
  const dwcRows = buildDarwinCoreRows(events, specimens);

  zip.file(
    "EntoLabel_import.xlsx",
    await workbookBlobWithPhotos(events, specimens),
  );
  zip.file("EntoLabel_import.csv", `\uFEFF${rowsToCsv(entoRows)}`);
  zip.file("Darwin_Core.csv", `\uFEFF${rowsToCsv(dwcRows)}`);
  zip.file(
    "README.txt",
    [
      "EntoField field export",
      "",
      "EntoLabel_import.xlsx contains a clean EntoLabel import table, a Visual",
      "specimen catalog with photographs in each specimen row, and a Photos index.",
      "EntoLabel_import.csv contains the same ordinary import columns.",
      "Darwin_Core.csv is an optional standards-oriented export.",
      "Full-resolution event and specimen photographs are stored in the photos folder.",
      "",
      `Events: ${events.length}`,
      `Rows: ${specimens.length}`,
      `Created: ${new Date().toISOString()}`,
    ].join("\n"),
  );

  for (const event of events) {
    for (const photo of event.photos) {
      const blob = await getPhotoBlob(photo.id);
      if (blob) {
        zip.file(
          `photos/events/${safeFilename(event.id)}/${safeFilename(photo.filename)}`,
          blob,
        );
      }
    }
  }

  for (const specimen of specimens) {
    for (const photo of specimen.photos) {
      const blob = await getPhotoBlob(photo.id);
      if (blob) {
        zip.file(
          `photos/specimens/${safeFilename(specimen.id)}/${safeFilename(photo.filename)}`,
          blob,
        );
      }
    }
  }

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  downloadBlob(blob, `EntoField_export_${new Date().toISOString().slice(0, 10)}.zip`);
}
