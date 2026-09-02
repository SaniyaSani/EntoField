# EntoField

EntoField is a free, open-source field notebook for **collected biological
specimens**. It is designed to bridge the gap between a field note, a vial,
photographs, a spreadsheet, and a final printed label. EntoLabel's core label
workflow is now built directly into the phone-friendly PWA.

It is intentionally not an iNaturalist competitor. The core object is a
**collecting event** that can be inherited by one specimen, a lot, or many
specimen rows.

## What the prototype does

- creates collecting events with an optional human-readable event name, date/time,
  locality, GPS, uncertainty, altitude, optional collector, method, habitat,
  host/substrate, weather, notes, and photographs;
- remembers up to 8 recently used collectors locally for one-tap reuse;
- requests high-accuracy phone GPS automatically when a new event opens;
- reads capture time and GPS from a photograph's EXIF metadata when available;
- keeps the event GPS, or requests the current phone position, when iOS provides
  a new photograph without location metadata;
- optionally resolves coordinates to a place name through OpenStreetMap
  Nominatim;
- optionally adds editable current-weather estimates from Open-Meteo;
- creates one specimen, a multi-individual lot, or up to 200 specimen rows at
  once;
- splits a lot into individually numbered specimen rows;
- creates fast collection/locality labels directly from a collecting event,
  even before specimens have been entered;
- creates one collection label per recorded specimen or lot, with the record ID;
- combines labels from selected collecting events in a field trip into one
  continuously filled PDF, with an adjustable copy count for every event;
- prints collection-label coordinates as WGS84 latitude/longitude, modern Swiss
  LV95, or legacy Swiss LV03 while retaining WGS84 in the stored event data;
- keeps determination labels behind a separate action and includes only records
  that already have a scientific name;
- previews compact labels and downloads a print-ready A4 PDF entirely on-device;
- stores event/specimen data and photographs locally in browser IndexedDB;
- works after installation as a Progressive Web App (PWA);
- exports EntoLabel-ready `.xlsx` and UTF-8 `.csv` tables;
- exports optional Darwin Core CSV;
- exports one ZIP containing both tables and all photographs.

## Privacy and cost

The core app requires no account, database, paid API, or subscription. Records
and photographs stay on the device where they were created.

The optional place-name and weather lookups need an internet connection. GPS,
manual data entry, local storage, specimens, lots, label previews, and PDF
generation do not after the PWA and its embedded fonts have been cached.

Place names are provided by the public OpenStreetMap Nominatim service under
its usage policy and ODbL attribution requirements. Requests are user-triggered,
rate-limited in the client, and their result is stored with the event. Weather
estimates use Open-Meteo's free non-commercial API and display attribution in
the app. Replace or self-host these optional services before high-volume or
commercial deployment.

Browser storage is not a permanent archival system. Export a ZIP after each
field session and before clearing browser data or changing phones.

## Run locally

Requirements:

- Node.js 22.13 or newer
- npm

```bash
npm install
npm run dev
```

Open the local address printed by Vite.

Production validation:

```bash
npm run build
npm test
```

## EntoLabel table

The ordinary EntoLabel export contains familiar columns including:

- `Specimen ID`
- `Event ID`
- `Country`, `Region`, `Locality`
- `Latitude`, `Longitude`, `Coordinate uncertainty (m)`, `Altitude`
- `Collection date`, `Collection time`
- `Collector`, `Collecting method`, `Habitat`, `Host`, `Weather`
- `Record type`, `Quantity`
- `Scientific name`, `Genus`, `Species`, `Subspecies`
- `Sex`, `Life stage`, `Identifier`, `Notes`
- `Photo filenames`

EntoLabel can map these ordinary spreadsheet columns during import. Darwin Core
is a separate optional export and is not required for the basic EntoField →
EntoLabel workflow.

## Source map

- `app/page.tsx` — application screens and field workflow
- `app/globals.css` — responsive Field Rose visual system
- `lib/entofield-db.ts` — device-local IndexedDB persistence
- `lib/exports.ts` — Excel, CSV, Darwin Core, and ZIP exports
- `lib/labels.ts` — collection/determination label data and formatting
- `lib/labels-pdf.ts` — lazy-loaded offline A4 PDF layout and Unicode fonts
- `lib/types.ts` — event, specimen, and photo data model
- `public/sw.js` — offline service worker
- `public/manifest.webmanifest` — installable PWA manifest

## Browser support

Use a current version of Safari on iPhone or Chrome on Android. Device location
and PWA installation require HTTPS outside local development. If location was
previously denied, allow it in the website's settings and tap **Try GPS again**;
a website cannot override a phone-level denial.

Some messaging apps remove EXIF metadata when sending photographs. For the most
reliable automatic location and time extraction, take the photograph inside
EntoField or select the original camera file. When a selected photo has no EXIF
GPS, EntoField labels the fallback clearly: current phone GPS is appropriate for
a photo taken at the current site, not as the assumed location of an older photo.

## Open-source license

MIT. Contributions, field tests, translations, and EntoLabel compatibility
reports are welcome.
