"use client";

import { Bug, Download, MapPin, Package, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  DEFAULT_COLLECTION_LABEL_SETTINGS,
  makeMultiEventCollectionLabelJobs,
  type CollectionLabelOptions,
  type LabelSettings,
} from "@/lib/labels";
import type { CollectingEvent, SpecimenRecord } from "@/lib/types";

export function TripCollectionLabelModal({
  tripId,
  tripName,
  events,
  records,
  onClose,
  onNotice,
}: {
  tripId: string;
  tripName: string;
  events: CollectingEvent[];
  records: SpecimenRecord[];
  onClose: () => void;
  onNotice: (message: string) => void;
}) {
  const orderedEvents = useMemo(
    () =>
      [...events].sort((a, b) =>
        `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
      ),
    [events],
  );
  const recordsByEvent = useMemo(() => {
    const grouped = new Map<string, SpecimenRecord[]>();
    for (const record of records) {
      const eventRecords = grouped.get(record.eventId) ?? [];
      eventRecords.push(record);
      grouped.set(record.eventId, eventRecords);
    }
    return grouped;
  }, [records]);
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(orderedEvents.map((event) => event.id)),
  );
  const [source, setSource] = useState<"quick" | "records">("quick");
  const [copiesByEvent, setCopiesByEvent] = useState<Record<string, number>>(
    () =>
      Object.fromEntries(
        orderedEvents.map((event) => [
          event.id,
          Math.max(1, recordsByEvent.get(event.id)?.length ?? 0),
        ]),
      ),
  );
  const [includeIdentifier, setIncludeIdentifier] = useState(true);
  const [includeCoordinates, setIncludeCoordinates] = useState(true);
  const [shortenNames, setShortenNames] = useState(true);
  const [dateFormat, setDateFormat] =
    useState<CollectionLabelOptions["dateFormat"]>("roman");
  const [widthMm, setWidthMm] = useState(
    DEFAULT_COLLECTION_LABEL_SETTINGS.widthMm,
  );
  const [heightMm, setHeightMm] = useState(
    DEFAULT_COLLECTION_LABEL_SETTINGS.heightMm,
  );
  const [fontSize, setFontSize] = useState(5);
  const [maximumFontSize, setMaximumFontSize] = useState(6.5);
  const [drawBorders, setDrawBorders] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedEvents = orderedEvents.filter((event) =>
    selectedIds.has(event.id),
  );
  const settings: LabelSettings = {
    widthMm,
    heightMm,
    preferredFontSize: fontSize,
    maximumFontSize,
    lineSpacing: 1,
    drawBorders,
  };
  const options: CollectionLabelOptions = {
    includeCoordinates,
    shortenCollectorNames: shortenNames,
    dateFormat,
  };
  const jobs = makeMultiEventCollectionLabelJobs({
    events: selectedEvents,
    records,
    source,
    copiesByEvent,
    includeIdentifier,
    options,
    settings,
  });
  const previewLines = jobs[0]?.lines ?? [];
  const totalRecorded = orderedEvents.reduce(
    (sum, event) => sum + (recordsByEvent.get(event.id)?.length ?? 0),
    0,
  );

  function toggleEvent(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setCopies(id: string, value: number) {
    const safeValue = Math.max(1, Math.min(200, Math.floor(value || 1)));
    setCopiesByEvent((current) => ({ ...current, [id]: safeValue }));
  }

  async function createPdf() {
    if (!jobs.length) return;
    setBusy(true);
    setError(null);
    try {
      const { createLabelsPdf, downloadPdf } = await import("@/lib/labels-pdf");
      const { bytes, overflowCount } = await createLabelsPdf(
        jobs,
        `Collection labels - ${tripName}`,
      );
      const safeTripId = tripId.replace(/[^A-Za-z0-9_-]+/g, "_");
      downloadPdf(bytes, `Collection_labels_${safeTripId}.pdf`);
      onNotice(
        overflowCount
          ? `${jobs.length} collection labels from ${selectedEvents.length} events downloaded. ${overflowCount} need a larger size or shorter text.`
          : `${jobs.length} collection labels from ${selectedEvents.length} events downloaded together in one compact A4 PDF.`,
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
        className="modal label-modal trip-label-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trip-label-modal-title"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">{tripName}</p>
            <h2 id="trip-label-modal-title">Collection labels for field trip</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>

        <div className="label-purpose">
          <MapPin aria-hidden="true" />
          <div>
            <strong>Fill one page with several collecting events</strong>
            <p>
              Choose the events you need. Their labels are packed continuously
              into one PDF, so a small event no longer wastes the rest of a page.
            </p>
          </div>
        </div>

        <div className="segmented-control label-source-control">
          <button
            type="button"
            className={source === "quick" ? "is-active" : ""}
            onClick={() => setSource("quick")}
          >
            <Package /> Copies per event
          </button>
          <button
            type="button"
            className={source === "records" ? "is-active" : ""}
            disabled={!totalRecorded}
            onClick={() => setSource("records")}
          >
            <Bug /> Recorded material
          </button>
        </div>

        <section className="trip-label-selection" aria-labelledby="event-selection-title">
          <div className="trip-label-selection-heading">
            <div>
              <p className="eyebrow">Events</p>
              <h3 id="event-selection-title">
                {selectedEvents.length} of {orderedEvents.length} selected
              </h3>
            </div>
            <div className="trip-label-selection-actions">
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setSelectedIds(new Set(orderedEvents.map((event) => event.id)))
                }
              >
                Select all
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="trip-label-event-list">
            {orderedEvents.map((event, index) => {
              const recordCount = recordsByEvent.get(event.id)?.length ?? 0;
              const selected = selectedIds.has(event.id);
              return (
                <div
                  className={`trip-label-event-row ${selected ? "is-selected" : ""}`}
                  key={event.id}
                >
                  <label className="trip-label-event-check">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleEvent(event.id)}
                    />
                    <span className="trip-label-event-number">{index + 1}</span>
                    <span className="trip-label-event-copy">
                      <strong>{event.name || event.locality || event.id}</strong>
                      <span>
                        {event.date} - {event.locality || "Locality not entered"}
                      </span>
                      <small>{recordCount} recorded specimens/lots</small>
                    </span>
                  </label>
                  {source === "quick" ? (
                    <label className="field trip-label-copies">
                      <span>Copies</span>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        inputMode="numeric"
                        value={copiesByEvent[event.id] ?? 1}
                        disabled={!selected}
                        onChange={(input) =>
                          setCopies(event.id, Number(input.target.value))
                        }
                      />
                    </label>
                  ) : (
                    <span className="label-count">
                      {selected ? recordCount : 0} labels
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <label className="checkbox-row label-checkbox">
          <input
            type="checkbox"
            checked={includeIdentifier}
            onChange={(input) => setIncludeIdentifier(input.target.checked)}
          />
          {source === "quick"
            ? "Include collecting event IDs"
            : "Include specimen or lot IDs"}
        </label>

        <div className="label-preview-section trip-label-preview-section">
          <div className="label-section-heading">
            <div>
              <p className="eyebrow">Combined PDF</p>
              <h3>{jobs.length} labels packed without page breaks between events</h3>
            </div>
            <span>
              {widthMm} x {heightMm} mm
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
              {selectedEvents.length
                ? "The selected events do not have recorded material yet."
                : "Select at least one collecting event."}
            </div>
          )}
        </div>

        <details className="label-advanced">
          <summary>Label settings</summary>
          <div className="form-grid">
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
                onChange={(input) => setIncludeCoordinates(input.target.checked)}
              />
              Print coordinates and altitude
            </label>
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
            {busy ? "Creating PDF..." : `Download ${jobs.length} labels`}
          </button>
        </div>
      </div>
    </div>
  );
}
