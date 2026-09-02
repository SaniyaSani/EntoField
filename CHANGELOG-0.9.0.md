# EntoField 0.9.0 - Swiss Coordinate Labels

## Coordinate systems

- Added a coordinate-system selector to both single-event and whole-field-trip
  collection label settings.
- Collection labels can use WGS84 latitude/longitude, modern Swiss LV95, or
  legacy Swiss LV03 coordinates.
- WGS84 remains the default, so existing label output does not change unless a
  Swiss grid is selected.
- Conversion is performed locally during label preview and PDF generation; the
  original event coordinates remain stored as WGS84.

## Compatibility

- Single-event labels, combined field-trip PDFs, and separate determination
  labels continue to work as before.
- No data migration or internet connection is required.
