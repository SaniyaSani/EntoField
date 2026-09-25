"use client";

import { Bug, Download, FileSpreadsheet, MapPin, Package, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CopyCountInput } from "@/app/copy-count-input";
import {
  DEFAULT_COLLECTION_SOURCE,
  DEFAULT_INCLUDE_COLLECTION_IDENTIFIER,
  normalizeLabelCopies,
} from "@/lib/label-studio-options";
import type { LabelPdfRequest, LabelPdfResponse } from "@/lib/labels-pdf.worker";
import {
  arrangeLabelJobs,
  DEFAULT_COLLECTION_LABEL_SETTINGS,
  DEFAULT_DETERMINATION_LABEL_SETTINGS,
  DEFAULT_LABEL_PAGE_OPTIONS,
  makeDeterminationLabelJobs,
  makeMultiEventCollectionLabelJobs,
  type CollectionLabelOptions,
  type CoordinateFormat,
  type CuttingGuideStyle,
  type LabelArrangement,
  type LabelMode,
  type LabelPageOptions,
  type LabelSettings,
} from "@/lib/labels";
import type { CollectingEvent, SpecimenRecord } from "@/lib/types";

export type { LabelMode } from "@/lib/labels";

type LabelStudioProps = {
  initialMode: LabelMode;
  scopeId: string;
  scopeName: string;
  events: CollectingEvent[];
  records: SpecimenRecord[];
  isTrip?: boolean;
  onClose: () => void;
  onNotice: (message: string) => void;
};

function safeFilePart(value: string) {
  return value.replace(/[^A-Za-z0-9_-]+/g, "_");
}

function modeTitle(mode: LabelMode) {
  if (mode === "collection") return "Collection labels";
  if (mode === "determination") return "Determination labels";
  return "Collection + determination labels";
}

