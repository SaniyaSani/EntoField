import JSZip from "jszip";
import * as XLSX from "xlsx";
import { getPhotoBlob } from "./entofield-db";
import type { CollectingEvent, SpecimenRecord } from "./types";

type ExportRow = Record<string, string | number>;

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
        "Event name": event.name,
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
        eventRemarks: event.name,
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

function workbookBlob(rows: ExportRow[]): Blob {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = Object.keys(rows[0] ?? {}).map((header) => ({
    wch: Math.min(34, Math.max(12, header.length + 2)),
  }));
  XLSX.utils.book_append_sheet(workbook, worksheet, "EntoLabel import");
  const data = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadXlsx(rows: ExportRow[], filename: string) {
  downloadBlob(workbookBlob(rows), filename);
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

  zip.file("EntoLabel_import.xlsx", workbookBlob(entoRows));
  zip.file("EntoLabel_import.csv", `\uFEFF${rowsToCsv(entoRows)}`);
  zip.file("Darwin_Core.csv", `\uFEFF${rowsToCsv(dwcRows)}`);
  zip.file(
    "README.txt",
    [
      "EntoField field export",
      "",
      "EntoLabel_import.xlsx and EntoLabel_import.csv contain ordinary table columns",
      "that can be mapped directly in EntoLabel.",
      "Darwin_Core.csv is an optional standards-oriented export.",
      "Event and specimen photographs are stored in the photos folder.",
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
