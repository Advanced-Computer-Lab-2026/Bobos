import { useState } from "react";
import { api } from "../api.js";

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
    <main className="auth-layout">
      <section className="auth-aside">
        <div className="brand brand-light"><span className="brand-mark">B</span><span>bobos<span className="brand-dot">.</span><small>UNIVERSITY SCHEDULING</small></span></div>
        <div className="auth-message"><p className="eyebrow light-eyebrow">YOUR ACADEMIC WORKSPACE</p><h1>Plan your semester with clarity.</h1><p>One place for your courses, academic records, and advising journey.</p><div className="auth-art" aria-hidden="true"><span className="art-ring ring-one" /><span className="art-ring ring-two" /><span className="art-card"><i /><i /><i /><i /></span><span className="art-check">✓</span></div></div>
        <p className="auth-footer">German University in Cairo · Academic portal</p>
      </section>

      <section className="auth-main">
        <div className="auth-card">
          <span className="mobile-brand"><span className="brand-mark">B</span> bobos<span className="brand-dot">.</span></span>
          <p className="eyebrow">WELCOME TO BOBOS</p>
          <h2>{mode === "login" ? "Sign in to your account" : mode === "forgot" ? "Reset your password" : "Enter your reset code"}</h2>
          <p className="auth-subtitle">{mode === "login" ? "Use your GUC account to continue." : mode === "forgot" ? "We’ll email a one-time code to your GUC address." : "Enter the six-digit code from your email and choose a new password."}</p>

          {error && <div className="feedback error" role="alert">{error}</div>}
          {message && <div className="feedback success" role="status">{message}</div>}

          {mode === "login" && <form className="form-stack" onSubmit={submitLogin}>
            <label className="field"><span>GUC email</span><input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@student.guc.edu.eg" /></label>
            <label className="field"><span>Password</span><input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" /></label>
            <button className="primary-button full-button" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<span>→</span></button>
            <button className="text-button centered" type="button" onClick={() => { setMode("forgot"); setError(""); setMessage(""); }}>Forgot password?</button>
          </form>}

          {mode === "forgot" && <form className="form-stack" onSubmit={requestOtp}>
            <label className="field"><span>GUC email</span><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@student.guc.edu.eg" /></label>
            <button className="primary-button full-button" disabled={busy}>{busy ? "Sending…" : "Send reset code"}<span>→</span></button>
            <button className="text-button centered" type="button" onClick={() => { setMode("login"); setError(""); setMessage(""); }}>Back to sign in</button>
          </form>}

          {mode === "reset" && <form className="form-stack" onSubmit={resetPassword}>
            <label className="field"><span>GUC email</span><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label className="field"><span>Six-digit code</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} placeholder="000000" /></label>
            <label className="field"><span>New password</span><input type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 8 characters" /></label>
            <button className="primary-button full-button" disabled={busy}>{busy ? "Updating…" : "Update password"}<span>→</span></button>
            <button className="text-button centered" type="button" onClick={() => { setMode("forgot"); setError(""); setMessage(""); }}>Send another code</button>
          </form>}
          <div className="auth-note"><span>🔒</span> Secure access for the GUC community</div>
        </div>
      </section>
    </main>
  );
}
