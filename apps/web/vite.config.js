import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, posix, relative, resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const standardDemo = {
  administrator: "admin@guc.edu.eg",
  coordinator: "nadia.coordinator@guc.edu.eg",
  advisor: "sherif.advisor@guc.edu.eg",
  advisingStudent: "layla.advising@student.guc.edu.eg",
  normalStudent: "karim.normal@student.guc.edu.eg",
};
const extraHoursDemo = {
  coordinator: "extra.coordinator@guc.edu.eg",
  advisor: "extra.advisor@guc.edu.eg",
  advisingStudent: "extra.create@student.guc.edu.eg",
  wallet: "extra.wallet@student.guc.edu.eg",
  gateway: "extra.gateway@student.guc.edu.eg",
  defer: "extra.defer@student.guc.edu.eg",
  reject: "extra.reject@student.guc.edu.eg",
  withdraw: "extra.withdraw@student.guc.edu.eg",
  blank: "extra.blank@student.guc.edu.eg",
  probation: "extra.probation@student.guc.edu.eg",
  graduate: "extra.graduate@student.guc.edu.eg",
  activation: "extra.activation@student.guc.edu.eg",
  retry: "extra.retry@student.guc.edu.eg",
  retryManual: "extra.retrymanual@student.guc.edu.eg",
  refund: "extra.refund@student.guc.edu.eg",
};
const demoLabels = {
  administrator: "Administrator", coordinator: "Coordinator", advisor: "Advisor",
  normalStudent: "Normal student", advisingStudent: "Advising student", wallet: "Wallet student",
  gateway: "Gateway student", defer: "Deferral student", reject: "Rejection student",
  withdraw: "Withdrawal student", blank: "Blank-note student", probation: "Probation student",
  graduate: "Graduation-limit student",
  activation: "Course activation student",
  retry: "Gateway retry student",
  retryManual: "Gateway retry student (manual test)",
  refund: "Refund history student",
};

function localPortalDemo() {
  return {
    name: "local-portal-demo",
    configureServer(server) {
      const preset = process.env.BOBOS_PORTAL_DEMO;
      if (preset !== "standard" && preset !== "extra-hours") return;
      const accounts = preset === "extra-hours" ? extraHoursDemo : standardDemo;
      const localRequest = req => req.method === "GET"
        && ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress)
        && /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(req.headers.host || "");
      server.middlewares.use((req, res, next) => {
        if (!localRequest(req) || req.url?.split("?", 1)[0] !== `/${portalPage}`) return next();
        const html = readFileSync(join(server.config.publicDir, portalPage), "utf8")
          .replace('<html lang="en">', `<html lang="en" data-local-demo-roles="${Object.keys(accounts).join(" ")}">`);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }).end(html);
      });
      server.middlewares.use("/__bobos_local_demo", (req, res) => {
        if (!localRequest(req)) {
          res.writeHead(404).end();
          return;
        }
        const role = new URL(req.url, "http://localhost").searchParams.get("role");
        if (role !== null && !Object.hasOwn(accounts, role)) {
          res.writeHead(404).end();
          return;
        }
        const password = preset === "extra-hours" ? "ExtraHoursDemo123!" : "Password123!";
        const data = role === null
          ? { accounts: Object.entries(accounts).map(([key, email]) => ({ label: demoLabels[key], email, password })) }
          : { email: accounts[role], password };
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" })
          .end(JSON.stringify(data));
      });
    },
  };
}

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
  plugins: [react(), localPortalDemo(), portalSite()],
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
