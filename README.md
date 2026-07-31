# EntoField

EntoField is a free, open-source, offline-first field notebook for collected
biological specimens. One collecting event can be inherited by a specimen, a
lot, or many specimen rows and exported directly to EntoLabel-compatible Excel
or CSV.

## Features

- device GPS with coordinate uncertainty;
- EXIF GPS and capture-time extraction from photographs;
- locality, weather, habitat, method, collector, host, and field notes;
- event and specimen photographs stored locally in IndexedDB;
- individual specimens, lots, bulk row creation, and lot splitting;
- EntoLabel XLSX with a clean import sheet, a Visual specimen catalog with
  photographs in each specimen row, and a complete Photos index;
- EntoLabel CSV, Darwin Core CSV, and a complete ZIP with full-resolution
  photographs;
- installable PWA with offline support and a field-screen installation reminder;
- no account, server database, or paid API required for the core workflow.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

The static application is written to `dist/`.

## Deploy to Cloudflare Pages

After authenticating Wrangler with your Cloudflare account:

```bash
npm run deploy
```

Or create a Direct Upload Pages project in the Cloudflare dashboard and upload
the contents of `dist/`.

## Privacy

Records and photographs stay in the browser on the device where they were
created. Export a complete ZIP after each field session and before clearing
browser data, moving to another device, or changing the application's domain.

Place names are provided by OpenStreetMap Nominatim under its usage policy and
ODbL attribution requirements. Weather estimates use Open-Meteo's free
non-commercial API. Replace or self-host these optional services before
high-volume or commercial deployment.

## License

MIT.
