import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import {
  DEFAULT_COLLECTION_LABEL_SETTINGS,
  DEFAULT_DETERMINATION_LABEL_SETTINGS,
  buildCollectionLabelLines,
  buildDeterminationLabelLines,
  formatCoordinatesForLabel,
  formatCollectionDate,
  makeCollectionLabelJobs,
  makeDeterminationLabelJobs,
  makeMultiEventCollectionLabelJobs,
  arrangeLabelJobs,
} from "../lib/labels.ts";

const event = {
  id: "EF-20260831-001",
  name: "Meadow edge",
  date: "2026-08-31",
  time: "14:37",
  country: "Switzerland",
  region: "Zürich",
  locality: "Männedorf, Üetiker Ried",
  latitude: 47.24281,
  longitude: 8.69214,
  uncertainty: 6,
  altitude: 430,
  coordinateSource: "device GPS",
  collector: "Saniya Sagutdinova; Kimberly Rothmund",
  method: "sweep net",
  habitat: "meadow edge",
  host: "",
  weather: "",
  notes: "",
  photos: [],
  createdAt: "2026-08-31T14:37:00.000Z",
};

const records = [
  {
    id: "EF-20260831-001-S01",
    eventId: event.id,
    recordType: "specimen",
    quantity: 1,
    scientificName: "Lucilia cf. sericata",
    identifier: "Saniya Sagutdinova",
    sex: "female",
    lifeStage: "adult",
    notes: "",
    photos: [],
    createdAt: event.createdAt,
  },
  {
    id: "EF-20260831-001-L01",
    eventId: event.id,
    recordType: "lot",
    quantity: 11,
    scientificName: "",
    identifier: "",
    sex: "",
    lifeStage: "adult",
    notes: "",
    photos: [],
    createdAt: event.createdAt,
  },
];

const secondEvent = {
  ...event,
  id: "EF-20260831-002",
  name: "Forest stream",
  locality: "Küsnacht, Schübelweiher",
  latitude: 47.3112,
  longitude: 8.5901,
  altitude: 507,
  time: "16:05",
};

test("formats compact collection metadata with Unicode locality", () => {
  assert.equal(formatCollectionDate(event.date, "roman"), "31.VIII.2026");
  const lines = buildCollectionLabelLines(event, event.id, {
    includeCoordinates: true,
    includeAltitude: true,
    coordinateFormat: "wgs84",
    shortenCollectorNames: true,
    dateFormat: "roman",
  });
  assert.match(lines[0].text, /EF-20260831-001/);
  assert.match(lines[0].text, /Zürich/);
  assert.match(lines[0].text, /Üetiker Ried/);
  assert.match(lines[1].text, /47\.2428° N/);
  assert.match(lines[2].text, /430 m · 31\.VIII\.2026/);
  assert.match(lines[2].text, /leg\. S\. Sagutdinova, K\. Rothmund/);
});

test("formats WGS84, modern LV95 and legacy LV03 coordinates", () => {
  assert.equal(
    formatCoordinatesForLabel(event.latitude, event.longitude, "wgs84"),
    "47.2428° N, 8.6921° E",
  );
  assert.equal(
    formatCoordinatesForLabel(event.latitude, event.longitude, "lv95"),
    "LV95 E 2'694'902 / N 1'233'190",
  );
  assert.equal(
    formatCoordinatesForLabel(event.latitude, event.longitude, "lv03"),
    "LV03 y 694'902 / x 233'190",
  );
});

test("prints the selected Swiss grid on a collection label", () => {
  const lines = buildCollectionLabelLines(event, event.id, {
    includeCoordinates: true,
    includeAltitude: true,
    coordinateFormat: "lv95",
    shortenCollectorNames: true,
    dateFormat: "roman",
  });
  assert.equal(lines[1].text, "LV95 E 2'694'902 / N 1'233'190");
});

test("coordinates and altitude can be printed independently in every coordinate format", () => {
  for (const coordinateFormat of ["wgs84", "lv95", "lv03"]) {
    for (const includeCoordinates of [true, false]) {
      for (const includeAltitude of [true, false]) {
        const text = buildCollectionLabelLines(event, "", {
          includeCoordinates, includeAltitude, coordinateFormat,
          shortenCollectorNames: true, dateFormat: "roman",
        }).map((line) => line.text).join("\n");
        assert.equal(text.includes(formatCoordinatesForLabel(event.latitude, event.longitude, coordinateFormat)), includeCoordinates);
        assert.equal(text.includes("430 m"), includeAltitude);
        assert.ok(text.includes("31.VIII.2026"));
        assert.ok(text.includes("Üetiker Ried"));
        assert.equal(text.includes(event.id), false);
      }
    }
  }
});

test("altitude zero is retained independently of missing coordinates", () => {
  const lines = buildCollectionLabelLines({ ...event, altitude: 0, latitude: undefined, longitude: undefined }, "", {
    includeCoordinates: false, includeAltitude: true, coordinateFormat: "wgs84",
    shortenCollectorNames: true, dateFormat: "roman",
  });
  assert.ok(lines.some((line) => line.text.startsWith("0 m ·")));
});

test("creates one collection label per record, including one for a lot", () => {
  const jobs = makeCollectionLabelJobs({
    event,
    records,
    source: "records",
    copies: 99,
    includeIdentifier: true,
    options: {
      includeCoordinates: true,
      includeAltitude: true,
      coordinateFormat: "wgs84",
      shortenCollectorNames: true,
      dateFormat: "roman",
    },
    settings: DEFAULT_COLLECTION_LABEL_SETTINGS,
  });
  assert.equal(jobs.length, 2);
  assert.match(jobs[1].lines[0].text, /-L01/);
});

