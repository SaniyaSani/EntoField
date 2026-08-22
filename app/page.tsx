"use client";

import {
  ArrowLeft,
  ArrowRight,
  Bug,
  CalendarDays,
  Camera,
  Check,
  CloudSun,
  Crosshair,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  Leaf,
  LocateFixed,
  MapPinned,
  Maximize2,
  Minimize2,
  MapPin,
  Package,
  Plus,
  Route,
  Settings,
  Trash2,
  Upload,
  WifiOff,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  clearAllData,
  deletePhoto,
  loadState,
  savePhoto,
  saveState,
} from "@/lib/entofield-db";
import {
  buildDarwinCoreRows,
  buildEntoLabelRows,
  downloadCompleteZip,
  downloadCsv,
  downloadXlsx,
} from "@/lib/exports";
import type {
  AppState,
  CollectingEvent,
  FieldTrip,
  PhotoMeta,
  SpecimenRecord,
} from "@/lib/types";

type ViewName = "events" | "specimens" | "export" | "settings";
type EventDraft = Omit<CollectingEvent, "id" | "createdAt" | "photos">;
type TripDraft = Omit<FieldTrip, "id" | "createdAt">;
type SpecimenDraft = Omit<
  SpecimenRecord,
  "id" | "createdAt" | "photos" | "eventId"
>;
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let lastReverseGeocodeAt = 0;

const navigation: Array<{
  id: ViewName;
  label: string;
  icon: typeof CalendarDays;
}> = [
  { id: "events", label: "Field trips", icon: MapPinned },
  { id: "specimens", label: "Specimens", icon: Bug },
  { id: "export", label: "Export", icon: Download },
  { id: "settings", label: "Settings", icon: Settings },
];

const UNASSIGNED_TRIP = "__unassigned__";

const exampleTrip: FieldTrip = {
  id: "FT-20260730-001",
  name: "Männedorf meadow walk",
  startDate: "2026-07-30",
  endDate: "2026-07-30",
  region: "Zürich, Switzerland",
  participants: "Example collector",
  notes: "Example only — remove it in Settings when you are ready.",
  createdAt: "2026-07-30T14:30:00.000Z",
  isExample: true,
};

const exampleEvent: CollectingEvent = {
  id: "EF-20260730-003",
  tripId: exampleTrip.id,
  date: "2026-07-30",
  time: "14:37",
  country: "Switzerland",
  region: "Zürich",
  locality: "Männedorf, meadow edge",
  latitude: 47.24281,
  longitude: 8.69214,
  uncertainty: 6,
  altitude: 430,
  coordinateSource: "device GPS",
  collector: "Example collector",
  method: "sweep net",
  habitat: "flower-rich meadow",
  host: "",
  weather: "22 °C, partly cloudy, light wind",
  notes: "Example only — delete it in Settings when you are ready.",
  photos: [],
  createdAt: "2026-07-30T14:37:00.000Z",
  isExample: true,
};

const exampleSpecimens: SpecimenRecord[] = [
  {
    id: "EF-20260730-003-S01",
    eventId: exampleEvent.id,
    recordType: "specimen",
    quantity: 1,
    scientificName: "Bombus sp.",
    identifier: "",
    sex: "",
    lifeStage: "adult",
    notes: "",
    photos: [],
    createdAt: exampleEvent.createdAt,
    isExample: true,
  },
  {
    id: "EF-20260730-003-L01",
    eventId: exampleEvent.id,
    recordType: "lot",
    quantity: 11,
    scientificName: "Coleoptera",
    identifier: "",
    sex: "",
    lifeStage: "adult",
    notes: "Example lot; can be split into individual specimens.",
    photos: [],
    createdAt: exampleEvent.createdAt,
    isExample: true,
  },
];

const initialState: AppState = {
  schemaVersion: 2,
  trips: [exampleTrip],
  events: [exampleEvent],
  specimens: exampleSpecimens,
  preferences: { defaultCollector: "", idPrefix: "EF" },
};

function normalizeState(stored: Partial<AppState> & { schemaVersion?: number }): AppState {
  const storedEvents = Array.isArray(stored.events) ? stored.events : [];
  const storedTrips = Array.isArray(stored.trips) ? stored.trips : [];
  const needsExampleTrip =
    !storedTrips.some((trip) => trip.id === exampleTrip.id) &&
    storedEvents.some((event) => event.isExample && !event.tripId);
  const trips = needsExampleTrip ? [exampleTrip, ...storedTrips] : storedTrips;
  const events = storedEvents.map((event) =>
    needsExampleTrip && event.isExample && !event.tripId
      ? { ...event, tripId: exampleTrip.id }
      : event,
  );
  return {
    schemaVersion: 2,
    trips,
    events,
    specimens: Array.isArray(stored.specimens) ? stored.specimens : [],
    preferences: stored.preferences ?? initialState.preferences,
  };
}

function todayParts() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return {
    date: local.toISOString().slice(0, 10),
    time: local.toISOString().slice(11, 16),
  };
}

function emptyEvent(defaultCollector: string): EventDraft {
  const now = todayParts();
  return {
    ...now,
    tripId: undefined,
    country: "",
    region: "",
    locality: "",
    latitude: undefined,
    longitude: undefined,
    uncertainty: undefined,
    altitude: undefined,
    coordinateSource: "",
    collector: defaultCollector,
    method: "",
    habitat: "",
    host: "",
    weather: "",
    notes: "",
    isExample: false,
  };
}

function emptyTrip(): TripDraft {
  const { date } = todayParts();
  return {
    name: "",
    startDate: date,
    endDate: date,
    region: "",
    participants: "",
    notes: "",
    isExample: false,
  };
}

