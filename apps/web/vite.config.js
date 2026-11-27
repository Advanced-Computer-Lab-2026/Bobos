import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, posix, relative, resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Keep compatibility entry files and one actual Portal document in the build.
const portalPage = "portal-studio/index.html";
const htmlEntries = ["index.html", "workspace.html", "academic-services.html", portalPage];


function portalSite() {
  return {
    name: "portal-site",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === "/portal-services.js") req.url = "/src/portal-services.jsx";
        next();
      });
    },
    writeBundle({ dir }, bundle) {
      const out = resolve(dir);
      const extraPages = readdirSync(out, { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile() && /\.html?$/i.test(entry.name))
        .map(entry => relative(out, join(entry.parentPath, entry.name)).replaceAll("\\", "/"))
        .filter(path => !htmlEntries.includes(path));
      if (extraPages.length) this.error(`Only Portal and its compatibility entries may ship. Remove: ${extraPages.join(", ")}`);
      const service = Object.values(bundle).find((file) => file.type === "chunk" && file.name === "portal-services");
      if (!service) this.error("The Portal services bundle is missing.");
      const versioned = new Map();
      const fingerprint = (path) => {
        if (versioned.has(path)) return versioned.get(path);
        let contents = readFileSync(join(out, path));
        if (path === "portal-studio/app.js") {
          contents = contents.toString().replace("'/portal-services.js'", JSON.stringify("/" + service.fileName));
        }
        const hash = createHash("sha256").update(contents).digest("hex").slice(0, 12);
        const target = path.replace(/\.(js|css)$/, `.${hash}.$1`);
        writeFileSync(join(out, target), contents);
        versioned.set(path, target);
        return target;
      };
      for (const page of htmlEntries) {
        const file = join(out, page);
        const html = readFileSync(file, "utf8").replace(/(src|href)="([^"?]+\.(?:js|css))(?:\?[^"]*)?"/g, (original, attr, url) => {
          const path = url.startsWith("/") ? url.slice(1) : posix.join(posix.dirname(page), url);
          if (!path.startsWith("portal-studio/")) return original;
          return `${attr}="/${fingerprint(path)}"`;
        });
        writeFileSync(file, html);
      }
    },
  };
}

export default defineConfig(({ command, isPreview }) => ({
  plugins: [react(), portalSite()],
  // Concurrent dev servers must keep their optimized dependencies separate.
  ...(command === "serve" && !isPreview && { cacheDir: `node_modules/.vite/dev-${process.pid}` }),
  build: { rollupOptions: {
    preserveEntrySignatures: "exports-only",
    input: { index: "index.html", "academic-services": "academic-services.html", workspace: "workspace.html", "portal-services": "src/portal-services.jsx" },
  } },
  envDir: "../..",
  server: {
    strictPort: true,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
}));
