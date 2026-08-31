import type { CollectingEvent, SpecimenRecord } from "./types";

export type LabelLineStyle = "regular" | "bold" | "italic";

export type LabelLine = {
  text: string;
  style: LabelLineStyle;
};

export type LabelSettings = {
  widthMm: number;
  heightMm: number;
  preferredFontSize: number;
  maximumFontSize: number;
  lineSpacing: number;
  drawBorders: boolean;
};

export type CollectionLabelOptions = {
  includeCoordinates: boolean;
  shortenCollectorNames: boolean;
  dateFormat: "roman" | "slash" | "iso";
};

export type DeterminationLabelOptions = {
  shortenIdentifierNames: boolean;
  identificationYear: string;
};

export type LabelJob = {
  lines: LabelLine[];
  settings: LabelSettings;
};

export const DEFAULT_COLLECTION_LABEL_SETTINGS: LabelSettings = {
  widthMm: 20,
  heightMm: 10,
  preferredFontSize: 5,
  maximumFontSize: 6.5,
  lineSpacing: 1,
  drawBorders: true,
};

export const DEFAULT_DETERMINATION_LABEL_SETTINGS: LabelSettings = {
  widthMm: 20,
  heightMm: 7,
  preferredFontSize: 5,
  maximumFontSize: 6.5,
  lineSpacing: 1,
  drawBorders: true,
};

const ROMAN_MONTHS = [
  "",
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
];

function clean(value: string | undefined | null): string {
  return value?.trim() ?? "";
}

export function shortenPersonName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts.join(" ");
  const [firstName, ...surname] = parts;
  if (/^[\p{L}]\.$/u.test(firstName)) return parts.join(" ");
  return `${firstName[0]}. ${surname.join(" ")}`;
}

export function formatPeople(value: string, shorten: boolean): string {
  const people = value
    .replaceAll(";", ",")
    .split(",")
    .map((person) => person.trim())
    .filter(Boolean);
  return people
    .map((person) => (shorten ? shortenPersonName(person) : person))
    .join(", ");
}

export function formatCollectionDate(
  value: string,
  format: CollectionLabelOptions["dateFormat"],
): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, monthText, dayText] = match;
  const month = Number(monthText);
  const day = Number(dayText);
  if (format === "slash") return `${dayText}/${monthText}/${year}`;
  if (format === "iso") return value;
  return `${day}.${ROMAN_MONTHS[month]}.${year}`;
}

function formatCoordinate(value: number, latitude: boolean): string {
  const direction = latitude
    ? value >= 0
      ? "N"
      : "S"
    : value >= 0
      ? "E"
      : "W";
  return `${Math.abs(value).toFixed(4)}° ${direction}`;
}

function appendInline(base: string, extra: string): string {
  if (base && extra) return `${base} · ${extra}`;
  return base || extra;
}

export function buildCollectionLabelLines(
  event: CollectingEvent,
  identifier: string,
  options: CollectionLabelOptions,
): LabelLine[] {
  const locality = [event.country, event.region, event.locality]
    .map(clean)
    .filter(Boolean)
    .join(", ");
  const firstLine = appendInline(clean(identifier), locality);

  let coordinates = "";
  if (
    options.includeCoordinates &&
    typeof event.latitude === "number" &&
    typeof event.longitude === "number"
  ) {
    coordinates = `${formatCoordinate(event.latitude, true)}, ${formatCoordinate(
      event.longitude,
      false,
    )}`;
  }

  const altitude =
    options.includeCoordinates && typeof event.altitude === "number"
      ? `${Math.round(event.altitude)} m`
      : "";
  const date = formatCollectionDate(event.date, options.dateFormat);
  const collectors = formatPeople(
    clean(event.collector),
    options.shortenCollectorNames,
  );
  const collectorLine = collectors ? `leg. ${collectors}` : "";
  const metadata = [altitude, date, collectorLine].filter(Boolean).join(" · ");

  return [firstLine, coordinates, metadata]
    .filter(Boolean)
    .map((text) => ({ text, style: "regular" as const }));
}

export function buildDeterminationLabelLines(
  specimen: SpecimenRecord,
  options: DeterminationLabelOptions,
): LabelLine[] {
  const identifier = formatPeople(
    clean(specimen.identifier),
    options.shortenIdentifierNames,
  );
  const determination = [identifier, clean(options.identificationYear)]
    .filter(Boolean)
    .join(" ");

  return [
    clean(specimen.id)
      ? { text: clean(specimen.id), style: "bold" as const }
      : null,
    clean(specimen.scientificName)
      ? { text: clean(specimen.scientificName), style: "italic" as const }
      : null,
    determination
      ? { text: `det. ${determination}`, style: "regular" as const }
      : null,
  ].filter((line): line is LabelLine => Boolean(line));
}

export function makeCollectionLabelJobs({
  event,
  records,
  source,
  copies,
  includeIdentifier,
  options,
  settings,
}: {
  event: CollectingEvent;
  records: SpecimenRecord[];
  source: "quick" | "records";
  copies: number;
  includeIdentifier: boolean;
  options: CollectionLabelOptions;
  settings: LabelSettings;
}): LabelJob[] {
  if (source === "records") {
    return records.map((record) => ({
      lines: buildCollectionLabelLines(
        event,
        includeIdentifier ? record.id : "",
        options,
      ),
      settings,
    }));
  }

  const safeCopies = Math.max(1, Math.min(200, Math.floor(copies || 1)));
  return Array.from({ length: safeCopies }, () => ({
    lines: buildCollectionLabelLines(
      event,
      includeIdentifier ? event.id : "",
      options,
    ),
    settings,
  }));
}

export function makeDeterminationLabelJobs({
  records,
  options,
  settings,
}: {
  records: SpecimenRecord[];
  options: DeterminationLabelOptions;
  settings: LabelSettings;
}): LabelJob[] {
  return records
    .filter((record) => clean(record.scientificName))
    .map((record) => ({
      lines: buildDeterminationLabelLines(record, options),
      settings,
    }));
}
