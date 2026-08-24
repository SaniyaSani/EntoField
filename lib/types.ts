export type PhotoMeta = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  capturedAt?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
};

export type FieldTrip = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  region: string;
  participants: string;
  notes: string;
  createdAt: string;
  isExample?: boolean;
};

export type CollectingEvent = {
  id: string;
  tripId?: string;
  name: string;
  date: string;
  time: string;
  country: string;
  region: string;
  locality: string;
  latitude?: number;
  longitude?: number;
  uncertainty?: number;
  altitude?: number;
  coordinateSource: "device GPS" | "photo EXIF" | "manual" | "";
  collector: string;
  method: string;
  habitat: string;
  host: string;
  weather: string;
  notes: string;
  photos: PhotoMeta[];
  createdAt: string;
  isExample?: boolean;
};

export type SpecimenRecord = {
  id: string;
  eventId: string;
  recordType: "specimen" | "lot";
  quantity: number;
  scientificName: string;
  identifier: string;
  sex: string;
  lifeStage: string;
  notes: string;
  photos: PhotoMeta[];
  createdAt: string;
  isExample?: boolean;
};

export type Preferences = {
  defaultCollector: string;
  recentCollectors: string[];
  idPrefix: string;
};

export type AppState = {
  schemaVersion: 3;
  trips: FieldTrip[];
  events: CollectingEvent[];
  specimens: SpecimenRecord[];
  preferences: Preferences;
};

export type StoredPhoto = {
  meta: PhotoMeta;
  blob: Blob;
};
