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

export type CollectingEvent = {
  id: string;
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
  idPrefix: string;
};

export type AppState = {
  schemaVersion: 1;
  events: CollectingEvent[];
  specimens: SpecimenRecord[];
  preferences: Preferences;
};

export type StoredPhoto = {
  meta: PhotoMeta;
  blob: Blob;
};
