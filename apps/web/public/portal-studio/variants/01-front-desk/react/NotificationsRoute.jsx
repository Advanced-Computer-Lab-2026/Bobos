import { useCallback, useEffect, useRef, useState } from 'react';
import { api, explainApiError } from '../../api.js';
import { emailOnly, humanize, inApp, unread, relatedDestination, relatedRequest, recordFields } from './route-contract.mjs';
import './front-desk.css';

const folder = '/portal-studio/variants/01-front-desk/assets/extra-hours-folder.svg';
const date = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString() : 'Date not provided';
const emailStatus = { sent: 'Email sent', pending: 'Email pending', failed: 'Email delivery failed' };

function RelatedRecord({ item, token, role, onClose, onOpen }) {
  const dialog = useRef(null);
  const [record, setRecord] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, retry] = useState(0);
  const destination = relatedDestination(item, role);
  useEffect(() => {
    const returnTo = document.activeElement;
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => { element?.close(); if (returnTo?.isConnected) returnTo.focus(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const request = relatedRequest(item, role);
    setError(''); setRecord(null); setLoading(Boolean(request));
    if (request) api(request.path, { token, signal: controller.signal }).then(data => {
      if (controller.signal.aborted) return;
      const selected = request.select(data);
      if (!selected) setError('This record is no longer available in your current workspace. It may have been removed, reassigned or changed.');
      else setRecord(selected);
    }).catch(err => { if (!controller.signal.aborted) setError(explainApiError(err, 'Related record')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [item, token, role, attempt]);
  return <dialog className="fd-react-dialog" data-front-desk-route="related-record" ref={dialog}
    aria-labelledby="fd-record-heading" onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header><h2 id="fd-record-heading">{item.title}</h2><button className="outline-button" type="button" onClick={onClose}>Close</button></header>
    {item.relatedModel === 'ExtraHoursRequest' && <img className="fd-react-folder" src={folder} alt="" />}
    <p>{item.message}</p>
    {loading && <p role="status">Loading the current record…</p>}
    {error && <div className="feedback error" role="alert"><p>{error}</p><button className="outline-button" type="button" onClick={() => retry(n => n + 1)}>Retry record</button></div>}
    {record && <dl className="fd-react-record">{recordFields(record).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    {!loading && !record && !error && <p>There is no direct record-read endpoint for this event in the supplied application. Open its authorized workspace to inspect the current record.</p>}
    <p className="fd-react-muted">This is a read-only view. Any decision is made in the existing workflow, using its current permission and validation checks.</p>
    {destination && <button className="primary-button" type="button" onClick={() => { onClose(); onOpen(destination.screen); }}>{destination.label}</button>}
  </dialog>;
}

/** Route key: notifications. Server-owned records only; never imports studio fixture code. */
export default function NotificationsRoute({ token, profile, onOpen, notify }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [view, setView] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, select] = useState(null);
  const [record, openRecord] = useState(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(false);
  const pending = useRef(new Set());
  const fetchController = useRef(null);
  const mutationLock = useRef(false);
  const role = profile.role;
  const load = useCallback(async () => {
    fetchController.current?.abort();
    const controller = new AbortController(); fetchController.current = controller;
    setLoading(true); setError('');
    try {
      const result = await api('/api/notifications', { token, signal: controller.signal });
      if (!controller.signal.aborted && mounted.current) setItems(Array.isArray(result?.notifications) ? result.notifications : []);
    } catch (err) { if (!controller.signal.aborted && mounted.current) setError(explainApiError(err, 'Notifications')); }
    finally { if (!controller.signal.aborted && mounted.current) setLoading(false); }
  }, [token]);
  useEffect(() => {
    mounted.current = true; setItems([]); select(null); openRecord(null); load();
    return () => { mounted.current = false; fetchController.current?.abort(); pending.current.forEach(controller => controller.abort()); pending.current.clear(); };
  }, [load]);
  const mark = async entries => {
    if (mutationLock.current || loading) return;
    const targets = entries.filter(unread); if (!targets.length) return;
    mutationLock.current = true; setBusy(true); setMessage(''); setError('');
    const controller = new AbortController(); pending.current.add(controller);
    let completed = 0; const failures = [];
    for (const entry of targets) {
      if (controller.signal.aborted) break;
      try {
        const result = await api(`/api/notifications/${encodeURIComponent(entry._id)}/read`, { token, method: 'PATCH', body: {}, signal: controller.signal });
        // Update from the acknowledged server value, not a client-generated timestamp.
        if (!result?.notification?.isRead) throw new Error('The server did not confirm the read change. Refresh and try again.');
        if (mounted.current && !controller.signal.aborted) setItems(current => current.map(old => old._id === entry._id ? { ...old, ...result.notification } : old));
        completed++;
      } catch (err) {
        if (!controller.signal.aborted) failures.push(explainApiError(err, 'Read state'));
        if ([401, 403].includes(err.status)) break;
      }
    }
    pending.current.delete(controller); mutationLock.current = false;
    if (!mounted.current || controller.signal.aborted) return;
    setBusy(false);
    const text = `${completed} of ${targets.length} ${targets.length === 1 ? 'notification' : 'notifications'} marked as read.`;
    setMessage(text);
    if (failures.length) setError(`${text} ${failures[0]} Unconfirmed items remain unread; retry or refresh.`);
    else notify?.('success', text);
  };
  const inbox = items.filter(inApp), email = items.filter(emailOnly);
  const source = view === 'email' ? email : view === 'unread' ? inbox.filter(unread) : inbox;
  const shown = source.filter(item => `${item.title || ''} ${item.message || ''} ${humanize(item.type)}`.toLowerCase().includes(query.trim().toLowerCase()));
  const selected = shown.find(item => item._id === selectedId) || shown[0];
  const destination = selected && relatedDestination(selected, role);
  const detailRequest = selected && relatedRequest(selected, role);
  return <section className="page-stack" data-front-desk-route="notifications">
    <header className="fd-react-heading"><div><h1>Notifications</h1><p>Updates for your university account.</p></div><div className="inline-controls">
      <button className="outline-button" type="button" disabled={loading || busy} onClick={load}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      <button className="primary-button" type="button" disabled={loading || busy || !inbox.some(unread)} onClick={() => mark(inbox)}>{busy ? 'Saving read state…' : 'Mark all in-app as read'}</button>
    </div></header>
    {error && <div className="feedback error" role="alert"><p>{error}</p><button className="outline-button" type="button" disabled={busy || loading} onClick={load}>Retry loading</button></div>}
    {message && <p role="status">{message}</p>}
    <div className="fd-react-controls"><div className="inline-controls" aria-label="Notification views">
      {[['all','All in-app',inbox.length],['unread','Unread',inbox.filter(unread).length],['email','Email delivery',email.length]].map(([key,label,count]) =>
        <button className="outline-button" type="button" key={key} aria-pressed={view===key} onClick={() => { setView(key); select(null); }}>{label} · {count}</button>)}
    </div><label className="field"><span>Search notifications</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label></div>
    <p className="fd-react-muted" role="status">{loading ? 'Loading updates…' : `${shown.length} ${shown.length===1?'update':'updates'} shown. Opening an update does not mark it as read.`}</p>
    {!loading && !shown.length && <section className="panel"><h2>{query ? 'No matching updates' : view==='unread' ? 'No unread notifications' : view==='email' ? 'No email delivery records' : 'No notifications yet'}</h2><p>{query ? 'Change your search or clear it to see all updates.' : 'Only records returned for your signed-in account appear here.'}</p>{query && <button className="outline-button" type="button" onClick={() => setQuery('')}>Clear search</button>}</section>}
    {!loading && selected && <div className="fd-react-reading"><div className="fd-react-roster" aria-label="Choose an update">
      {shown.map(item => <button key={item._id} type="button" className="fd-react-select" aria-pressed={selected._id===item._id} onClick={() => select(item._id)}>
        <small>{emailOnly(item) ? emailStatus[item.deliveryStatus] || 'Email status unavailable' : unread(item) ? 'Unread' : 'Read'} · {date(item.createdAt)}</small><strong>{item.title}</strong><small>{humanize(item.type)}</small>
      </button>)}
    </div><article className="fd-react-reading-copy" aria-label="Selected update">
      {selected.type.startsWith('extraHours') && <img className="fd-react-folder" src={folder} alt="" />}
      <p className="fd-react-muted">{humanize(selected.type)}</p><h2>{selected.title}</h2><p>{selected.message}</p>
      <dl className="fd-react-record"><div><dt>Received</dt><dd>{date(selected.createdAt)}</dd></div><div><dt>Channels</dt><dd>{selected.channels?.join(' · ') || 'Not provided'}</dd></div>{selected.relatedId && <div><dt>Record reference</dt><dd>{selected.relatedId}</dd></div>}</dl>
      {emailOnly(selected) && <p role="status">{emailStatus[selected.deliveryStatus] || 'Email status unavailable'}. Delivery state is not inbox read state. Email retry is handled by the backend, not this page.</p>}
      <div className="inline-controls">{detailRequest && <button className="outline-button" type="button" onClick={() => openRecord(selected)}>Open related record</button>}
        {destination && <button className="outline-button" type="button" onClick={() => onOpen(destination.screen)}>{destination.label}</button>}
        {unread(selected) && <button className="primary-button" type="button" disabled={busy} onClick={() => mark([selected])}>Mark as read</button>}
      </div>
      {!destination && !emailOnly(selected) && <p className="fd-react-muted">This update has no permitted destination for your role. The message remains available here.</p>}
    </article></div>}
    {record && <RelatedRecord item={record} token={token} role={role} onClose={() => openRecord(null)} onOpen={onOpen} />}
  </section>;
}
