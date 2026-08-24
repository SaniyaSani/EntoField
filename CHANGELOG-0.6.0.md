# EntoField 0.6.0 — event names and collector history

## Added
- Optional human-readable **Event name** for collecting events.
- Event names are shown in trip event cards, map previews, event details and specimen links.
- Event names are included in EntoLabel exports and Darwin Core `eventRemarks`.
- **Collector is now optional** in the event form.
- Up to 8 recently used collectors are remembered locally and shown as one-tap quick picks.
- The collector field also supports browser datalist suggestions from recent collectors.

## Compatibility
- Existing saved events are migrated in memory with an empty `name` field.
- Existing non-example collector names seed the recent-collector list automatically.
- Existing stable event IDs (`EF-...`) are unchanged and remain the key for specimens and exports.
- IndexedDB structure is unchanged; only the stored app-state schema moves from version 2 to version 3.

## Unchanged
- GPS permission/capture logic, photo EXIF handling, field-trip grouping and specimen IDs are left intact.
