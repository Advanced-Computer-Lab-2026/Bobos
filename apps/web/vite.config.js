import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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
      server.middlewares.use("/__bobos_local_demo", (req, res) => {
        if (req.method !== "GET" || !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress)) {
          res.writeHead(404).end();
          return;
        }
        const accounts = preset === "extra-hours" ? extraHoursDemo : standardDemo;
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

// Portal Studio is served from public/ as classic scripts. Give its production
// script and stylesheet URLs the same cache isolation Vite gives React chunks.
const studyPages = [
  "delete-options.html",
  "feedback-studies.html",
  "portal-studio/coming-up-notifications-study.html",
  "portal-studio/logo-study.html",
  "portal-studio/notification-study.html",
  "portal-studio/student-overview-study.html",
  "portal-studio/variants/01-front-desk/logos/comparison.html",
];

function portalSite() {
  return {
    name: "portal-site",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = new URL(req.url, "http://localhost").pathname;
        if (studyPages.includes(path.slice(1))) {
          res.writeHead(302, { Location: "/" }).end();
          return;
        }
        if (req.url === "/portal-services.js") req.url = "/src/portal-services.jsx";
        next();
      });
    },
    writeBundle({ dir }, bundle) {
      const out = resolve(dir);
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
      const shell = "portal-studio/index.html";
      for (const page of ["index.html", "workspace.html", "academic-services.html", shell]) {
        const file = join(out, page);
        const html = readFileSync(file, "utf8").replace(/(src|href)="([^"?]+\.(?:js|css))(?:\?[^"]*)?"/g, (original, attr, url) => {
          const path = url.startsWith("/") ? url.slice(1) : join(dirname(page), url);
          if (!path.startsWith("portal-studio/")) return original;
          return `${attr}="/${fingerprint(path)}"`;
        });
        writeFileSync(file, html);
      }
      // Keep old study bookmarks from opening a second interface.
      const redirect = readFileSync(join(out, "index.html"));
      for (const page of studyPages) writeFileSync(join(out, page), redirect);
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
