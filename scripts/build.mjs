import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const outputDirectory = new URL("../dist/", import.meta.url);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

await build({
  entryPoints: [fileURLToPath(new URL("../src/content/index.ts", import.meta.url))],
  bundle: true,
  outfile: fileURLToPath(new URL("content.js", outputDirectory)),
  format: "iife",
  platform: "browser",
  target: "chrome120",
  sourcemap: true,
  minify: false,
  legalComments: "none"
});

await Promise.all([
  cp(new URL("../manifest.json", import.meta.url), new URL("manifest.json", outputDirectory)),
  cp(
    new URL("../src/content/styles/calendar.css", import.meta.url),
    new URL("calendar.css", outputDirectory)
  )
]);

console.log("Built extension in dist/");