export function LabelStudio({
  initialMode,
  scopeId,
  scopeName,
  events,
  records,
  isTrip = false,
  onClose,
  onNotice,
}: LabelStudioProps) {
  const orderedEvents = useMemo(
    () => [...events].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)),
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

  const [mode, setMode] = useState<LabelMode>(initialMode);
  const [selectedIds, setSelectedIds] = useState(() => new Set(orderedEvents.map((event) => event.id)));
  const [source, setSource] = useState<"quick" | "records">(
    DEFAULT_COLLECTION_SOURCE,
  );
  const [copiesByEvent, setCopiesByEvent] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      orderedEvents.map((event) => [event.id, normalizeLabelCopies(recordsByEvent.get(event.id)?.length ?? 0)]),
    ),
  );
  const [copiesEditing, setCopiesEditing] = useState(false);
  const [includeIdentifier, setIncludeIdentifier] = useState(DEFAULT_INCLUDE_COLLECTION_IDENTIFIER);
  const [includeCoordinates, setIncludeCoordinates] = useState(true);
  const [includeAltitude, setIncludeAltitude] = useState(true);
  const [coordinateFormat, setCoordinateFormat] = useState<CoordinateFormat>("wgs84");
  const [shortenCollectorNames, setShortenCollectorNames] = useState(true);
  const [dateFormat, setDateFormat] = useState<CollectionLabelOptions["dateFormat"]>("roman");
  const [shortenIdentifierNames, setShortenIdentifierNames] = useState(true);
  const [identificationYear, setIdentificationYear] = useState("");
  const [includeSpecimenIdentifier, setIncludeSpecimenIdentifier] = useState(true);
  const [collectionSettings, setCollectionSettings] = useState<LabelSettings>(DEFAULT_COLLECTION_LABEL_SETTINGS);
  const [determinationSettings, setDeterminationSettings] = useState<LabelSettings>(DEFAULT_DETERMINATION_LABEL_SETTINGS);
  const [arrangement, setArrangement] = useState<LabelArrangement>(DEFAULT_LABEL_PAGE_OPTIONS.arrangement);
  const [cuttingGuideStyle, setCuttingGuideStyle] = useState<CuttingGuideStyle>(DEFAULT_LABEL_PAGE_OPTIONS.cuttingGuideStyle);
  const [cuttingGapMm, setCuttingGapMm] = useState(DEFAULT_LABEL_PAGE_OPTIONS.cuttingGapMm);
  const [preview, setPreview] = useState<{
    request: LabelPdfRequest;
    url: string;
    bytes: Uint8Array;
    overflowCount: number;
  } | null>(null);
  const [previewError, setPreviewError] = useState<{
    request: LabelPdfRequest;
    message: string;
  } | null>(null);
  const [previewAttempt, setPreviewAttempt] = useState(0);

  const selectedEvents = useMemo(
    () => orderedEvents.filter((event) => selectedIds.has(event.id)),
    [orderedEvents, selectedIds],
  );
  const selectedRecords = useMemo(
    () => selectedEvents.flatMap((event) => recordsByEvent.get(event.id) ?? []),
    [selectedEvents, recordsByEvent],
  );
  const identifiedCount = selectedRecords.filter((record) => record.scientificName.trim()).length;
  const totalRecorded = selectedRecords.length;

  const collectionOptions = useMemo<CollectionLabelOptions>(
    () => ({ includeCoordinates, includeAltitude, coordinateFormat, shortenCollectorNames, dateFormat }),
    [includeCoordinates, includeAltitude, coordinateFormat, shortenCollectorNames, dateFormat],
  );
  const collectionJobs = useMemo(
    () =>
      mode === "determination"
        ? []
        : makeMultiEventCollectionLabelJobs({
            events: selectedEvents,
            records: selectedRecords,
            source,
            copiesByEvent,
            includeIdentifier,
            options: collectionOptions,
            settings: collectionSettings,
          }),
    [mode, selectedEvents, selectedRecords, source, copiesByEvent, includeIdentifier, collectionOptions, collectionSettings],
  );
  const determinationJobs = useMemo(
    () =>
      mode === "collection"
        ? []
        : makeDeterminationLabelJobs({
            records: selectedRecords,
            options: { shortenIdentifierNames, identificationYear, includeSpecimenIdentifier },
            settings: determinationSettings,
          }),
    [mode, selectedRecords, shortenIdentifierNames, identificationYear, includeSpecimenIdentifier, determinationSettings],
  );
  const effectiveArrangement: LabelArrangement = mode === "both" && source === "records" ? arrangement : "grouped";
  const jobs = useMemo(
    () => arrangeLabelJobs(collectionJobs, determinationJobs, effectiveArrangement),
    [collectionJobs, determinationJobs, effectiveArrangement],
  );
  const pageOptions = useMemo<LabelPageOptions>(
    () => ({ arrangement: effectiveArrangement, cuttingGuideStyle, cuttingGapMm }),
    [effectiveArrangement, cuttingGuideStyle, cuttingGapMm],
  );
  const pdfTitle = `${modeTitle(mode)} · ${scopeName}`;
  const pdfRequest = useMemo<LabelPdfRequest>(
    () => ({ jobs, title: pdfTitle, options: pageOptions }),
    [jobs, pdfTitle, pageOptions],
  );
  const previewIsCurrent = preview?.request === pdfRequest;
  const error = previewError?.request === pdfRequest ? previewError.message : null;
  const previewBusy = Boolean(jobs.length && !previewIsCurrent && !error);

  useEffect(() => {
    // Do not reload the PDF viewer while the mobile keyboard is open.
    if (copiesEditing || !jobs.length) return;
    let active = true;
    let worker: Worker | undefined;
    const fail = (message: string) => {
      if (active) setPreviewError({ request: pdfRequest, message });
      worker?.terminate();
    };
    const timer = window.setTimeout(() => {
      try {
        worker = new Worker(new URL("../lib/labels-pdf.worker.ts", import.meta.url), { type: "module" });
        worker.onmessage = (event: MessageEvent<LabelPdfResponse>) => {
          if (!active) return;
          if ("error" in event.data) return fail(event.data.error);
          const { bytes, overflowCount } = event.data.result;
          const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
          setPreview({ request: pdfRequest, bytes, overflowCount, url });
          setPreviewError(null);
          worker?.terminate();
        };
        worker.onerror = () => fail("The PDF preview could not be created. Please retry.");
        worker.onmessageerror = () => fail("The PDF preview could not be read. Please retry.");
        worker.postMessage(pdfRequest);
      } catch (caught) {
        fail(caught instanceof Error ? caught.message : "The PDF preview could not be created.");
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
      worker?.terminate();
    };
  }, [jobs.length, pdfRequest, copiesEditing, previewAttempt]);

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview.url); };
  }, [preview]);

  function chooseMode(nextMode: LabelMode) {
    setMode(nextMode);
  }

  function toggleEvent(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setCopies(id: string, value: number) {
    setCopiesByEvent((current) => current[id] === value ? current : { ...current, [id]: value });
  }

  function createPdf() {
    if (!jobs.length || copiesEditing || !previewIsCurrent || !preview) return;
    // Download the verified current preview, never bytes from an earlier count/option.
    const url = URL.createObjectURL(new Blob([preview.bytes as BlobPart], { type: "application/pdf" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${mode === "both" ? "Combined" : modeTitle(mode).split(" ")[0]}_labels_${safeFilePart(scopeId)}.pdf`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    onNotice(
      preview.overflowCount
        ? `${jobs.length} labels downloaded. ${preview.overflowCount} need a larger size or shorter text.`
        : `${jobs.length} labels downloaded in the same A4 layout shown in the preview.`,
    );
    onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className={`modal label-modal label-studio-modal ${isTrip ? "trip-label-modal" : ""}`} role="dialog" aria-modal="true" aria-labelledby="label-studio-title">
        <div className="modal-header">
          <div>
            <p className="eyebrow">EntoLabel system · {scopeName}</p>
            <h2 id="label-studio-title">Label Studio</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X /></button>
        </div>

        <div className="segmented-control label-mode-control" aria-label="Labels to create">
          <button type="button" className={mode === "both" ? "is-active" : ""} onClick={() => chooseMode("both")}>Both</button>
          <button type="button" className={mode === "collection" ? "is-active" : ""} onClick={() => chooseMode("collection")}><MapPin /> Collection</button>
          <button type="button" className={mode === "determination" ? "is-active" : ""} onClick={() => chooseMode("determination")}><Bug /> Determination</button>
        </div>

        <div className="label-purpose">
          <FileSpreadsheet aria-hidden="true" />
          <div>
            <strong>{modeTitle(mode)}</strong>
            <p>Collection and determination labels keep their own sizes and typography. Page order and cutting guides are controlled below.</p>
          </div>
        </div>

        {isTrip && (
          <section className="trip-label-selection" aria-labelledby="event-selection-title">
            <div className="trip-label-selection-heading">
              <div>
                <p className="eyebrow">Collecting events</p>
                <h3 id="event-selection-title">{selectedEvents.length} of {orderedEvents.length} selected</h3>
              </div>
              <div className="trip-label-selection-actions">
                <button type="button" className="text-button" onClick={() => setSelectedIds(new Set(orderedEvents.map((event) => event.id)))}>Select all</button>
                <button type="button" className="text-button" onClick={() => setSelectedIds(new Set())}>Clear</button>
              </div>
            </div>
            <div className="trip-label-event-list">
              {orderedEvents.map((event, index) => {
                const recordCount = recordsByEvent.get(event.id)?.length ?? 0;
                const selected = selectedIds.has(event.id);
                return (
                  <div className={`trip-label-event-row ${selected ? "is-selected" : ""}`} key={event.id}>
                    <label className="trip-label-event-check">
                      <input type="checkbox" checked={selected} onChange={() => toggleEvent(event.id)} />
                      <span className="trip-label-event-number">{index + 1}</span>
                      <span className="trip-label-event-copy">
                        <strong>{event.name || event.locality || event.id}</strong>
                        <span>{event.date} · {event.locality || "Locality not entered"}</span>
                        <small>{recordCount} recorded specimens/lots</small>
                      </span>
                    </label>
                    {mode !== "determination" && source === "quick" ? (
                      <label className="field trip-label-copies">
                        <span>Copies</span>
                        <CopyCountInput
                          value={copiesByEvent[event.id]}
                          disabled={!selected}
                          onCommit={(value) => setCopies(event.id, value)}
                          onEditingChange={setCopiesEditing}
                        />
                      </label>
                    ) : (
                      <span className="label-count">{selected ? recordCount : 0} records</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {mode !== "determination" && (
          <>
            <div className="segmented-control label-source-control">
              <button type="button" className={source === "quick" ? "is-active" : ""} onClick={() => setSource("quick")}><Package /> Copies per event</button>
              <button type="button" className={source === "records" ? "is-active" : ""} disabled={!totalRecorded} onClick={() => setSource("records")}><Bug /> One per record</button>
            </div>
            {!isTrip && source === "quick" && orderedEvents[0] && (
              <div className="label-quick-row">
                <div><strong>Identical locality labels</strong><span>Useful before the specimens or lots have been entered.</span></div>
                <label className="field">
                  <span>Copies</span>
                  <CopyCountInput
                    value={copiesByEvent[orderedEvents[0].id]}
                    onCommit={(value) => setCopies(orderedEvents[0].id, value)}
                    onEditingChange={setCopiesEditing}
                  />
                </label>
              </div>
            )}
            {source === "quick" && <p className="label-copy-hint">1–200 copies per event. Tap Done or leave the field to update the preview.</p>}
            <label className="checkbox-row label-checkbox">
              <input type="checkbox" checked={includeIdentifier} onChange={(input) => setIncludeIdentifier(input.target.checked)} />
              {source === "quick" ? "Include collecting event IDs" : "Include specimen or lot IDs"}
            </label>
          </>
        )}

        {mode !== "collection" && (
          <div className="label-purpose determination-purpose label-count-summary">
            <Bug aria-hidden="true" />
            <div><strong>{identifiedCount} determination labels</strong><p>Only records with a scientific name are included.</p></div>
          </div>
        )}

        <section className="label-layout-section" aria-labelledby="layout-title">
          <div className="label-section-heading">
            <div><p className="eyebrow">Page layout</p><h3 id="layout-title">Grouping and cutting</h3></div>
            <span>{jobs.length} labels</span>
          </div>
          {mode === "both" && (
            <div className="label-choice-grid label-arrangement-grid">
              <button type="button" className={effectiveArrangement === "grouped" ? "is-active" : ""} onClick={() => setArrangement("grouped")}>
                <strong>Group by label type</strong><span>All collection labels, then determinations on a clean row.</span>
              </button>
              <button type="button" className={effectiveArrangement === "paired" ? "is-active" : ""} disabled={source !== "records"} onClick={() => setArrangement("paired")}>
                <strong>Keep record pairs</strong><span>Each collection label stays beside its determination label.</span>
              </button>
            </div>
          )}
          <div className="label-choice-grid label-cutting-grid">
            {([
              ["shared-grid", "Single shared grid", "Best for a guillotine cutter"],
              ["double-guides", "Double guides", "Space around every label"],
              ["none", "No guides", "Print text only"],
            ] as const).map(([value, label, description]) => (
              <button type="button" key={value} className={cuttingGuideStyle === value ? "is-active" : ""} onClick={() => setCuttingGuideStyle(value)}>
                <strong>{label}</strong><span>{description}</span>
              </button>
            ))}
          </div>
          {cuttingGuideStyle === "double-guides" && (
            <label className="field label-gap-field">
              <span>Gap between labels, mm</span>
              <input type="number" min="0.5" max="10" step="0.5" value={cuttingGapMm} onChange={(input) => setCuttingGapMm(Number(input.target.value))} />
            </label>
          )}
        </section>

        <div className="label-preview-section exact-pdf-preview">
          <div className="label-section-heading">
            <div><p className="eyebrow">Exact A4 preview</p><h3>The download uses this same PDF</h3></div>
            <span role="status">{copiesEditing ? "Finish editing copies…" : error ? "Preview unavailable" : previewBusy ? "Updating…" : jobs.length ? "Ready" : "No labels"}</span>
          </div>
          {preview && jobs.length ? (
            <>
              {!previewIsCurrent && <p className="label-copy-hint">Previous preview — updating to your current settings.</p>}
              <iframe className="label-pdf-frame" src={preview.url} title="Exact A4 label PDF preview" />
            </>
          ) : (
            <div className="label-preview-empty">{jobs.length ? "Preparing the print preview…" : "No labels match the current selection."}</div>
          )}
        </div>

        {mode !== "determination" && (
          <LabelSettingsPanel title="Collection label settings" settings={collectionSettings} onSettings={setCollectionSettings}>
            <label className="field">
              <span>Date format</span>
              <select value={dateFormat} onChange={(input) => setDateFormat(input.target.value as CollectionLabelOptions["dateFormat"])}>
                <option value="roman">15.VII.2026</option><option value="slash">15/07/2026</option><option value="iso">2026-07-15</option>
              </select>
            </label>
            <label className="field">
              <span>Coordinate system</span>
              <select value={coordinateFormat} disabled={!includeCoordinates} onChange={(input) => setCoordinateFormat(input.target.value as CoordinateFormat)}>
                <option value="wgs84">WGS84 latitude / longitude</option><option value="lv95">Swiss LV95</option><option value="lv03">Swiss LV03</option>
              </select>
            </label>
            <label className="checkbox-row label-checkbox settings-checkbox span-2"><input type="checkbox" checked={includeCoordinates} onChange={(input) => setIncludeCoordinates(input.target.checked)} />Print coordinates</label>
            <label className="checkbox-row label-checkbox settings-checkbox span-2"><input type="checkbox" checked={includeAltitude} onChange={(input) => setIncludeAltitude(input.target.checked)} />Print altitude</label>
            <label className="checkbox-row label-checkbox settings-checkbox span-2"><input type="checkbox" checked={shortenCollectorNames} onChange={(input) => setShortenCollectorNames(input.target.checked)} />Shorten collector first names</label>
          </LabelSettingsPanel>
        )}

        {mode !== "collection" && (
          <LabelSettingsPanel title="Determination label settings" settings={determinationSettings} onSettings={setDeterminationSettings}>
            <label className="field span-2">
              <span>Identification year — optional</span>
              <input inputMode="numeric" maxLength={4} value={identificationYear} onChange={(input) => setIdentificationYear(input.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="e.g. 2026" />
            </label>
            <label className="checkbox-row label-checkbox settings-checkbox span-2"><input type="checkbox" checked={includeSpecimenIdentifier} onChange={(input) => setIncludeSpecimenIdentifier(input.target.checked)} />Print specimen ID</label>
            <label className="checkbox-row label-checkbox settings-checkbox span-2"><input type="checkbox" checked={shortenIdentifierNames} onChange={(input) => setShortenIdentifierNames(input.target.checked)} />Shorten identifier first names</label>
          </LabelSettingsPanel>
        )}

        {error && <div className="label-error"><p>{error}</p><button type="button" className="secondary-button" onClick={() => { setPreviewError(null); setPreviewAttempt((attempt) => attempt + 1); }}>Retry preview</button></div>}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="button" className="primary-button" disabled={!jobs.length || copiesEditing || !previewIsCurrent || Boolean(error)} onClick={createPdf}>
            <Download aria-hidden="true" />{`Download ${jobs.length} labels`}
          </button>
        </div>
      </div>
    </div>
  );
}

function LabelSettingsPanel({ title, settings, onSettings, children }: {
  title: string;
  settings: LabelSettings;
  onSettings: (settings: LabelSettings) => void;
  children: React.ReactNode;
}) {
  return (
    <details className="label-advanced">
      <summary>{title}</summary>
      <div className="form-grid label-settings-grid">
        {children}
        <label className="field"><span>Width, mm</span><input type="number" min="10" max="60" step="1" value={settings.widthMm} onChange={(input) => onSettings({ ...settings, widthMm: Number(input.target.value) })} /></label>
        <label className="field"><span>Height, mm</span><input type="number" min="5" max="40" step="1" value={settings.heightMm} onChange={(input) => onSettings({ ...settings, heightMm: Number(input.target.value) })} /></label>
        <label className="field"><span>Preferred font, pt</span><input type="number" min="3" max="10" step="0.25" value={settings.preferredFontSize} onChange={(input) => onSettings({ ...settings, preferredFontSize: Number(input.target.value) })} /></label>
        <label className="field"><span>Maximum font, pt</span><input type="number" min="3" max="12" step="0.25" value={settings.maximumFontSize} disabled={!settings.autoEnlarge} onChange={(input) => onSettings({ ...settings, maximumFontSize: Number(input.target.value) })} /></label>
        <label className="field"><span>Line spacing</span><input type="number" min="0.8" max="1.8" step="0.05" value={settings.lineSpacing} onChange={(input) => onSettings({ ...settings, lineSpacing: Number(input.target.value) })} /></label>
        <label className="field"><span>Vertical alignment</span><select value={settings.verticalAlignment} onChange={(input) => onSettings({ ...settings, verticalAlignment: input.target.value as LabelSettings["verticalAlignment"] })}><option value="balanced">Balanced</option><option value="top">Top</option></select></label>
        <label className="checkbox-row label-checkbox settings-checkbox span-2"><input type="checkbox" checked={settings.autoEnlarge} onChange={(input) => onSettings({ ...settings, autoEnlarge: input.target.checked })} />Auto-enlarge short labels up to the maximum font size</label>
      </div>
    </details>
  );
}
