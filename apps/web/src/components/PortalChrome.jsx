const iconPaths = {
  inbox: "M4 4h16l2 10v6H2v-6L4 4Zm-2 10h6l2 3h4l2-3h6",
  calendar: "M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2ZM7 3v4m10-4v4M3 11h18m-14 4h3m4 0h3",
  clock: "M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  coins: "M18 6c0 2-3.6 3.5-8 3.5S2 8 2 6s3.6-3.5 8-3.5S18 4 18 6ZM2 6v8c0 2 3.6 3.5 8 3.5h1M2 10c0 2 3.6 3.5 8 3.5m8-7.5v3m4 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0Zm-5-2v4",
  document: "M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6m-6 4h6",
  history: "M3 11a9 9 0 1 1 2.5 7M3 4v7h7m2-5v6l4 2",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-2 7-2 9h16c0-2-2-2-2-9m-8 12a2 2 0 0 0 4 0",
  search: "M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-2 4 5 5",
  paymentChoice: "M3 6h18v12H3zM3 10h18m-15 4h4m5 0h3",
  nextInstallment: "M4 6h16v14H4zM8 3v5m8-5v5M4 10h16m-11 5h6m-2-2 2 2-2 2",
  scheduleAssigned: "M4 6h16v14H4zM8 3v5m8-5v5M4 10h16m-11 5 2 2 4-4",
  readyToProcess: "M4 13h9m-4-4 4 4-4 4m7-9h4v10h-4",
  scheduleChange: "M4 8h16m-4-3 4 3-4 3m4 5H4m4-3-4 3 4 3",
  swapOpen: "M4 7h15m-3-3 3 3-3 3M20 17H5m3-3-3 3 3 3M11 12h2",
  swapComplete: "M4 7h15m-3-3 3 3-3 3M4 16l4 4 9-8",
  swapWithdrawn: "M4 7h15m-3-3 3 3-3 3m-6 3 6 6m0-6-6 6",
  swapExpired: "M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM12 7v5l3 2m-8 7-2 1m12-1 2 1",
};

export function ChromeIcon({ name }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPaths[name]} /></svg>;
}
