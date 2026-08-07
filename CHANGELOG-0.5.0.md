# EntoField 0.5.0

- Added **Make event from my location** for one-tap field recording.
- One-tap events capture the button-press date/time, device GPS, uncertainty,
  altitude when available, reverse-geocoded locality, and current weather.
- Location naming and weather are fetched in parallel; a GPS event is still
  saved if either network service is unavailable.
- Collector is now optional.
- Previously used collectors are suggested from a dropdown while still allowing
  new names to be entered.
- Updated the PWA cache version so installed copies receive the new build.
