import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const outputDirectory = new URL("../dist/", import.meta.url);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

await build({
  entryPoints: {
    content: fileURLToPath(new URL("../src/content/index.ts", import.meta.url)),
    background: fileURLToPath(new URL("../src/background/index.ts", import.meta.url)),
    popup: fileURLToPath(new URL("../src/popup/index.ts", import.meta.url))
  },
  bundle: true,
  outdir: fileURLToPath(outputDirectory),
  format: "iife",
  platform: "browser",
  target: "chrome120",
  sourcemap: true,
  minify: false,
  legalComments: "none"
});

const manifest = JSON.parse(
  await readFile(new URL("../manifest.json", import.meta.url), "utf8")
);
const oauthClientId = process.env.GPILOT_GOOGLE_OAUTH_CLIENT_ID?.trim();
if (oauthClientId) {
  manifest.oauth2.client_id = oauthClientId;
}

await Promise.all([
  writeFile(
    new URL("manifest.json", outputDirectory),
    `${JSON.stringify(manifest, null, 2)}\n`
  ),
  cp(
    new URL("../src/content/styles/calendar.css", import.meta.url),
    new URL("calendar.css", outputDirectory)
  ),
  cp(
    new URL("../src/popup/popup.html", import.meta.url),
    new URL("popup.html", outputDirectory)
  ),
  cp(
    new URL("../src/popup/popup.css", import.meta.url),
    new URL("popup.css", outputDirectory)
  )
]);

console.log("Built extension in dist/");
