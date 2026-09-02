"use client";

import {
  Bug,
  Download,
  FileSpreadsheet,
  MapPin,
  Package,
  X,
} from "lucide-react";
import { useState } from "react";
import {
  DEFAULT_COLLECTION_LABEL_SETTINGS,
  DEFAULT_DETERMINATION_LABEL_SETTINGS,
  makeCollectionLabelJobs,
  makeDeterminationLabelJobs,
  type CoordinateFormat,
  type CollectionLabelOptions,
  type DeterminationLabelOptions,
  type LabelSettings,
} from "@/lib/labels";
import type { CollectingEvent, SpecimenRecord } from "@/lib/types";

export type LabelMode = "collection" | "determination";

export function LabelModal({
  mode,
  event,
  records,
  onClose,
  onNotice,
}: {
  mode: LabelMode;
  event: CollectingEvent;
  records: SpecimenRecord[];
  onClose: () => void;
  onNotice: (message: string) => void;
}) {
  const [source, setSource] = useState<"quick" | "records">("quick");
  const [copies, setCopies] = useState(Math.max(1, records.length));
  const [includeIdentifier, setIncludeIdentifier] = useState(true);
  const [includeCoordinates, setIncludeCoordinates] = useState(true);
  const [coordinateFormat, setCoordinateFormat] =
    useState<CoordinateFormat>("wgs84");
  const [shortenNames, setShortenNames] = useState(true);
  const [dateFormat, setDateFormat] =
    useState<CollectionLabelOptions["dateFormat"]>("roman");
  const [identificationYear, setIdentificationYear] = useState("");
  const [widthMm, setWidthMm] = useState(
    mode === "collection"
      ? DEFAULT_COLLECTION_LABEL_SETTINGS.widthMm
      : DEFAULT_DETERMINATION_LABEL_SETTINGS.widthMm,
  );
  const [heightMm, setHeightMm] = useState(
    mode === "collection"
      ? DEFAULT_COLLECTION_LABEL_SETTINGS.heightMm
      : DEFAULT_DETERMINATION_LABEL_SETTINGS.heightMm,
  );
  const [fontSize, setFontSize] = useState(5);
  const [maximumFontSize, setMaximumFontSize] = useState(6.5);
  const [drawBorders, setDrawBorders] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const settings: LabelSettings = {
    widthMm,
    heightMm,
    preferredFontSize: fontSize,
    maximumFontSize,
    lineSpacing: 1,
    drawBorders,
  };
  const collectionOptions: CollectionLabelOptions = {
    includeCoordinates,
    coordinateFormat,
    shortenCollectorNames: shortenNames,
    dateFormat,
  };
  const determinationOptions: DeterminationLabelOptions = {
    shortenIdentifierNames: shortenNames,
    identificationYear,
  };
  const jobs =
    mode === "collection"
      ? makeCollectionLabelJobs({
          event,
          records,
          source,
          copies,
          includeIdentifier,
          options: collectionOptions,
          settings,
        })
      : makeDeterminationLabelJobs({
          records,
          options: determinationOptions,
          settings,
        });
  const identifiedCount = records.filter((record) =>
    record.scientificName.trim(),
  ).length;
  const previewLines = jobs[0]?.lines ?? [];

  async function createPdf() {
    if (!jobs.length) return;
    setBusy(true);
    setError(null);
    try {
      const { createLabelsPdf, downloadPdf } = await import("@/lib/labels-pdf");
      const labelName = mode === "collection" ? "Collection" : "Determination";
      const { bytes, overflowCount } = await createLabelsPdf(
        jobs,
        `${labelName} labels · ${event.id}`,
      );
      downloadPdf(
        bytes,
        `${labelName}_labels_${event.id.replace(/[^A-Za-z0-9_-]+/g, "_")}.pdf`,
      );
      onNotice(
        overflowCount
          ? `${jobs.length} ${labelName.toLowerCase()} labels downloaded. ${overflowCount} need a larger size or shorter text.`
          : `${jobs.length} ${labelName.toLowerCase()} labels downloaded as a print-ready A4 PDF.`,
      );
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The PDF could not be created on this device.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal label-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="label-modal-title"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">{event.id}</p>
            <h2 id="label-modal-title">
              {mode === "collection"
                ? "Collection labels"
                : "Determination labels"}
            </h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>

        {mode === "collection" ? (
          <>
            <div className="label-purpose">
              <MapPin aria-hidden="true" />
              <div>
                <strong>Label fresh material immediately</strong>
                <p>
                  Locality, coordinates, altitude, date and collector come
                  directly from this collecting event. No spreadsheet is needed.
                </p>
              </div>
            </div>

            <div className="segmented-control label-source-control">
              <button
                type="button"
                className={source === "quick" ? "is-active" : ""}
                onClick={() => setSource("quick")}
              >
                <Package /> Quick copies
              </button>
              <button
                type="button"
                className={source === "records" ? "is-active" : ""}
                disabled={!records.length}
                onClick={() => setSource("records")}
              >
                <Bug /> Recorded material
              </button>
            </div>

            {source === "quick" ? (
              <div className="label-quick-row">
                <div>
                  <strong>Identical locality labels</strong>
                  <span>
                    Use these for vials, envelopes or material that has not been
                    entered as specimens yet.
                  </span>
                </div>
                <label className="field">
                  <span>Copies</span>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    inputMode="numeric"
                    value={copies}
                    onChange={(input) => setCopies(Number(input.target.value))}
                  />
                </label>
              </div>
            ) : (
              <div className="label-quick-row">
                <div>
                  <strong>One label per specimen or lot</strong>
                  <span>
                    A lot receives one label for its container, regardless of its
                    quantity.
                  </span>
                </div>
                <span className="label-count">{records.length} labels</span>
              </div>
            )}

            <label className="checkbox-row label-checkbox">
              <input
                type="checkbox"
                checked={includeIdentifier}
                onChange={(input) => setIncludeIdentifier(input.target.checked)}
              />
              {source === "quick"
                ? "Include collecting event ID"
                : "Include specimen or lot ID"}
            </label>
          </>
        ) : (
          <div className="label-purpose determination-purpose">
            <FileSpreadsheet aria-hidden="true" />
            <div>
              <strong>{identifiedCount} identified records</strong>
              <p>
                This is deliberately separate from the fast collection-label
                workflow. Only records with a scientific name are included.
              </p>
            </div>
          </div>
        )}

        <div className="label-preview-section">
          <div className="label-section-heading">
            <div>
              <p className="eyebrow">Live preview</p>
              <h3>{jobs.length} labels on the PDF</h3>
            </div>
            <span>
              {widthMm} × {heightMm} mm
            </span>
          </div>
          {previewLines.length ? (
            <div
              className="label-preview-card"
              style={{ aspectRatio: `${widthMm} / ${heightMm}` }}
            >
              {previewLines.map((line, index) => (
                <span
                  className={`label-preview-line is-${line.style}`}
                  key={`${line.text}-${index}`}
                >
                  {line.text}
                </span>
              ))}
            </div>
          ) : (
            <div className="label-preview-empty">
              Add a scientific name before creating determination labels.
            </div>
          )}
        </div>

        <details className="label-advanced">
          <summary>Label settings</summary>
          <div className="form-grid">
            {mode === "collection" && (
              <>
                <label className="field">
                  <span>Date format</span>
                  <select
                    value={dateFormat}
                    onChange={(input) =>
                      setDateFormat(
                        input.target.value as CollectionLabelOptions["dateFormat"],
                      )
                    }
                  >
                    <option value="roman">15.VII.2026</option>
                    <option value="slash">15/07/2026</option>
                    <option value="iso">2026-07-15</option>
                  </select>
                </label>
                <label className="checkbox-row label-checkbox settings-checkbox">
                  <input
                    type="checkbox"
                    checked={includeCoordinates}
                    onChange={(input) =>
                      setIncludeCoordinates(input.target.checked)
                    }
                  />
                  Print coordinates and altitude
                </label>
                <label className="field span-2">
                  <span>Coordinate system</span>
                  <select
                    value={coordinateFormat}
                    disabled={!includeCoordinates}
                    onChange={(input) =>
                      setCoordinateFormat(input.target.value as CoordinateFormat)
                    }
                  >
                    <option value="wgs84">
                      WGS84 — latitude / longitude (N/E)
                    </option>
                    <option value="lv95">
                      Swiss LV95 — modern national grid
                    </option>
                    <option value="lv03">
                      Swiss LV03 — legacy collections
                    </option>
                  </select>
                </label>
              </>
            )}
            {mode === "determination" && (
              <label className="field span-2">
                <span>Identification year — optional</span>
                <input
                  inputMode="numeric"
                  maxLength={4}
                  value={identificationYear}
                  onChange={(input) =>
                    setIdentificationYear(
                      input.target.value.replace(/\D/g, "").slice(0, 4),
                    )
                  }
                  placeholder="e.g. 2026"
                />
              </label>
            )}
            <label className="checkbox-row label-checkbox settings-checkbox">
              <input
                type="checkbox"
                checked={shortenNames}
                onChange={(input) => setShortenNames(input.target.checked)}
              />
              Shorten first names
            </label>
            <label className="checkbox-row label-checkbox settings-checkbox">
              <input
                type="checkbox"
                checked={drawBorders}
                onChange={(input) => setDrawBorders(input.target.checked)}
              />
              Draw cutting borders
            </label>
            <label className="field">
              <span>Width, mm</span>
              <input
                type="number"
                min="10"
                max="60"
                step="1"
                value={widthMm}
                onChange={(input) => setWidthMm(Number(input.target.value))}
              />
            </label>
            <label className="field">
              <span>Height, mm</span>
              <input
                type="number"
                min="5"
                max="40"
                step="1"
                value={heightMm}
                onChange={(input) => setHeightMm(Number(input.target.value))}
              />
            </label>
            <label className="field">
              <span>Preferred font, pt</span>
              <input
                type="number"
                min="3"
                max="10"
                step="0.25"
                value={fontSize}
                onChange={(input) => setFontSize(Number(input.target.value))}
              />
            </label>
            <label className="field">
              <span>Maximum font, pt</span>
              <input
                type="number"
                min="3"
                max="12"
                step="0.25"
                value={maximumFontSize}
                onChange={(input) =>
                  setMaximumFontSize(Number(input.target.value))
                }
              />
            </label>
          </div>
        </details>

        {error && <p className="label-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!jobs.length || busy}
            onClick={() => void createPdf()}
          >
            <Download aria-hidden="true" />
            {busy ? "Creating PDF…" : `Download ${jobs.length} labels`}
          </button>
        </div>
      </div>
    </div>
  );
}