test("combines selected collecting events without inserting page breaks", () => {
  const jobs = makeMultiEventCollectionLabelJobs({
    events: [event, secondEvent],
    records,
    source: "quick",
    copiesByEvent: { [event.id]: 2, [secondEvent.id]: 3 },
    includeIdentifier: true,
    options: {
      includeCoordinates: true,
      includeAltitude: true,
      coordinateFormat: "wgs84",
      shortenCollectorNames: true,
      dateFormat: "roman",
    },
    settings: DEFAULT_COLLECTION_LABEL_SETTINGS,
  });
  assert.equal(jobs.length, 5);
  assert.match(jobs[0].lines[0].text, new RegExp(event.id));
  assert.match(jobs[2].lines[0].text, new RegExp(secondEvent.id));
  assert.match(jobs[2].lines[0].text, /Schübelweiher/);
});

test("determination jobs remain separate and skip unidentified material", () => {
  const jobs = makeDeterminationLabelJobs({
    records,
    options: {
      shortenIdentifierNames: true,
      identificationYear: "2026",
      includeSpecimenIdentifier: true,
    },
    settings: DEFAULT_DETERMINATION_LABEL_SETTINGS,
  });
  assert.equal(jobs.length, 1);
  assert.deepEqual(buildDeterminationLabelLines(records[0], {
    shortenIdentifierNames: true,
    identificationYear: "2026",
    includeSpecimenIdentifier: true,
  }), [
    { text: "EF-20260831-001-S01", style: "bold" },
    { text: "Lucilia cf. sericata", style: "italic" },
    { text: "det. S. Sagutdinova 2026", style: "regular" },
  ]);
});

test("groups label types or keeps matching record labels together", () => {
  const collectionJobs = makeCollectionLabelJobs({
    event,
    records,
    source: "records",
    copies: 1,
    includeIdentifier: true,
    options: {
      includeCoordinates: true,
      includeAltitude: true,
      coordinateFormat: "wgs84",
      shortenCollectorNames: true,
      dateFormat: "roman",
    },
    settings: DEFAULT_COLLECTION_LABEL_SETTINGS,
  });
  const determinationJobs = makeDeterminationLabelJobs({
    records,
    options: {
      shortenIdentifierNames: true,
      identificationYear: "2026",
      includeSpecimenIdentifier: true,
    },
    settings: DEFAULT_DETERMINATION_LABEL_SETTINGS,
  });

  assert.deepEqual(
    arrangeLabelJobs(collectionJobs, determinationJobs, "grouped").map((job) => job.kind),
    ["collection", "collection", "determination"],
  );
  assert.deepEqual(
    arrangeLabelJobs(collectionJobs, determinationJobs, "paired").map((job) => [job.kind, job.sourceKey]),
    [
      ["collection", records[0].id],
      ["determination", records[0].id],
      ["collection", records[1].id],
    ],
  );
});

test("can omit the specimen ID from determination labels", () => {
  const lines = buildDeterminationLabelLines(records[0], {
    shortenIdentifierNames: true,
    identificationYear: "2026",
    includeSpecimenIdentifier: false,
  });
  assert.equal(lines.some((line) => line.text === records[0].id), false);
  assert.equal(lines[0].style, "italic");
});

test("creates a readable A4 PDF with embedded Unicode fonts", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (resource) => {
    const path = String(resource);
    if (!path.startsWith("/fonts/")) return originalFetch(resource);
    const bytes = await readFile(new URL(`../public${path}`, import.meta.url));
    return new Response(bytes, { status: 200 });
  };
  try {
    const jobs = makeMultiEventCollectionLabelJobs({
      events: [event, secondEvent],
      records,
      source: "quick",
      copiesByEvent: { [event.id]: 12, [secondEvent.id]: 12 },
      includeIdentifier: true,
      options: {
        includeCoordinates: true,
        includeAltitude: true,
        coordinateFormat: "wgs84",
        shortenCollectorNames: true,
        dateFormat: "roman",
      },
      settings: DEFAULT_COLLECTION_LABEL_SETTINGS,
    });
    const { createLabelsPdf } = await import("../lib/labels-pdf.ts");
    const result = await createLabelsPdf(jobs, "Combined field trip labels test", {
      arrangement: "grouped",
      cuttingGuideStyle: "shared-grid",
      cuttingGapMm: 1.5,
    });
    assert.equal(result.overflowCount, 0);
    assert.equal(jobs.length, 24);
    assert.ok(result.bytes.byteLength > 5_000);
    const parsed = await PDFDocument.load(result.bytes);
    assert.equal(parsed.getPageCount(), 1);

    const swissJobs = makeMultiEventCollectionLabelJobs({
      events: [event, secondEvent],
      records,
      source: "quick",
      copiesByEvent: { [event.id]: 12, [secondEvent.id]: 12 },
      includeIdentifier: true,
      options: {
        includeCoordinates: true,
        includeAltitude: true,
        coordinateFormat: "lv95",
        shortenCollectorNames: true,
        dateFormat: "roman",
      },
      settings: DEFAULT_COLLECTION_LABEL_SETTINGS,
    });
    const swissResult = await createLabelsPdf(
      swissJobs,
      "Swiss LV95 field trip labels test",
      {
        arrangement: "grouped",
        cuttingGuideStyle: "double-guides",
        cuttingGapMm: 1.5,
      },
    );
    assert.equal(swissResult.overflowCount, 0);
    assert.equal((await PDFDocument.load(swissResult.bytes)).getPageCount(), 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
