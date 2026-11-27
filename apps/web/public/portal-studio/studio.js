'use strict';

const workspaces = [{
  name: 'Claude Study',
  columns: '1fr 1fr',
  rows: ['queue queue', 'week week', 'review activity'],
  inlineDates: true,
}];
const productionPreview = true;
const lab = { layout: 0, dark: true };

function restoreLook() {
  lab.dark = localStorage.getItem('portal.theme') !== 'light';
  applyLook();
}

function applyLook() {
  const tones = lab.dark
    ? { ground: '#151515', surface: '#151515', ink: '#efeee9', muted: '#bdbbb0', accent: '#8dbbfa' }
    : { ground: '#f0eee6', surface: '#f8f6ef', ink: '#302d28', muted: '#615c52', accent: '#285ca1' };
  document.documentElement.dataset.theme = lab.dark ? 'dark' : 'light';
  document.body.classList.add('portal-studio', 'live-preview', 'claude-family');
  document.body.dataset.palette = 'console-tones';
  document.body.dataset.workspace = 'claude-study';
  for (const [key, value] of Object.entries(tones)) {
    document.body.style.setProperty('--studio-' + key, value);
  }
}

restoreLook();
