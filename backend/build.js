import esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function build() {
  console.log("⚡ Building backend for production with esbuild...");
  try {
    await Promise.all([
      // 1. Bundle server.ts into dist/server.js
      esbuild.build({
        entryPoints: [path.resolve(__dirname, "src/server.ts")],
        bundle: true,
        platform: "node",
        format: "esm",
        target: "node20",
        outfile: path.resolve(__dirname, "dist/server.js"),
        packages: "external",
        sourcemap: true,
      }),
      // 2. Bundle categoryWorker.ts into dist/workers/categoryWorker.js
      esbuild.build({
        entryPoints: [path.resolve(__dirname, "src/workers/categoryWorker.ts")],
        bundle: true,
        platform: "node",
        format: "esm",
        target: "node20",
        outfile: path.resolve(__dirname, "dist/workers/categoryWorker.js"),
        packages: "external",
        sourcemap: true,
      }),
    ]);
    console.log("✅ Build finished successfully! Output written to dist/");
  } catch (err) {
    console.error("❌ Build failed:", err);
    process.exit(1);
  }
}

build();
