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

export default defineConfig({
  plugins: [react(), localPortalDemo()],
  build: { rollupOptions: { input: ["index.html", "workspace.html"] } },
  envDir: "../..",
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
