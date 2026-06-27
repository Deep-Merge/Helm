import { defineConfig } from "vite";
import { resolve } from "path";
import { copyFileSync, mkdirSync, readdirSync, statSync } from "fs";

function copyDir(src: string, dest: string) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = resolve(src, entry);
    const destPath = resolve(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        "background/service-worker": resolve(__dirname, "src/background/service-worker.ts"),
        "content/project": resolve(__dirname, "src/content/project.ts"),
        "content/listing": resolve(__dirname, "src/content/listing.ts"),
        "popup/popup": resolve(__dirname, "src/popup/popup.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name].js",
        assetFileNames: "[name][extname]",
      },
    },
  },
  plugins: [
    {
      name: "copy-static",
      closeBundle() {
        copyDir(resolve(__dirname, "public"), resolve(__dirname, "dist"));
        copyFileSync(
          resolve(__dirname, "src/popup/popup.html"),
          resolve(__dirname, "dist/popup/popup.html")
        );
        copyFileSync(
          resolve(__dirname, "src/popup/popup.css"),
          resolve(__dirname, "dist/popup/popup.css")
        );
        copyFileSync(
          resolve(__dirname, "src/content/panel.css"),
          resolve(__dirname, "dist/content/panel.css")
        );
        copyFileSync(
          resolve(__dirname, "src/content/listing.css"),
          resolve(__dirname, "dist/content/listing.css")
        );
      },
    },
  ],
});
