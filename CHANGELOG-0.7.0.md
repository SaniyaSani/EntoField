# EntoField 0.7.0 — Integrated Labels

## Collection labels are now the fast default

- Added a prominent **Collection labels** action inside every collecting event.
- Added **Quick copies** for printing repeated locality labels before specimens
  have been entered.
- Added **Recorded material** for one collection label per specimen or lot.
- A lot produces one label for its container, independent of individual count.
- Event, specimen, or lot IDs can be included or omitted.

## Determination stays separate

- Added a distinct secondary **Determination labels** action.
- Only records with a scientific name are included.
- Specimen ID, italic scientific name, determiner, and an optional year are
  formatted independently from the collection-label workflow.

## On-device PDF workflow

- Added a responsive label preview and compact settings panel.
- Added A4 PDF generation with cutting borders, configurable dimensions, name
  shortening, coordinate display, and three date formats.
- Added automatic font fitting with overflow reporting.
- Embedded Unicode-capable fonts for Swiss, Croatian, and other locality names.
- PDF code is lazy-loaded so normal field entry stays lightweight.
- Fonts are cached by the service worker for offline label creation.

## Compatibility

- Existing EntoLabel Excel/CSV and Darwin Core exports remain unchanged.
- Existing local EntoField data remains compatible; no schema migration is
  required for this release.
