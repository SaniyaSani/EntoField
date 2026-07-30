# Cloudflare Pages deployment

The production-ready files are in `dist/`.

## Dashboard upload

1. Open the Cloudflare dashboard.
2. Open **Workers & Pages**.
3. Select **Create application**.
4. Choose **Pages** and **Drag and drop your files**.
5. Use `entofield` as the project name.
6. Upload the contents of the `dist` directory.
7. Select **Deploy site**.

The public application will be available at an address such as
`https://entofield.pages.dev`.

## Later updates

After authenticating Wrangler:

```bash
npm install
npm run deploy
```

Do not change the public domain after collecting real data without exporting a
complete ZIP first. Browser-local records belong to the exact domain where they
were created.