function tripId(state: AppState, date: string) {
  const day = date.replaceAll("-", "");
  const pattern = new RegExp(`^FT-${day}-(\\d+)$`);
  const current = state.trips.reduce((maximum, trip) => {
    const match = trip.id.match(pattern);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return `FT-${day}-${String(current + 1).padStart(3, "0")}`;
}

function emptySpecimen(recordType: "specimen" | "lot"): SpecimenDraft {
  return {
    recordType,
    quantity: recordType === "lot" ? 2 : 1,
    scientificName: "",
    identifier: "",
    sex: "",
    lifeStage: "",
    notes: "",
    isExample: false,
  };
}

function eventId(state: AppState, date: string) {
  const prefix =
    state.preferences.idPrefix.trim().replace(/[^A-Za-z0-9-]/g, "") || "EF";
  const day = date.replaceAll("-", "");
  const pattern = new RegExp(`^${prefix}-${day}-(\\d+)$`);
  const current = state.events.reduce((maximum, event) => {
    const match = event.id.match(pattern);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return `${prefix}-${day}-${String(current + 1).padStart(3, "0")}`;
}

function nextRecordId(
  state: AppState,
  collectingEventId: string,
  type: "specimen" | "lot",
  offset = 0,
) {
  const letter = type === "specimen" ? "S" : "L";
  const pattern = new RegExp(`^${collectingEventId}-${letter}(\\d+)$`);
  const current = state.specimens.reduce((maximum, specimen) => {
    const match = specimen.id.match(pattern);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return `${collectingEventId}-${letter}${String(current + offset + 1).padStart(
    2,
    "0",
  )}`;
}

function numberOrUndefined(value: string) {
  const parsed = Number(value);
  return value === "" || !Number.isFinite(parsed) ? undefined : parsed;
}

function formatCoordinates(event: CollectingEvent) {
  if (event.latitude === undefined || event.longitude === undefined) {
    return "Coordinates not recorded";
  }
  return `${event.latitude.toFixed(5)}, ${event.longitude.toFixed(5)}${
    event.uncertainty ? ` ± ${Math.round(event.uncertainty)} m` : ""
  }`;
}

function fileMeta(file: File, extracted?: Partial<PhotoMeta>): PhotoMeta {
  return {
    id: crypto.randomUUID(),
    filename: file.name || `field-photo-${Date.now()}.jpg`,
    mimeType: file.type || "image/jpeg",
    size: file.size,
    ...extracted,
  };
}

function weatherDescription(code: number) {
  if (code === 0) return "clear";
  if ([1, 2].includes(code)) return "mostly clear";
  if (code === 3) return "overcast";
  if ([45, 48].includes(code)) return "fog";
  if (code >= 51 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain showers";
  if (code >= 95) return "thunderstorm";
  return "mixed conditions";
}

export default function Home() {
  const [state, setState] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [activeView, setActiveView] = useState<ViewName>("events");
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [tripModal, setTripModal] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [tripDraft, setTripDraft] = useState<TripDraft>(emptyTrip());
  const [eventModal, setEventModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventDraft, setEventDraft] = useState<EventDraft>(emptyEvent(""));
  const [eventFiles, setEventFiles] = useState<File[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [specimenModal, setSpecimenModal] = useState(false);
  const [editingSpecimenId, setEditingSpecimenId] = useState<string | null>(null);
  const [specimenEventId, setSpecimenEventId] = useState("");
  const [specimenDraft, setSpecimenDraft] = useState<SpecimenDraft>(
    emptySpecimen("specimen"),
  );
  const [specimenFiles, setSpecimenFiles] = useState<File[]>([]);
  const [bulkCount, setBulkCount] = useState(20);
  const [includeExamples, setIncludeExamples] = useState(true);
  const [exportBusy, setExportBusy] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    let active = true;
    loadState()
      .then((stored) => {
        if (active && stored) setState(normalizeState(stored));
      })
      .catch(() =>
        setNotice("Local storage could not be opened. Reload before field use."),
      )
      .finally(() => active && setHydrated(true));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveState(state).catch(() =>
      setNotice("A change could not be saved locally. Please export a backup."),
    );
  }, [state, hydrated]);

  useEffect(() => {
    const updateStatus = () => setOnline(navigator.onLine);
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    window.addEventListener("beforeinstallprompt", onInstall);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  }, []);

  const selectedEvent = state.events.find(
    (event) => event.id === selectedEventId,
  );
  const selectedTrip =
    selectedTripId && selectedTripId !== UNASSIGNED_TRIP
      ? state.trips.find((trip) => trip.id === selectedTripId)
      : undefined;
  const selectedTripEvents = selectedTripId
    ? state.events.filter((event) =>
        selectedTripId === UNASSIGNED_TRIP
          ? !event.tripId
          : event.tripId === selectedTripId,
      )
    : [];
  const selectedSpecimens = state.specimens.filter(
    (specimen) => specimen.eventId === selectedEventId,
  );
  const totalIndividuals = useMemo(
    () => state.specimens.reduce((sum, record) => sum + record.quantity, 0),
    [state.specimens],
  );

  const exportData = useMemo(() => {
    const events = includeExamples
      ? state.events
      : state.events.filter((event) => !event.isExample);
    const eventIds = new Set(events.map((event) => event.id));
    const specimens = state.specimens.filter(
      (specimen) =>
        eventIds.has(specimen.eventId) &&
        (includeExamples || !specimen.isExample),
    );
    return { events, specimens };
  }, [includeExamples, state]);

  function navigate(view: ViewName) {
    setActiveView(view);
    setSelectedEventId(null);
    setSelectedTripId(null);
  }

  function openNewTrip() {
    setEditingTripId(null);
    setTripDraft(emptyTrip());
    setTripModal(true);
  }

  function openEditTrip(trip: FieldTrip) {
    setEditingTripId(trip.id);
    setTripDraft({
      name: trip.name,
      startDate: trip.startDate,
      endDate: trip.endDate,
      region: trip.region,
      participants: trip.participants,
      notes: trip.notes,
      isExample: trip.isExample,
    });
    setTripModal(true);
  }

  function submitTrip(event: React.FormEvent) {
    event.preventDefault();
    if (editingTripId) {
      setState((current) => ({
        ...current,
        trips: current.trips.map((trip) =>
          trip.id === editingTripId ? { ...trip, ...tripDraft } : trip,
        ),
      }));
      setNotice("Field trip updated.");
    } else {
      const id = tripId(state, tripDraft.startDate);
      const fieldTrip: FieldTrip = {
        ...tripDraft,
        id,
        name: tripDraft.name.trim() || "Unnamed field trip",
        endDate: tripDraft.endDate || tripDraft.startDate,
        createdAt: new Date().toISOString(),
      };
      setState((current) => ({
        ...current,
        trips: [fieldTrip, ...current.trips],
      }));
      setSelectedTripId(id);
      setNotice(`${fieldTrip.name} created. Add the first collecting event.`);
    }
    setTripModal(false);
  }

  function removeTrip(trip: FieldTrip) {
    const eventCount = state.events.filter(
      (event) => event.tripId === trip.id,
    ).length;
    if (
      !window.confirm(
        `Delete the field trip “${trip.name}”? Its ${eventCount} collecting event(s) will remain under Unassigned events.`,
      )
    )
      return;
    setState((current) => ({
      ...current,
      trips: current.trips.filter((item) => item.id !== trip.id),
      events: current.events.map((event) =>
        event.tripId === trip.id ? { ...event, tripId: undefined } : event,
      ),
    }));
    setSelectedTripId(null);
    setNotice("Field trip deleted. Its collecting events were kept.");
  }

  function openNewEvent(fieldTripId?: string) {
    setEditingEventId(null);
    setEventDraft({
      ...emptyEvent(state.preferences.defaultCollector),
      tripId:
        fieldTripId && fieldTripId !== UNASSIGNED_TRIP
          ? fieldTripId
          : undefined,
    });
    setEventFiles([]);
    setEventModal(true);
  }

  function openEditEvent(event: CollectingEvent) {
    setEditingEventId(event.id);
    setEventDraft({
      date: event.date,
      time: event.time,
      tripId: event.tripId,
      country: event.country,
      region: event.region,
      locality: event.locality,
      latitude: event.latitude,
      longitude: event.longitude,
      uncertainty: event.uncertainty,
      altitude: event.altitude,
      coordinateSource: event.coordinateSource,
      collector: event.collector,
      method: event.method,
      habitat: event.habitat,
      host: event.host,
      weather: event.weather,
      notes: event.notes,
      isExample: event.isExample,
    });
    setEventFiles([]);
    setEventModal(true);
  }

  async function reverseGeocode(latitude: number, longitude: number) {
    if (!navigator.onLine) return;
    const now = Date.now();
    if (now - lastReverseGeocodeAt < 1_100) return;
    lastReverseGeocodeAt = now;
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`,
        { headers: { "Accept-Language": "en" } },
      );
      if (!response.ok) return;
      const data = await response.json();
      const address = data.address ?? {};
      setEventDraft((draft) => ({
        ...draft,
        locality:
          draft.locality ||
          [
            address.village ||
              address.town ||
              address.city ||
              address.municipality,
            address.road,
          ]
            .filter(Boolean)
            .join(", ") ||
          data.display_name?.split(",").slice(0, 2).join(", ") ||
          "",
        region: draft.region || address.state || address.county || "",
        country: draft.country || address.country || "",
      }));
    } catch {
      setNotice("GPS was saved; the place name can be added manually offline.");
    }
  }

  function captureGps() {
    if (!navigator.geolocation) {
      setNotice("This browser does not provide device location.");
      return;
    }
    setNotice("Finding a high-accuracy position…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy, altitude } = position.coords;
        setEventDraft((draft) => ({
          ...draft,
          latitude,
          longitude,
          uncertainty: accuracy ? Math.round(accuracy) : undefined,
          altitude: altitude ?? draft.altitude,
          coordinateSource: "device GPS",
        }));
        setNotice("GPS position added to the collecting event.");
        void reverseGeocode(latitude, longitude);
      },
      (error) =>
        setNotice(
          error.code === 1
            ? "Location permission was not granted. You can enter coordinates manually."
            : "GPS is unavailable here. Try again in open sky or enter coordinates.",
        ),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 5_000 },
    );
  }

  async function extractPhotoData(file: File) {
    setPhotoBusy(true);
    try {
      const exifr = await import("exifr");
      const data = await exifr.parse(file, {
        gps: true,
        exif: true,
        tiff: true,
      });
      const captured = data?.DateTimeOriginal || data?.CreateDate;
      const latitude = data?.latitude;
      const longitude = data?.longitude;
      const altitude = data?.GPSAltitude;

      setEventDraft((draft) => {
        const next = { ...draft };
        if (captured instanceof Date && !Number.isNaN(captured.getTime())) {
          const local = new Date(
            captured.getTime() - captured.getTimezoneOffset() * 60_000,
          )
            .toISOString()
            .slice(0, 16);
          next.date = local.slice(0, 10);
          next.time = local.slice(11, 16);
        }
        if (typeof latitude === "number" && typeof longitude === "number") {
          next.latitude = latitude;
          next.longitude = longitude;
          next.coordinateSource = "photo EXIF";
        }
        if (typeof altitude === "number") next.altitude = altitude;
        return next;
      });

      if (typeof latitude === "number" && typeof longitude === "number") {
        setNotice("Photo GPS and capture time were added automatically.");
        void reverseGeocode(latitude, longitude);
      } else if (captured) {
        setNotice("Photo time was added. This photo does not contain GPS data.");
      } else {
        setNotice(
          "Photo attached. It contains no readable GPS or capture-time metadata.",
        );
      }
    } catch {
      setNotice("Photo attached, but its metadata could not be read.");
    } finally {
      setPhotoBusy(false);
    }
  }

  function addEventFiles(files: FileList | null, extract = false) {
    if (!files?.length) return;
    const images = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );
    setEventFiles((current) => [...current, ...images]);
    if (extract && images[0]) void extractPhotoData(images[0]);
  }

  async function fetchWeather() {
    if (
      eventDraft.latitude === undefined ||
      eventDraft.longitude === undefined
    ) {
      setNotice("Add GPS coordinates before requesting weather.");
      return;
    }
    if (!navigator.onLine) {
      setNotice("Automatic weather needs a connection; manual notes work offline.");
      return;
    }
    try {
      setNotice("Reading weather for this position…");
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${eventDraft.latitude}&longitude=${eventDraft.longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m`,
      );
      if (!response.ok) throw new Error("weather");
      const data = await response.json();
      const current = data.current;
      setEventDraft((draft) => ({
        ...draft,
        weather: `${current.temperature_2m} °C, ${weatherDescription(
          current.weather_code,
        )}, humidity ${current.relative_humidity_2m}%, wind ${
          current.wind_speed_10m
        } km/h (estimated)`,
      }));
      setNotice("Estimated weather added; you can edit it after observation.");
    } catch {
      setNotice("Weather service is unavailable. Add your observation manually.");
    }
  }

  async function persistFiles(files: File[]) {
    const metas: PhotoMeta[] = [];
    for (const file of files) {
      const meta = fileMeta(file);
      await savePhoto(meta, file);
      metas.push(meta);
    }
    return metas;
  }

  async function submitEvent(event: React.FormEvent) {
    event.preventDefault();
    const photos = await persistFiles(eventFiles);
    if (editingEventId) {
      setState((current) => ({
        ...current,
        events: current.events.map((item) =>
          item.id === editingEventId
            ? { ...item, ...eventDraft, photos: [...item.photos, ...photos] }
            : item,
        ),
      }));
      setNotice("Collecting event updated.");
    } else {
      const id = eventId(state, eventDraft.date);
      const collectingEvent: CollectingEvent = {
        ...eventDraft,
        id,
        locality: eventDraft.locality || "Unnamed field site",
        photos,
        createdAt: new Date().toISOString(),
      };
      setState((current) => ({
        ...current,
        events: [collectingEvent, ...current.events],
      }));
      setSelectedEventId(id);
      setNotice(`${id} created. Add specimens or a lot now.`);
    }
    setEventModal(false);
    setEventFiles([]);
  }

  function openSpecimen(
    collectingEventId: string,
    type: "specimen" | "lot",
  ) {
    setEditingSpecimenId(null);
    setSpecimenEventId(collectingEventId);
    setSpecimenDraft(emptySpecimen(type));
    setSpecimenFiles([]);
    setSpecimenModal(true);
  }

  function openEditSpecimen(specimen: SpecimenRecord) {
    setEditingSpecimenId(specimen.id);
    setSpecimenEventId(specimen.eventId);
    setSpecimenDraft({
      recordType: specimen.recordType,
      quantity: specimen.quantity,
      scientificName: specimen.scientificName,
      identifier: specimen.identifier,
      sex: specimen.sex,
      lifeStage: specimen.lifeStage,
      notes: specimen.notes,
      isExample: specimen.isExample,
    });
    setSpecimenFiles([]);
    setSpecimenModal(true);
  }

  async function submitSpecimen(event: React.FormEvent) {
    event.preventDefault();
    const photos = await persistFiles(specimenFiles);
    if (editingSpecimenId) {
      setState((current) => ({
        ...current,
        specimens: current.specimens.map((record) =>
          record.id === editingSpecimenId
            ? {
                ...record,
                ...specimenDraft,
                quantity: Math.max(1, specimenDraft.quantity),
                photos: [...record.photos, ...photos],
              }
            : record,
        ),
      }));
      setSpecimenModal(false);
      setNotice(`${editingSpecimenId} updated.`);
      return;
    }
    const id = nextRecordId(
      state,
      specimenEventId,
      specimenDraft.recordType,
    );
    const specimen: SpecimenRecord = {
      ...specimenDraft,
      id,
      eventId: specimenEventId,
      quantity: Math.max(1, specimenDraft.quantity),
      photos,
      createdAt: new Date().toISOString(),
    };
    setState((current) => ({
      ...current,
      specimens: [specimen, ...current.specimens],
    }));
    setSpecimenModal(false);
    setNotice(`${id} saved. Event data will be inherited in the export.`);
  }

  function addBulkSpecimens(collectingEventId: string) {
    const count = Math.max(1, Math.min(200, Math.floor(bulkCount || 1)));
    const records: SpecimenRecord[] = Array.from({ length: count }, (_, index) => ({
      ...emptySpecimen("specimen"),
      id: nextRecordId(state, collectingEventId, "specimen", index),
      eventId: collectingEventId,
      photos: [],
      createdAt: new Date().toISOString(),
    }));
    setState((current) => ({
      ...current,
      specimens: [...records, ...current.specimens],
    }));
    setNotice(
      `${count} specimen rows created. Only ID and identification need changing.`,
    );
  }

  function splitLot(lot: SpecimenRecord) {
    if (
      !window.confirm(
        `Split ${lot.id} into ${lot.quantity} individual specimen rows?`,
      )
    )
      return;
    const records: SpecimenRecord[] = Array.from(
      { length: lot.quantity },
      (_, index) => ({
        ...lot,
        id: nextRecordId(state, lot.eventId, "specimen", index),
        recordType: "specimen",
        quantity: 1,
        photos: [],
        notes: [lot.notes, `Split from ${lot.id}`].filter(Boolean).join(" | "),
        createdAt: new Date().toISOString(),
      }),
    );
    setState((current) => ({
      ...current,
      specimens: [
        ...records,
        ...current.specimens.filter((record) => record.id !== lot.id),
      ],
    }));
    setNotice(`${lot.id} split into ${records.length} specimens.`);
  }

  async function removeEvent(event: CollectingEvent) {
    const records = state.specimens.filter(
      (record) => record.eventId === event.id,
    );
    if (
      !window.confirm(
        `Delete ${event.id}, its ${records.length} rows, and attached photos?`,
      )
    )
      return;
    const photos = [
      ...event.photos,
      ...records.flatMap((record) => record.photos),
    ];
    await Promise.all(photos.map((photo) => deletePhoto(photo.id)));
    setState((current) => ({
      ...current,
      events: current.events.filter((item) => item.id !== event.id),
      specimens: current.specimens.filter(
        (record) => record.eventId !== event.id,
      ),
    }));
    setSelectedEventId(null);
    setNotice(`${event.id} deleted.`);
  }

  async function removeSpecimen(specimen: SpecimenRecord) {
    if (!window.confirm(`Delete ${specimen.id}?`)) return;
    await Promise.all(
      specimen.photos.map((photo) => deletePhoto(photo.id)),
    );
    setState((current) => ({
      ...current,
      specimens: current.specimens.filter(
        (record) => record.id !== specimen.id,
      ),
    }));
  }

  function updatePreferences(changes: Partial<AppState["preferences"]>) {
    setState((current) => ({
      ...current,
      preferences: { ...current.preferences, ...changes },
    }));
  }

  function removeExamples() {
    const exampleIds = new Set(
      state.events.filter((event) => event.isExample).map((event) => event.id),
    );
    setState((current) => ({
      ...current,
      trips: current.trips.filter((trip) => !trip.isExample),
      events: current.events.filter((event) => !event.isExample),
      specimens: current.specimens.filter(
        (specimen) => !specimen.isExample && !exampleIds.has(specimen.eventId),
      ),
    }));
    if (selectedTrip?.isExample) setSelectedTripId(null);
    setSelectedEventId(null);
    setNotice("Example records removed.");
  }

  async function eraseEverything() {
    if (
      !window.confirm(
        "Delete every EntoField event, specimen, and photo from this device? Export a backup first.",
      )
    )
      return;
    await clearAllData();
    setState({
      schemaVersion: 2,
      trips: [],
      events: [],
      specimens: [],
      preferences: state.preferences,
    });
    setSelectedTripId(null);
    setSelectedEventId(null);
    setNotice("All local field data deleted.");
  }

  function downloadBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `EntoField_backup_${todayParts().date}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  async function runCompleteExport() {
    setExportBusy(true);
    try {
      await downloadCompleteZip(exportData.events, exportData.specimens);
      setNotice("Complete export downloaded with tables and photos.");
    } finally {
      setExportBusy(false);
    }
  }

  async function installApp() {
    if (!installPrompt) {
      setNotice(
        "On iPhone: Safari → Share → Add to Home Screen. On Android: browser menu → Install app.",
      );
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice.outcome === "accepted") setNotice("EntoField installed.");
  }

  const entoRows = buildEntoLabelRows(
    exportData.events,
    exportData.specimens,
  );
  const dwcRows = buildDarwinCoreRows(
    exportData.events,
    exportData.specimens,
  );

  return (
    <div className="app-shell">
      <aside className="side-navigation" aria-label="Main navigation">
        <button className="brand" onClick={() => navigate("events")}>
          <span className="brand-mark">
            <Bug aria-hidden="true" />
          </span>
          <span>EntoField</span>
        </button>
        <nav className="navigation-list">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`navigation-item ${
                  activeView === item.id ? "is-active" : ""
                }`}
                onClick={() => navigate(item.id)}
                aria-current={activeView === item.id ? "page" : undefined}
              >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-stats">
          <span>{state.trips.length} field trips</span>
          <span>{state.events.length} events</span>
          <span>{totalIndividuals} individuals</span>
        </div>
        <div className="sidebar-flourish" aria-hidden="true">
          <Leaf />
          <span />
          <Bug />
        </div>
      </aside>

      <main className="main-area">
        <header className="utility-header">
          <button
            className={`status-chip ${online ? "" : "is-offline"}`}
            onClick={() =>
              setNotice(
                online
                  ? "Records are stored on this device and remain available offline."
                  : "You are offline. New field records will still be saved here.",
              )
            }
          >
            <span className="status-dot" />
            {online ? "Offline ready" : "Working offline"}
          </button>
        </header>

        <div className="page-content">
          {activeView === "events" &&
            (selectedEvent ? (
              <EventDetail
                event={selectedEvent}
                records={selectedSpecimens}
                bulkCount={bulkCount}
                onBulkCount={setBulkCount}
                backLabel={selectedTripId ? "Back to field trip" : "All field trips"}
                onBack={() => setSelectedEventId(null)}
                onEdit={() => openEditEvent(selectedEvent)}
                onDelete={() => void removeEvent(selectedEvent)}
                onAddSpecimen={() =>
                  openSpecimen(selectedEvent.id, "specimen")
                }
                onAddLot={() => openSpecimen(selectedEvent.id, "lot")}
                onAddBulk={() => addBulkSpecimens(selectedEvent.id)}
                onSplitLot={splitLot}
                onEditRecord={openEditSpecimen}
                onDeleteRecord={(record) => void removeSpecimen(record)}
              />
            ) : selectedTripId ? (
              <TripView
                trip={selectedTrip}
                unassigned={selectedTripId === UNASSIGNED_TRIP}
                events={selectedTripEvents}
                specimens={state.specimens}
                onBack={() => setSelectedTripId(null)}
                onNewEvent={() => openNewEvent(selectedTripId)}
                onSelectEvent={setSelectedEventId}
                onEditTrip={selectedTrip ? () => openEditTrip(selectedTrip) : undefined}
                onDeleteTrip={selectedTrip ? () => removeTrip(selectedTrip) : undefined}
              />
            ) : (
              <TripsView
                trips={state.trips}
                events={state.events}
                specimens={state.specimens}
                onNewTrip={openNewTrip}
                onSelectTrip={setSelectedTripId}
              />
            ))}

          {activeView === "specimens" && (
            <SpecimensView
              specimens={state.specimens}
              events={state.events}
              onOpenEvent={(id) => {
                setActiveView("events");
                const event = state.events.find((item) => item.id === id);
                setSelectedTripId(event?.tripId ?? null);
                setSelectedEventId(id);
              }}
              onEdit={openEditSpecimen}
              onDelete={(record) => void removeSpecimen(record)}
            />
          )}

          {activeView === "export" && (
            <ExportView
              eventCount={exportData.events.length}
              rowCount={exportData.specimens.length}
              includeExamples={includeExamples}
              onIncludeExamples={setIncludeExamples}
              disabled={!entoRows.length}
              busy={exportBusy}
              onXlsx={() =>
                downloadXlsx(entoRows, `EntoLabel_import_${todayParts().date}.xlsx`)
              }
              onCsv={() =>
                downloadCsv(entoRows, `EntoLabel_import_${todayParts().date}.csv`)
              }
              onDwc={() =>
                downloadCsv(dwcRows, `Darwin_Core_${todayParts().date}.csv`)
              }
              onZip={() => void runCompleteExport()}
            />
          )}

          {activeView === "settings" && (
            <SettingsView
              preferences={state.preferences}
              hasExamples={state.events.some((event) => event.isExample)}
              installAvailable={Boolean(installPrompt)}
              onPreferences={updatePreferences}
              onInstall={() => void installApp()}
              onBackup={downloadBackup}
              onRemoveExamples={removeExamples}
              onErase={() => void eraseEverything()}
            />
          )}
        </div>
      </main>

      <nav className="mobile-navigation" aria-label="Mobile navigation">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={activeView === item.id ? "is-active" : ""}
              onClick={() => navigate(item.id)}
              aria-label={item.label}
              aria-current={activeView === item.id ? "page" : undefined}
            >
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {tripModal && (
        <TripModal
          draft={tripDraft}
          editing={Boolean(editingTripId)}
          onDraft={setTripDraft}
          onSubmit={submitTrip}
          onClose={() => setTripModal(false)}
        />
      )}

      {eventModal && (
        <EventModal
          draft={eventDraft}
          files={eventFiles}
          editing={Boolean(editingEventId)}
          photoBusy={photoBusy}
          onDraft={setEventDraft}
          onFiles={addEventFiles}
          onRemoveFile={(index) =>
            setEventFiles((files) => files.filter((_, item) => item !== index))
          }
          onGps={captureGps}
          onWeather={() => void fetchWeather()}
          onSubmit={(event) => void submitEvent(event)}
          onClose={() => setEventModal(false)}
        />
      )}

      {specimenModal && (
        <SpecimenModal
          draft={specimenDraft}
          files={specimenFiles}
          eventId={specimenEventId}
          editing={Boolean(editingSpecimenId)}
          onDraft={setSpecimenDraft}
          onFiles={(files) =>
            files &&
            setSpecimenFiles((current) => [...current, ...Array.from(files)])
          }
          onSubmit={(event) => void submitSpecimen(event)}
          onClose={() => setSpecimenModal(false)}
        />
      )}

      {notice && (
        <div className="notice" role="status">
          {online ? <Leaf aria-hidden="true" /> : <WifiOff aria-hidden="true" />}
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Close message">
            ×
          </button>
        </div>
      )}
    </div>
  );
}

function formatTripDates(trip: FieldTrip) {
  return trip.startDate === trip.endDate
    ? trip.startDate
    : `${trip.startDate} – ${trip.endDate}`;
}

function individualCount(records: SpecimenRecord[], eventIds: Set<string>) {
  return records.reduce(
    (sum, record) => sum + (eventIds.has(record.eventId) ? record.quantity : 0),
    0,
  );
}

function TripsView({
  trips,
  events,
  specimens,
  onNewTrip,
  onSelectTrip,
}: {
  trips: FieldTrip[];
  events: CollectingEvent[];
  specimens: SpecimenRecord[];
  onNewTrip: () => void;
  onSelectTrip: (id: string) => void;
}) {
  const orderedTrips = [...trips].sort((a, b) =>
    b.startDate.localeCompare(a.startDate),
  );
  const unassigned = events.filter((event) => !event.tripId);

  return (
    <section aria-labelledby="trips-title">
      <div className="title-row trips-title-row">
        <div>
          <p className="eyebrow">Field notebook</p>
          <h1 id="trips-title">Field trips</h1>
          <p className="title-description">
            Keep every collecting point together as one mapped field day.
          </p>
        </div>
        <button className="primary-button" onClick={onNewTrip}>
          <Plus aria-hidden="true" />
          New field trip
        </button>
      </div>

      {!orderedTrips.length && !unassigned.length ? (
        <div className="empty-state trip-empty-state">
          <Image
            src="/field-illustration.png"
            alt=""
            width={1536}
            height={1152}
            priority
          />
          <p className="eyebrow">Ready for an excursion</p>
          <h2>Start a trip, then add collecting points as you go.</h2>
          <p>
            Each point keeps its own GPS, habitat, method, weather and specimens,
            while the trip keeps them together on one map.
          </p>
          <button className="primary-button" onClick={onNewTrip}>
            <Route aria-hidden="true" /> Start first field trip
          </button>
        </div>
      ) : (
        <div className="trip-grid">
          {orderedTrips.map((trip) => {
            const tripEvents = events.filter((event) => event.tripId === trip.id);
            const ids = new Set(tripEvents.map((event) => event.id));
            const individuals = individualCount(specimens, ids);
            const mapped = tripEvents.filter(
              (event) =>
                event.latitude !== undefined && event.longitude !== undefined,
            ).length;
            return (
              <article className="trip-card" key={trip.id}>
                <button
                  className="trip-card-main"
                  onClick={() => onSelectTrip(trip.id)}
                >
                  <span className="trip-card-map" aria-hidden="true">
                    <span className="route-line" />
                    <MapPin className="route-pin pin-one" />
                    <MapPin className="route-pin pin-two" />
                    <MapPin className="route-pin pin-three" />
                  </span>
                  <span className="trip-card-content">
                    <span className="sample-label">
                      {trip.isExample ? "Example field trip" : trip.region || "Field trip"}
                    </span>
                    <strong>{trip.name}</strong>
                    <span className="trip-date">
                      <CalendarDays aria-hidden="true" /> {formatTripDates(trip)}
                    </span>
                    <span className="trip-metrics">
                      <span>{tripEvents.length} events</span>
                      <span>{mapped} mapped</span>
                      <span>{individuals} individuals</span>
                    </span>
                    <span className="trip-open">
                      Open field trip <ArrowRight aria-hidden="true" />
                    </span>
                  </span>
                </button>
              </article>
            );
          })}

          {unassigned.length > 0 && (
            <article className="trip-card unassigned-card">
              <button
                className="trip-card-main"
                onClick={() => onSelectTrip(UNASSIGNED_TRIP)}
              >
                <span className="trip-card-map" aria-hidden="true">
                  <MapPinned />
                </span>
                <span className="trip-card-content">
                  <span className="sample-label">Kept safely</span>
                  <strong>Unassigned events</strong>
                  <span className="trip-date">
                    Older records that are not inside a field trip yet
                  </span>
                  <span className="trip-metrics">
                    <span>{unassigned.length} events</span>
                    <span>
                      {individualCount(
                        specimens,
                        new Set(unassigned.map((event) => event.id)),
                      )}{" "}
                      individuals
                    </span>
                  </span>
                  <span className="trip-open">
                    View events <ArrowRight aria-hidden="true" />
                  </span>
                </span>
              </button>
            </article>
          )}
        </div>
      )}
    </section>
  );
}

function TripView({
  trip,
  unassigned,
  events,
  specimens,
  onBack,
  onNewEvent,
  onSelectEvent,
  onEditTrip,
  onDeleteTrip,
}: {
  trip?: FieldTrip;
  unassigned: boolean;
  events: CollectingEvent[];
  specimens: SpecimenRecord[];
  onBack: () => void;
  onNewEvent: () => void;
  onSelectEvent: (id: string) => void;
  onEditTrip?: () => void;
  onDeleteTrip?: () => void;
}) {
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);
  const orderedEvents = useMemo(
    () =>
      [...events].sort((a, b) =>
        `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
      ),
    [events],
  );
  const eventIds = new Set(events.map((event) => event.id));
  const individuals = individualCount(specimens, eventIds);

  function focusFromMap(id: string | null) {
    setFocusedEventId(id);
    if (!id) return;
    window.setTimeout(() => {
      document
        .getElementById(`trip-event-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 40);
  }

  return (
    <section aria-labelledby="trip-title">
      <button className="text-button" onClick={onBack}>
        <ArrowLeft aria-hidden="true" /> All field trips
      </button>

      <div className="trip-heading">
        <div>
          <p className="eyebrow">
            {unassigned ? "Not grouped into a trip" : trip?.region || "Field trip"}
          </p>
          <h1 id="trip-title">{unassigned ? "Unassigned events" : trip?.name}</h1>
          <p className="trip-heading-meta">
            {!unassigned && trip && (
              <span>
                <CalendarDays aria-hidden="true" /> {formatTripDates(trip)}
              </span>
            )}
            <span>{events.length} events</span>
            <span>{individuals} individuals</span>
          </p>
        </div>
        {!unassigned && onEditTrip && onDeleteTrip && (
          <div className="heading-actions">
            <button className="secondary-button compact" onClick={onEditTrip}>
              Edit trip
            </button>
            <button className="icon-button danger" onClick={onDeleteTrip}>
              <Trash2 aria-hidden="true" />
              <span className="sr-only">Delete field trip</span>
            </button>
          </div>
        )}
      </div>

      <div className="trip-map-shell">
        <FieldMap
          key={`${focusedEventId ?? "all"}:${orderedEvents
            .map((event) => `${event.id}:${event.latitude}:${event.longitude}`)
            .join("|")}`}
          events={orderedEvents}
          specimens={specimens}
          selectedEventId={focusedEventId}
          onSelectEvent={focusFromMap}
          onOpenEvent={onSelectEvent}
        />
        <button className="map-new-event" onClick={onNewEvent}>
          <Plus aria-hidden="true" /> New event
        </button>
      </div>

      <div className="trip-event-section">
        <div className="trip-event-section-heading">
          <div>
            <p className="eyebrow">Collecting points</p>
            <h2>Events along this trip</h2>
          </div>
          <span>{events.length}</span>
        </div>

        {!orderedEvents.length ? (
          <div className="small-empty trip-small-empty">
            <MapPin aria-hidden="true" />
            <span>
              No collecting points yet. Add the first one from the map.
            </span>
          </div>
        ) : (
          <div className="trip-event-list">
            {orderedEvents.map((event, index) => {
              const records = specimens.filter(
                (record) => record.eventId === event.id,
              );
              const count = records.reduce(
                (sum, record) => sum + record.quantity,
                0,
              );
              const hasCoordinates =
                event.latitude !== undefined && event.longitude !== undefined;
              return (
                <article
                  id={`trip-event-${event.id}`}
                  key={event.id}
                  className={`trip-event-card ${
                    focusedEventId === event.id ? "is-focused" : ""
                  }`}
                  onClick={() => setFocusedEventId(event.id)}
                >
                  <button
                    className={`event-point-number ${
                      hasCoordinates ? "" : "is-unmapped"
                    }`}
                    onClick={(click) => {
                      click.stopPropagation();
                      setFocusedEventId(event.id);
                    }}
                    aria-label={
                      hasCoordinates
                        ? `Show point ${index + 1} on map`
                        : `Event ${index + 1} has no coordinates`
                    }
                  >
                    <span>{index + 1}</span>
                  </button>
                  <div className="trip-event-copy">
                    <p>{event.id}</p>
                    <h3>{event.locality}</h3>
                    <span>
                      {event.date} · {event.time || "time not recorded"}
                    </span>
                    <span className="trip-event-coordinates">
                      {formatCoordinates(event)}
                    </span>
                  </div>
                  <div className="trip-event-tags">
                    {event.method && <span>{event.method}</span>}
                    {event.habitat && <span>{event.habitat}</span>}
                    <span>{count} individuals</span>
                  </div>
                  <button
                    className="trip-event-open"
                    onClick={(click) => {
                      click.stopPropagation();
                      onSelectEvent(event.id);
                    }}
                  >
                    Open <ArrowRight aria-hidden="true" />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

const TILE_SIZE = 256;

function clampLatitude(latitude: number) {
  return Math.max(-85.0511, Math.min(85.0511, latitude));
}

function toWorld(latitude: number, longitude: number, zoom: number) {
  const size = TILE_SIZE * 2 ** zoom;
  const lat = (clampLatitude(latitude) * Math.PI) / 180;
  return {
    x: ((longitude + 180) / 360) * size,
    y:
      ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) *
      size,
  };
}

function fromWorld(x: number, y: number, zoom: number) {
  const size = TILE_SIZE * 2 ** zoom;
  const longitude = (x / size) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / size;
  const latitude = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { latitude: clampLatitude(latitude), longitude };
}

function fitMap(
  events: CollectingEvent[],
  width: number,
  height: number,
) {
  const points = events.filter(
    (event) => event.latitude !== undefined && event.longitude !== undefined,
  );
  if (!points.length) return { latitude: 47.25, longitude: 8.55, zoom: 8 };
  if (points.length === 1) {
    return {
      latitude: points[0].latitude!,
      longitude: points[0].longitude!,
      zoom: 15,
    };
  }

  for (let zoom = 18; zoom >= 2; zoom -= 1) {
    const projected = points.map((event) =>
      toWorld(event.latitude!, event.longitude!, zoom),
    );
    const xs = projected.map((point) => point.x);
    const ys = projected.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    if (maxX - minX <= Math.max(140, width - 150) && maxY - minY <= height - 130) {
      const center = fromWorld((minX + maxX) / 2, (minY + maxY) / 2, zoom);
      return { ...center, zoom };
    }
  }
  const latitude =
    points.reduce((sum, event) => sum + event.latitude!, 0) / points.length;
  const longitude =
    points.reduce((sum, event) => sum + event.longitude!, 0) / points.length;
  return { latitude, longitude, zoom: 2 };
}

function FieldMap({
  events,
  specimens,
  selectedEventId,
  onSelectEvent,
  onOpenEvent,
}: {
  events: CollectingEvent[];
  specimens: SpecimenRecord[];
  selectedEventId: string | null;
  onSelectEvent: (id: string | null) => void;
  onOpenEvent: (id: string) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    centerX: number;
    centerY: number;
  } | null>(null);
  const [size, setSize] = useState({ width: 900, height: 430 });
  const [view, setView] = useState(() => {
    const selected = events.find((event) => event.id === selectedEventId);
    if (selected?.latitude !== undefined && selected.longitude !== undefined) {
      return {
        latitude: selected.latitude,
        longitude: selected.longitude,
        zoom: 15,
      };
    }
    return fitMap(events, 900, 430);
  });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;
    const updateSize = () =>
      setSize({ width: element.clientWidth, height: element.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded]);

  const centerWorld = toWorld(view.latitude, view.longitude, view.zoom);
  const leftWorld = centerWorld.x - size.width / 2;
  const topWorld = centerWorld.y - size.height / 2;
  const tileCount = 2 ** view.zoom;
  const tiles: Array<{ key: string; x: number; y: number; url: string }> = [];
  const startTileX = Math.floor(leftWorld / TILE_SIZE);
  const endTileX = Math.floor((leftWorld + size.width) / TILE_SIZE);
  const startTileY = Math.max(0, Math.floor(topWorld / TILE_SIZE));
  const endTileY = Math.min(
    tileCount - 1,
    Math.floor((topWorld + size.height) / TILE_SIZE),
  );
  for (let tileX = startTileX; tileX <= endTileX; tileX += 1) {
    const wrappedX = ((tileX % tileCount) + tileCount) % tileCount;
    for (let tileY = startTileY; tileY <= endTileY; tileY += 1) {
      tiles.push({
        key: `${view.zoom}-${tileX}-${tileY}`,
        x: tileX * TILE_SIZE - leftWorld,
        y: tileY * TILE_SIZE - topWorld,
        url: `https://tile.openstreetmap.org/${view.zoom}/${wrappedX}/${tileY}.png`,
      });
    }
  }

  const points = events
    .map((event, index) => {
      if (event.latitude === undefined || event.longitude === undefined) return null;
      const world = toWorld(event.latitude, event.longitude, view.zoom);
      return {
        event,
        number: index + 1,
        x: world.x - leftWorld,
        y: world.y - topWorld,
      };
    })
    .filter(Boolean) as Array<{
      event: CollectingEvent;
      number: number;
      x: number;
      y: number;
    }>;
  const selectedPoint = points.find(
    (point) => point.event.id === selectedEventId,
  );
  const routePoints = points.map((point) => `${point.x},${point.y}`).join(" ");

  function changeZoom(amount: number) {
    setView((current) => ({
      ...current,
      zoom: Math.max(2, Math.min(18, current.zoom + amount)),
    }));
  }

  function beginDrag(event: React.PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button, a")) return;
    const center = toWorld(view.latitude, view.longitude, view.zoom);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      centerX: center.x,
      centerY: center.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function drag(event: React.PointerEvent<HTMLDivElement>) {
    const start = dragRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const next = fromWorld(
      start.centerX - (event.clientX - start.x),
      start.centerY - (event.clientY - start.y),
      view.zoom,
    );
    setView((current) => ({ ...current, ...next }));
  }

  function finishDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  return (
    <div
      className={`field-map ${expanded ? "is-expanded" : ""}`}
      ref={mapRef}
      onPointerDown={beginDrag}
      onPointerMove={drag}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      aria-label="Interactive map of collecting events"
    >
      <div className="map-tiles" aria-hidden="true">
        {tiles.map((tile) => (
          // Map tiles are already raster tiles and cannot use Next image optimization.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={tile.key}
            src={tile.url}
            alt=""
            draggable={false}
            style={{ left: tile.x, top: tile.y }}
            onError={(event) => {
              event.currentTarget.style.visibility = "hidden";
            }}
          />
        ))}
      </div>

      {routePoints && (
        <svg className="map-route" aria-hidden="true">
          <polyline points={routePoints} />
        </svg>
      )}

      <div className="map-markers">
        {points.map((point) => (
          <button
            key={point.event.id}
            className={`map-marker ${
              point.event.id === selectedEventId ? "is-selected" : ""
            }`}
            style={{ left: point.x, top: point.y }}
            onClick={() => onSelectEvent(point.event.id)}
            aria-label={`Point ${point.number}: ${point.event.locality}`}
          >
            <span>{point.number}</span>
          </button>
        ))}
      </div>

      {selectedPoint && (
        <div
          className="map-popup"
          style={{ left: selectedPoint.x, top: selectedPoint.y }}
        >
          <button
            className="map-popup-close"
            onClick={() => onSelectEvent(null)}
            aria-label="Close event preview"
          >
            ×
          </button>
          <p>{selectedPoint.event.id}</p>
          <strong>{selectedPoint.event.locality}</strong>
          <span>
            {selectedPoint.event.time || selectedPoint.event.date} ·{" "}
            {specimens
              .filter((record) => record.eventId === selectedPoint.event.id)
              .reduce((sum, record) => sum + record.quantity, 0)}{" "}
            individuals
          </span>
          <button onClick={() => onOpenEvent(selectedPoint.event.id)}>
            Open event <ArrowRight aria-hidden="true" />
          </button>
        </div>
      )}

      {!points.length && (
        <div className="map-empty-message">
          <MapPinned aria-hidden="true" />
          <strong>Your collecting points will appear here</strong>
          <span>Add GPS to an event to place it on the map.</span>
        </div>
      )}

      <div className="map-controls">
        <button onClick={() => changeZoom(1)} aria-label="Zoom in">+</button>
        <button onClick={() => changeZoom(-1)} aria-label="Zoom out">−</button>
        <button
          onClick={() => setView(fitMap(events, size.width, size.height))}
          aria-label="Fit all collecting points"
        >
          <LocateFixed aria-hidden="true" />
        </button>
        <button
          onClick={() => setExpanded((current) => !current)}
          aria-label={expanded ? "Exit full screen map" : "Expand map"}
        >
          {expanded ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
        </button>
      </div>

      <div className="map-attribution">
        ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap
        </a>
      </div>
    </div>
  );
}

function EventDetail({
  event,
  records,
  bulkCount,
  onBulkCount,
  backLabel,
  onBack,
  onEdit,
  onDelete,
  onAddSpecimen,
  onAddLot,
  onAddBulk,
  onSplitLot,
  onEditRecord,
  onDeleteRecord,
}: {
  event: CollectingEvent;
  records: SpecimenRecord[];
  bulkCount: number;
  onBulkCount: (value: number) => void;
  backLabel: string;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddSpecimen: () => void;
  onAddLot: () => void;
  onAddBulk: () => void;
  onSplitLot: (lot: SpecimenRecord) => void;
  onEditRecord: (record: SpecimenRecord) => void;
  onDeleteRecord: (record: SpecimenRecord) => void;
}) {
  return (
    <section>
      <button className="text-button" onClick={onBack}>
        <ArrowLeft aria-hidden="true" /> {backLabel}
      </button>
      <div className="detail-heading">
        <div>
          <p className="eyebrow">
            {event.isExample ? "Example collecting event" : "Collecting event"}
          </p>
          <h1>{event.id}</h1>
          <p className="detail-place">
            <MapPin aria-hidden="true" /> {event.locality}
          </p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button compact" onClick={onEdit}>
            Edit event
          </button>
          <button className="icon-button danger" onClick={onDelete}>
            <Trash2 aria-hidden="true" />
            <span className="sr-only">Delete event</span>
          </button>
        </div>
      </div>

      <div className="event-summary">
        <SummaryItem label="Date & time" value={`${event.date} ${event.time}`} />
        <SummaryItem label="Coordinates" value={formatCoordinates(event)} />
        <SummaryItem label="Collector" value={event.collector || "—"} />
        <SummaryItem label="Method" value={event.method || "—"} />
        <SummaryItem label="Habitat" value={event.habitat || "—"} />
        <SummaryItem label="Host" value={event.host || "—"} />
        <SummaryItem label="Weather" value={event.weather || "—"} />
        <SummaryItem
          label="Photos"
          value={`${event.photos.length} attached`}
        />
      </div>

      <div className="record-toolbar">
        <div>
          <p className="eyebrow">Collected material</p>
          <h2>Specimens and lots</h2>
        </div>
        <div className="record-actions">
          <button className="secondary-button compact" onClick={onAddLot}>
            <Package aria-hidden="true" /> Add lot
          </button>
          <button className="primary-button compact" onClick={onAddSpecimen}>
            <Plus aria-hidden="true" /> Add specimen
          </button>
        </div>
      </div>

      <div className="bulk-panel">
        <div>
          <strong>One event → many specimens</strong>
          <span>
            Create empty rows now; event place, date, method and collector are
            inherited automatically.
          </span>
        </div>
        <label>
          <span>Rows</span>
          <input
            type="number"
            min="1"
            max="200"
            value={bulkCount}
            onChange={(event) => onBulkCount(Number(event.target.value))}
          />
        </label>
        <button className="continue-button compact" onClick={onAddBulk}>
          Create rows
        </button>
      </div>

      {!records.length ? (
        <div className="small-empty">
          <Bug aria-hidden="true" />
          No specimens yet. Add one, add a lot, or create twenty rows at once.
        </div>
      ) : (
        <div className="record-list">
          {records.map((record) => (
            <article className="record-card" key={record.id}>
              <div className="record-icon">
                {record.recordType === "lot" ? <Package /> : <Bug />}
              </div>
              <div>
                <p className="record-id">{record.id}</p>
                <h3>{record.scientificName || "Identification pending"}</h3>
                <p>
                  {record.recordType === "lot"
                    ? `Lot · ${record.quantity} individuals`
                    : "Individual specimen"}
                  {record.lifeStage ? ` · ${record.lifeStage}` : ""}
                  {record.sex ? ` · ${record.sex}` : ""}
                </p>
              </div>
              <div className="record-card-actions">
                <button
                  className="text-button"
                  onClick={() => onEditRecord(record)}
                >
                  Edit
                </button>
                {record.recordType === "lot" && record.quantity > 1 && (
                  <button
                    className="text-button"
                    onClick={() => onSplitLot(record)}
                  >
                    Split lot
                  </button>
                )}
                <button
                  className="icon-button"
                  onClick={() => onDeleteRecord(record)}
                  aria-label={`Delete ${record.id}`}
                >
                  <Trash2 />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SpecimensView({
  specimens,
  events,
  onOpenEvent,
  onEdit,
  onDelete,
}: {
  specimens: SpecimenRecord[];
  events: CollectingEvent[];
  onOpenEvent: (id: string) => void;
  onEdit: (record: SpecimenRecord) => void;
  onDelete: (record: SpecimenRecord) => void;
}) {
  const eventMap = new Map(events.map((event) => [event.id, event]));
  return (
    <section>
      <div className="title-row">
        <div>
          <p className="eyebrow">All material</p>
          <h1>Specimens</h1>
        </div>
        <div className="large-count">{specimens.length} rows</div>
      </div>
      {!specimens.length ? (
        <div className="small-empty">
          <Bug /> Specimens appear here after they are added to an event.
        </div>
      ) : (
        <div className="record-list">
          {specimens.map((record) => {
            const event = eventMap.get(record.eventId);
            return (
              <article className="record-card" key={record.id}>
                <div className="record-icon">
                  {record.recordType === "lot" ? <Package /> : <Bug />}
                </div>
                <div>
                  <p className="record-id">{record.id}</p>
                  <h3>{record.scientificName || "Identification pending"}</h3>
                  <button
                    className="inline-link"
                    onClick={() => onOpenEvent(record.eventId)}
                  >
                    {event?.locality || record.eventId} · {event?.date}
                  </button>
                </div>
                <div className="record-card-actions">
                  <span className="quantity">
                    {record.recordType === "lot"
                      ? `${record.quantity} ind.`
                      : "1 specimen"}
                  </span>
                  <button className="text-button" onClick={() => onEdit(record)}>
                    Edit
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => onDelete(record)}
                    aria-label={`Delete ${record.id}`}
                  >
                    <Trash2 />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ExportView({
  eventCount,
  rowCount,
  includeExamples,
  onIncludeExamples,
  disabled,
  busy,
  onXlsx,
  onCsv,
  onDwc,
  onZip,
}: {
  eventCount: number;
  rowCount: number;
  includeExamples: boolean;
  onIncludeExamples: (value: boolean) => void;
  disabled: boolean;
  busy: boolean;
  onXlsx: () => void;
  onCsv: () => void;
  onDwc: () => void;
  onZip: () => void;
}) {
  return (
    <section>
      <div className="title-row">
        <div>
          <p className="eyebrow">Field → home</p>
          <h1>Export</h1>
        </div>
      </div>
      <div className="export-hero">
        <div>
          <p className="eyebrow">Ready for EntoLabel</p>
          <h2>
            {rowCount} rows from {eventCount} events
          </h2>
          <p>
            Each specimen row receives its event GPS, date, locality, collector,
            method, habitat, host and weather automatically.
          </p>
        </div>
        <FileSpreadsheet aria-hidden="true" />
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={includeExamples}
          onChange={(event) => onIncludeExamples(event.target.checked)}
        />
        Include the pink example event in exports
      </label>

      <div className="export-grid">
        <ExportCard
          title="EntoLabel Excel"
          description="Best default. Open it directly at home and map the familiar columns."
          button="Download .xlsx"
          recommended
          disabled={disabled}
          onClick={onXlsx}
        />
        <ExportCard
          title="EntoLabel CSV"
          description="Universal UTF-8 table for EntoLabel, Excel, R, or a database."
          button="Download .csv"
          disabled={disabled}
          onClick={onCsv}
        />
        <ExportCard
          title="Complete field package"
          description="Excel, CSV, optional Darwin Core, and every attached photograph in one ZIP."
          button={busy ? "Preparing…" : "Download .zip"}
          disabled={disabled || busy}
          onClick={onZip}
        />
        <ExportCard
          title="Darwin Core"
          description="Optional standards-oriented occurrence table for future exchange."
          button="Download DwC .csv"
          disabled={disabled}
          onClick={onDwc}
        />
      </div>
      {disabled && (
        <p className="form-hint">
          Add a specimen row, or temporarily include the example event, to test
          an export.
        </p>
      )}
    </section>
  );
}

function ExportCard({
  title,
  description,
  button,
  recommended,
  disabled,
  onClick,
}: {
  title: string;
  description: string;
  button: string;
  recommended?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <article className={`export-card ${recommended ? "recommended" : ""}`}>
      {recommended && <span className="recommend-label">Best for EntoLabel</span>}
      <h3>{title}</h3>
      <p>{description}</p>
      <button
        className={recommended ? "primary-button compact" : "secondary-button compact"}
        disabled={disabled}
        onClick={onClick}
      >
        <Download aria-hidden="true" /> {button}
      </button>
    </article>
  );
}

function SettingsView({
  preferences,
  hasExamples,
  installAvailable,
  onPreferences,
  onInstall,
  onBackup,
  onRemoveExamples,
  onErase,
}: {
  preferences: AppState["preferences"];
  hasExamples: boolean;
  installAvailable: boolean;
  onPreferences: (changes: Partial<AppState["preferences"]>) => void;
  onInstall: () => void;
  onBackup: () => void;
  onRemoveExamples: () => void;
  onErase: () => void;
}) {
  return (
    <section>
      <div className="title-row">
        <div>
          <p className="eyebrow">Your field kit</p>
          <h1>Settings</h1>
        </div>
      </div>
      <div className="settings-grid">
        <article className="settings-card">
          <p className="eyebrow">Defaults</p>
          <h2>Save typing in the field</h2>
          <label className="field">
            <span>Default collector</span>
            <input
              value={preferences.defaultCollector}
              onChange={(event) =>
                onPreferences({ defaultCollector: event.target.value })
              }
              placeholder="e.g. Anna Petrova"
            />
          </label>
          <label className="field">
            <span>ID prefix</span>
            <input
              value={preferences.idPrefix}
              maxLength={12}
              onChange={(event) =>
                onPreferences({ idPrefix: event.target.value.toUpperCase() })
              }
              placeholder="EF"
            />
          </label>
          <p className="form-hint">
            New event example: {preferences.idPrefix || "EF"}-20260730-001
          </p>
        </article>

        <article className="settings-card accent">
          <p className="eyebrow">Install</p>
          <h2>Put EntoField on your phone</h2>
          <p>
            It behaves like an app, but stays a free open-source website. No app
            store account is needed.
          </p>
          <button className="primary-button compact" onClick={onInstall}>
            <Upload aria-hidden="true" />
            {installAvailable ? "Install app" : "Show installation steps"}
          </button>
        </article>

        <article className="settings-card">
          <p className="eyebrow">Privacy & backup</p>
          <h2>Device-local by design</h2>
          <p>
            Events and photographs stay in this browser. Export after every field
            session and before clearing browser data or changing phones.
          </p>
          <p className="data-credits">
            Place names ©{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              OpenStreetMap contributors
            </a>
            . Weather estimates by{" "}
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo
            </a>
            .
          </p>
          <button className="secondary-button compact" onClick={onBackup}>
            <Download aria-hidden="true" /> Download JSON backup
          </button>
        </article>

        <article className="settings-card danger-zone">
          <p className="eyebrow">Clean up</p>
          <h2>Local data</h2>
          <div className="danger-actions">
            {hasExamples && (
              <button className="secondary-button compact" onClick={onRemoveExamples}>
                Remove example
              </button>
            )}
            <button className="danger-button" onClick={onErase}>
              <Trash2 aria-hidden="true" /> Delete everything
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}

function TripModal({
  draft,
  editing,
  onDraft,
  onSubmit,
  onClose,
}: {
  draft: TripDraft;
  editing: boolean;
  onDraft: React.Dispatch<React.SetStateAction<TripDraft>>;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
}) {
  const patch = (changes: Partial<TripDraft>) =>
    onDraft((current) => ({ ...current, ...changes }));
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal trip-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trip-modal-title"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">A group of collecting points</p>
            <h2 id="trip-modal-title">
              {editing ? "Edit field trip" : "New field trip"}
            </h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <label className="field span-2">
              <span>Trip name *</span>
              <input
                required
                autoFocus
                value={draft.name}
                onChange={(event) => patch({ name: event.target.value })}
                placeholder="e.g. Rigi BioBlitz"
              />
            </label>
            <label className="field">
              <span>Start date *</span>
              <input
                required
                type="date"
                value={draft.startDate}
                onChange={(event) =>
                  patch({
                    startDate: event.target.value,
                    endDate:
                      !draft.endDate || draft.endDate < event.target.value
                        ? event.target.value
                        : draft.endDate,
                  })
                }
              />
            </label>
            <label className="field">
              <span>End date</span>
              <input
                type="date"
                min={draft.startDate}
                value={draft.endDate}
                onChange={(event) => patch({ endDate: event.target.value })}
              />
            </label>
            <label className="field span-2">
              <span>Region / destination</span>
              <input
                value={draft.region}
                onChange={(event) => patch({ region: event.target.value })}
                placeholder="Rigi, Canton Schwyz"
              />
            </label>
            <label className="field span-2">
              <span>Participants / collectors</span>
              <input
                value={draft.participants}
                onChange={(event) => patch({ participants: event.target.value })}
                placeholder="Names of people on this field trip"
              />
            </label>
            <label className="field span-2">
              <span>Trip notes</span>
              <textarea
                rows={4}
                value={draft.notes}
                onChange={(event) => patch({ notes: event.target.value })}
                placeholder="Purpose, permits, meeting point, general conditions…"
              />
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button">
              <Check aria-hidden="true" />
              {editing ? "Save changes" : "Create field trip"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EventModal({
  draft,
  files,
  editing,
  photoBusy,
  onDraft,
  onFiles,
  onRemoveFile,
  onGps,
  onWeather,
  onSubmit,
  onClose,
}: {
  draft: EventDraft;
  files: File[];
  editing: boolean;
  photoBusy: boolean;
  onDraft: React.Dispatch<React.SetStateAction<EventDraft>>;
  onFiles: (files: FileList | null, extract?: boolean) => void;
  onRemoveFile: (index: number) => void;
  onGps: () => void;
  onWeather: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
}) {
  const patch = (changes: Partial<EventDraft>) =>
    onDraft((current) => ({ ...current, ...changes }));
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="event-modal-title">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Field record</p>
            <h2 id="event-modal-title">
              {editing ? "Edit collecting event" : "New collecting event"}
            </h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="quick-capture">
            <button type="button" onClick={onGps}>
              <Crosshair aria-hidden="true" />
              <strong>Use phone GPS</strong>
              <span>coordinates + accuracy</span>
            </button>
            <label>
              <Camera aria-hidden="true" />
              <strong>{photoBusy ? "Reading photo…" : "Create from photo"}</strong>
              <span>EXIF GPS + date/time</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                disabled={photoBusy}
                onChange={(event) => onFiles(event.target.files, true)}
              />
            </label>
            <button type="button" onClick={onWeather}>
              <CloudSun aria-hidden="true" />
              <strong>Add weather</strong>
              <span>free estimate, editable</span>
            </button>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Date *</span>
              <input
                required
                type="date"
                value={draft.date}
                onChange={(event) => patch({ date: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Time</span>
              <input
                type="time"
                value={draft.time}
                onChange={(event) => patch({ time: event.target.value })}
              />
            </label>
            <label className="field span-2">
              <span>Locality</span>
              <input
                value={draft.locality}
                onChange={(event) => patch({ locality: event.target.value })}
                placeholder="Nearest named place + field/site"
              />
            </label>
            <label className="field">
              <span>Country</span>
              <input
                value={draft.country}
                onChange={(event) => patch({ country: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Region / state</span>
              <input
                value={draft.region}
                onChange={(event) => patch({ region: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Latitude</span>
              <input
                inputMode="decimal"
                value={draft.latitude ?? ""}
                onChange={(event) =>
                  patch({
                    latitude: numberOrUndefined(event.target.value),
                    coordinateSource: "manual",
                  })
                }
                placeholder="47.24281"
              />
            </label>
            <label className="field">
              <span>Longitude</span>
              <input
                inputMode="decimal"
                value={draft.longitude ?? ""}
                onChange={(event) =>
                  patch({
                    longitude: numberOrUndefined(event.target.value),
                    coordinateSource: "manual",
                  })
                }
                placeholder="8.69214"
              />
            </label>
            <label className="field">
              <span>Uncertainty, m</span>
              <input
                inputMode="decimal"
                value={draft.uncertainty ?? ""}
                onChange={(event) =>
                  patch({ uncertainty: numberOrUndefined(event.target.value) })
                }
              />
            </label>
            <label className="field">
              <span>Altitude, m</span>
              <input
                inputMode="decimal"
                value={draft.altitude ?? ""}
                onChange={(event) =>
                  patch({ altitude: numberOrUndefined(event.target.value) })
                }
              />
            </label>
            <label className="field">
              <span>Collector *</span>
              <input
                required
                value={draft.collector}
                onChange={(event) => patch({ collector: event.target.value })}
                placeholder="Person(s) who collected"
              />
            </label>
            <label className="field">
              <span>Collecting method</span>
              <input
                list="methods"
                value={draft.method}
                onChange={(event) => patch({ method: event.target.value })}
                placeholder="sweep net"
              />
              <datalist id="methods">
                <option value="hand collecting" />
                <option value="sweep net" />
                <option value="beating sheet" />
                <option value="light trap" />
                <option value="Malaise trap" />
                <option value="pitfall trap" />
                <option value="rearing" />
              </datalist>
            </label>
            <label className="field span-2">
              <span>Habitat</span>
              <input
                value={draft.habitat}
                onChange={(event) => patch({ habitat: event.target.value })}
                placeholder="meadow edge, oak woodland, stream bank…"
              />
            </label>
            <label className="field span-2">
              <span>Host plant / substrate</span>
              <input
                value={draft.host}
                onChange={(event) => patch({ host: event.target.value })}
                placeholder="plant name, fungus, dung, under bark…"
              />
            </label>
            <label className="field span-2">
              <span>Weather</span>
              <input
                value={draft.weather}
                onChange={(event) => patch({ weather: event.target.value })}
                placeholder="22 °C, sunny, light wind"
              />
            </label>
            <label className="field span-2">
              <span>Notes</span>
              <textarea
                rows={3}
                value={draft.notes}
                onChange={(event) => patch({ notes: event.target.value })}
              />
            </label>
            <label className="field span-2 file-field">
              <span>More site photographs</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => onFiles(event.target.files)}
              />
            </label>
          </div>
          {files.length > 0 && (
            <div className="file-chips">
              {files.map((file, index) => (
                <span key={`${file.name}-${index}`}>
                  <ImageIcon aria-hidden="true" /> {file.name}
                  <button
                    type="button"
                    onClick={() => onRemoveFile(index)}
                    aria-label={`Remove ${file.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button">
              <Check aria-hidden="true" />
              {editing ? "Save changes" : "Create event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SpecimenModal({
  draft,
  files,
  eventId,
  editing,
  onDraft,
  onFiles,
  onSubmit,
  onClose,
}: {
  draft: SpecimenDraft;
  files: File[];
  eventId: string;
  editing: boolean;
  onDraft: React.Dispatch<React.SetStateAction<SpecimenDraft>>;
  onFiles: (files: FileList | null) => void;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
}) {
  const patch = (changes: Partial<SpecimenDraft>) =>
    onDraft((current) => ({ ...current, ...changes }));
  return (
    <div className="modal-backdrop">
      <div className="modal specimen-modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <p className="eyebrow">{eventId}</p>
            <h2>{editing ? `Edit ${draft.recordType}` : `Add ${draft.recordType}`}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="segmented-control">
            <button
              type="button"
              disabled={editing}
              className={draft.recordType === "specimen" ? "is-active" : ""}
              onClick={() => patch({ recordType: "specimen", quantity: 1 })}
            >
              <Bug /> Specimen
            </button>
            <button
              type="button"
              disabled={editing}
              className={draft.recordType === "lot" ? "is-active" : ""}
              onClick={() =>
                patch({ recordType: "lot", quantity: Math.max(2, draft.quantity) })
              }
            >
              <Package /> Lot / sample
            </button>
          </div>
          <div className="form-grid">
            {draft.recordType === "lot" && (
              <label className="field">
                <span>Quantity *</span>
                <input
                  required
                  type="number"
                  min="2"
                  value={draft.quantity}
                  onChange={(event) => patch({ quantity: Number(event.target.value) })}
                />
              </label>
            )}
            <label
              className={`field ${
                draft.recordType === "specimen" ? "span-2" : ""
              }`}
            >
              <span>Preliminary identification</span>
              <input
                value={draft.scientificName}
                onChange={(event) =>
                  patch({ scientificName: event.target.value })
                }
                placeholder="Bombus sp. or Coleoptera"
              />
            </label>
            <label className="field">
              <span>Sex</span>
              <select
                value={draft.sex}
                onChange={(event) => patch({ sex: event.target.value })}
              >
                <option value="">not recorded</option>
                <option value="female">female</option>
                <option value="male">male</option>
                <option value="unknown">unknown</option>
              </select>
            </label>
            <label className="field">
              <span>Life stage</span>
              <select
                value={draft.lifeStage}
                onChange={(event) => patch({ lifeStage: event.target.value })}
              >
                <option value="">not recorded</option>
                <option value="egg">egg</option>
                <option value="larva">larva</option>
                <option value="pupa">pupa</option>
                <option value="adult">adult</option>
              </select>
            </label>
            <label className="field span-2">
              <span>Identifier (determiner)</span>
              <input
                value={draft.identifier}
                onChange={(event) => patch({ identifier: event.target.value })}
              />
            </label>
            <label className="field span-2">
              <span>Specimen notes</span>
              <textarea
                rows={3}
                value={draft.notes}
                onChange={(event) => patch({ notes: event.target.value })}
              />
            </label>
            <label className="field span-2 file-field">
              <span>Specimen photographs</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={(event) => onFiles(event.target.files)}
              />
            </label>
          </div>
          {files.length > 0 && (
            <p className="form-hint">{files.length} photograph(s) ready to save.</p>
          )}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button">
              <Check /> {editing ? "Save changes" : `Save ${draft.recordType}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
