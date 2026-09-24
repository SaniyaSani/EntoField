export type PlaceFields = {
  locality: string;
  region: string;
  country: string;
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstText(...values: unknown[]): string {
  return values.map(text).find(Boolean) ?? "";
}

function normalized(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function distinct(parts: string[]): string[] {
  const seen = new Set<string>();
  return parts.filter((part) => {
    if (!part) return false;
    const key = normalized(part);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function placeFieldsFromNominatim(payload: unknown): PlaceFields {
  const data = record(payload);
  const address = record(data.address);
  const settlement = firstText(
    address.village,
    address.town,
    address.city,
    address.municipality,
    address.hamlet,
    address.isolated_dwelling,
  );
  const site = [
    data.name,
    address.nature_reserve,
    address.park,
    address.university,
    address.amenity,
    address.tourism,
    address.suburb,
    address.borough,
    address.quarter,
    address.neighbourhood,
    address.locality,
    address.road,
  ]
    .map(text)
    .find((candidate) => candidate && normalized(candidate) !== normalized(settlement));
  const displayFallback = text(data.display_name)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");

  return {
    locality: distinct([settlement, site ?? ""]).join(", ") || displayFallback,
    region: firstText(address.state, address.county, address.state_district),
    country: text(address.country),
  };
}

export function clearPreviousAutomaticPlace(
  current: PlaceFields,
  previousAutomatic: PlaceFields | null,
): PlaceFields {
  if (!previousAutomatic) return current;
  return {
    locality:
      current.locality === previousAutomatic.locality ? "" : current.locality,
    region: current.region === previousAutomatic.region ? "" : current.region,
    country: current.country === previousAutomatic.country ? "" : current.country,
  };
}

export function mergeAutomaticPlace(
  current: PlaceFields,
  resolved: PlaceFields,
  previousAutomatic: PlaceFields | null,
): PlaceFields {
  const mayReplace = (field: keyof PlaceFields) =>
    !current[field] || current[field] === previousAutomatic?.[field];
  return {
    locality: mayReplace("locality")
      ? resolved.locality || current.locality
      : current.locality,
    region: mayReplace("region")
      ? resolved.region || current.region
      : current.region,
    country: mayReplace("country")
      ? resolved.country || current.country
      : current.country,
  };
}
