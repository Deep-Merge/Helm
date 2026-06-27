import { build } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { cpSync, mkdirSync, rmSync, copyFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const dist = resolve(root, "dist");

const bundles = [
  { entry: "src/content/project.ts", outDir: "content", fileName: "project.js" },
  { entry: "src/content/listing.ts", outDir: "content", fileName: "listing.js" },
  { entry: "src/popup/popup.ts", outDir: "popup", fileName: "popup.js" },
  { entry: "src/background/service-worker.ts", outDir: "background", fileName: "service-worker.js" },
];

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

async function buildAll() {
for (const { entry, outDir, fileName } of bundles) {
  await build({
    configFile: false,
    build: {
      outDir: resolve(dist, outDir),
      emptyOutDir: false,
      rollupOptions: {
        input: resolve(root, entry),
        output: {
          format: "iife",
          entryFileNames: fileName,
          inlineDynamicImports: true,
        },
      },
      minify: true,
    },
  });
}

cpSync(resolve(root, "public"), dist, { recursive: true });
copyFileSync(resolve(root, "src/popup/popup.html"), resolve(dist, "popup/popup.html"));
copyFileSync(resolve(root, "src/popup/popup.css"), resolve(dist, "popup/popup.css"));
copyFileSync(resolve(root, "src/content/panel.css"), resolve(dist, "content/panel.css"));
copyFileSync(resolve(root, "src/content/listing.css"), resolve(dist, "content/listing.css"));
}

await buildAll();

console.log("Extension built — standalone bundles (no import chunks)");

if (process.argv.includes("--watch")) {
  const { watch } = await import("fs");
  let building = false;
  watch(resolve(root, "src"), { recursive: true }, async () => {
    if (building) return;
    building = true;
    try {
      await buildAll();
      console.log("Extension rebuilt");
    } catch (err) {
      console.error(err);
    } finally {
      building = false;
    }
  });
  console.log("Watching src/ for changes…");
}
