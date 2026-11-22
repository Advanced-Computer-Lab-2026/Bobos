import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

import { ThemeControl } from "./PortalChrome.jsx";

const standardDemoAccounts = [
  ["Administrator", "admin@guc.edu.eg"],
  ["Coordinator", "nadia.coordinator@guc.edu.eg"],
  ["Advisor", "sherif.advisor@guc.edu.eg"],
  ["Normal student", "karim.normal@student.guc.edu.eg"],
  ["Advising student", "layla.advising@student.guc.edu.eg"],
].map(([label, email]) => ({ label, email, password: "Password123!" }));

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [demoAccounts, setDemoAccounts] = useState(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const controller = new AbortController();
    fetch("./__bobos_local_demo", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return standardDemoAccounts;
        return (await response.json()).accounts || standardDemoAccounts;
      })
      .then((accounts) => { if (!controller.signal.aborted) setDemoAccounts(accounts); })
      .catch(() => { if (!controller.signal.aborted) setDemoAccounts(standardDemoAccounts); });
    return () => controller.abort();
  }, []);

  const lampHost = useRef(null);
  useEffect(() => {
    if (mode !== "login") return;
    const scene = document.createElement("div");
    scene.className = "desk-lamp-scene";
    const image = document.createElement("img");
    image.src = "/portal-studio/images/borrowed-light.svg";
    image.alt = "Reading lamp overlooking the teaching week";
    scene.append(image);
    lampHost.current.append(scene);
    window.mountDeskLamp(scene);
    return () => scene.remove();
  }, [mode]);

  const submitLogin = async (event) => {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await api("/api/identity/login", { method: "POST", body: { email, password } });
      onLogin(result.token);
    } catch (requestError) {
      setError(requestError.message);
    } finally { setBusy(false); }
  };

  const requestOtp = async (event) => {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await api("/api/identity/forgot-password", { method: "POST", body: { email } });
      setMessage(result.message || "If the account exists, a reset code has been sent to its email address.");
      setMode("reset");
    } catch (requestError) {
      setError(requestError.message);
    } finally { setBusy(false); }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await api("/api/identity/reset-password", { method: "POST", body: { email, otp, newPassword } });
      setMessage(result.message || "Password updated. Sign in with your new password.");
      setPassword(""); setNewPassword(""); setOtp(""); setMode("login");
    } catch (requestError) {
      setError(requestError.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="portal-studio live-preview portal-signin"><main className="auth">
      
      <section className="signin-copy">
        <header><span className="wordmark"><img className="portal-brand-mark" src="/portal-studio/portal-card-index.svg" alt="" />Portal</span></header>
        <div className="auth-card">

          <h1>{mode === "login" ? "Sign in" : mode === "forgot" ? "Reset your password" : "Enter your reset code"}</h1>
          {mode !== "login" && <p className="auth-subtitle">{mode === "forgot" ? "We’ll email a one-time code to your GUC address." : "Enter the six-digit code from your email and choose a new password."}</p>}

          {error && <div className="feedback error" role="alert">{error}</div>}
          {message && <div className="feedback success" role="status">{message}</div>}

          {mode === "login" && <form id="auth-form" className="form-stack" onSubmit={submitLogin}>
            <label className="field"><span>University email</span><input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@student.guc.edu.eg" /></label>
            <label className="field"><span>Password</span><input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" /></label>
            <div className="signin-actions"><button type="submit" className="signin-continue" disabled={busy}>{busy ? "Signing in…" : "Continue"}<span>→</span></button>
            <button className="text-button centered" type="button" onClick={() => { setMode("forgot"); setError(""); setMessage(""); }}>Forgot password?</button></div>
          </form>}

          {mode === "forgot" && <form className="form-stack" onSubmit={requestOtp}>
            <label className="field"><span>University email</span><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@student.guc.edu.eg" /></label>
            <button className="primary-button full-button" disabled={busy}>{busy ? "Sending…" : "Send reset code"}<span>→</span></button>
            <button className="text-button centered" type="button" onClick={() => { setMode("login"); setError(""); setMessage(""); }}>Back to sign in</button>
          </form>}

          {mode === "reset" && <form className="form-stack" onSubmit={resetPassword}>
            <label className="field"><span>University email</span><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label className="field"><span>Six-digit code</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} placeholder="000000" /></label>
            <label className="field"><span>New password</span><input type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 8 characters" /></label>
            <button className="primary-button full-button" disabled={busy}>{busy ? "Updating…" : "Update password"}<span>→</span></button>
            <button className="text-button centered" type="button" onClick={() => { setMode("forgot"); setError(""); setMessage(""); }}>Send another code</button>
            <button className="outline-button full-button" type="button" onClick={() => { setMode("login"); setError(""); setMessage(""); setOtp(""); setNewPassword(""); }}>Back to sign in</button>
          </form>}
          {import.meta.env.DEV && mode === "login" && (
            <details className="portal-demo">
              <summary>Local demo accounts</summary>
              <div className="portal-demo-accounts">
                {demoAccounts === null && <p role="status">Loading demo accounts…</p>}
                {demoAccounts?.map(({ label, email: account, password: demoPassword }) => (
                  <button key={account} className="outline-button" type="button" disabled={busy}
                    onClick={() => { setEmail(account); setPassword(demoPassword); setError(""); }}>
                    {label}
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>
      </section>
      <figure className="signin-print" ref={lampHost} />
      <aside className="portal-auth-tools"><ThemeControl /></aside>
    </main></div>
  );
}
