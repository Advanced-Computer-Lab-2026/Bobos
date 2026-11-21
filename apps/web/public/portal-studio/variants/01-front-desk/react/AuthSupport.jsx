import { useState } from 'react';
import { passwordIssue } from './route-contract.mjs';
import './front-desk.css';
/** Route-keyed help: uses the existing AuthPage state and API handlers. */
export function AuthSupport({ mode }) {
  const reset = mode === 'reset', forgot = mode === 'forgot';
  return <aside data-front-desk-route={mode} className="fd-react-auth-help">
    <img src={`/portal-studio/variants/01-front-desk/assets/${reset ? 'lock' : forgot ? 'envelope' : 'door'}.svg`} alt="" />
    <div><strong>{reset ? 'Use the newest code' : forgot ? 'Your university email' : 'Your university account'}</strong>
    <p>{reset ? 'A code expires after 10 minutes. Requesting another replaces it. A successful reset signs out existing sessions.' : forgot ? 'We send a six-digit code to the email already on the account. Check your inbox and spam folder. There is a 60-second resend cooldown.' : 'Use your existing active GUC account. Student addresses end in @student.guc.edu.eg; staff addresses end in @guc.edu.eg. There is no sign-up.'}</p></div>
  </aside>;
}
export function PasswordField({ value, onChange, disabled, newPassword = false }) {
  const [shown, setShown] = useState(false);
  const label = newPassword ? 'New password' : 'Password';
  return <label className="field" data-front-desk-route={newPassword ? 'reset' : 'login'}><span>{label}</span>
    <span className="fd-react-password"><input type={shown ? 'text' : 'password'} autoComplete={newPassword ? 'new-password' : 'current-password'} required
      minLength={newPassword ? 8 : undefined} value={value} disabled={disabled}
      onChange={event => { if (newPassword) event.target.setCustomValidity(passwordIssue(event.target.value)); onChange(event); }} />
      <button className="text-button" type="button" disabled={disabled} aria-pressed={shown} aria-label={`${shown ? 'Hide' : 'Show'} ${label.toLowerCase()}`} onClick={() => setShown(v => !v)}>{shown ? 'Hide' : 'Show'}</button>
    </span>{newPassword && <small>At least 8 characters, no more than 72 UTF-8 bytes.</small>}
  </label>;
}
