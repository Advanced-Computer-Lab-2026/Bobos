// Five pencil exposures for each margin drawing. Strokes grow out of the
// preceding pose; the final two alternate as a held, living drawing.
const seasonalSketches = {
  flower: [
    'M15 46q10-3 22-1m7-1 7 .5 M34 44q-1-3 1-6m-1 4q-4-4-7-3 2 4 7 3',
    'M15 46q12-3 23-1m6-1 7 1 M34 44q-2-9 2-15m-2 9q-8-1-10-7 8 0 10 7m1-4q3-5 9-5-2 5-9 5',
    'M16 46q10-3 23-1m5-1 8 .5 M34 44q-4-12 4-23m-4 16q-8 0-12-8 9 1 12 8m1-6q4-8 13-8-3 7-13 8 M38 22q-6-3-4-8 3 0 5 3 0-6 5-8 3 7-6 13Z',
    'M15 46q12-3 24-1m6-1 7 1 M34 44q-4-14 5-25m-5 18q-10-1-13-9 10 2 13 9m1-6q6-8 14-8-4 8-14 8 M39 17c-9 1-13-4-10-7 3-2 7 0 10 4-3-7-1-12 2-12 4 0 4 6 2 11 5-7 10-8 12-5 2 4-5 8-10 9 7 1 9 5 6 7-4 2-9-2-10-5-4 6-9 6-10 3-1-2 3-5 8-5Z M40 17l2-1',
    'M15 46q11-3 24-1m6-1 7 .6 M34 44q-4-13 5-25m-5 18q-10-2-13-8 10 1 13 8m1-6q6-9 14-8-4 7-14 8 M39 17c-9 1-14-4-10-7 3-2 7 1 10 4-4-7-1-12 2-12 4 0 4 6 2 11 5-7 11-8 12-4 1 4-5 7-10 8 7 1 9 5 6 7-3 2-9-2-10-5-4 6-9 6-10 3-1-3 3-5 8-5Z M39.5 17l2.5-1'
  ],
  sail: [
    'M4 38q8-5 16-1t15-1m8 1 12-2 M11 31l22-2-5 6-13 1Z',
    'M4 38q8-4 16 0t16-2m7 1 12-3 M15 30l24-3-5 7-15 1Zm12-3-1-13 8 12Z',
    'M5 39q9-5 18-1t15-2m6 0 11-3 M18 30l26-3-6 7-15 2Zm12-4-1-21 12 19Z M27 12l-9 15 10-1Z',
    'M5 39q10-5 18-1t15-2m6 .5 12-3 M19 30l26-3-6 7-15 2Zm12-4L29 4q9 8 14 20Z M27 11q-4 10-10 16l11-1Z M48 12l8-3m-4 7 8-2',
    'M5 39q10-6 18-1t15-2m6 .5 12-3 M19 30l26-3-6 7-15 2Zm12-4L29 4q10 8 14 20Z M27 11q-4 11-10 16l11-1Z M49 12l7-3m-4 7 8-2'
  ],
  leaf: [
    'M9 17q8-9 19-8m-8 2q-7-8-13-5 1 7 13 5Z M36 8q8-3 14 0',
    'M11 15q11-4 17-4m-2 5q3-5 12-4-2 8-12 4Zm0 0-3 1 M41 25q7 0 8-4',
    'M12 17q14-7 17-4t-7 8 M32 24q-1-8 5-11 5 8-5 11Zm0 0-2 3 M44 37l7-2',
    'M12 17q13-7 17-4t-6 8c-8 5-5 10 2 9 M34 37q5-12 19-10-3 12-19 10Zm-4 3 18-10m-5 3 .5-3m-4 5 5 0 M17 43q11-2 22-1m6-1 8-.5',
    'M12 17q13-7 17-4t-6 8c-8 5-5 10 2 9 M34 37q5-11 19-10-4 12-19 10Zm-4 3 18-10m-5 3 .5-3m-4 5 5 0 M17 43q12-2 22-1m6-1 8-.5'
  ],
  steam: [
    'M14 25q9-3 23-1l-2 11q-8 8-16 1Z M11 42q13 3 32-2',
    'M14 25q10-3 23-1l-2 11q-8 8-16 1Z M37 26q11-5 8 2-2 5-9 5 M11 42q13 3 32-2 M24 20q-4-5 0-8',
    'M14 25q10-3 23-1l-2 11q-8 8-16 1Z M37 26q11-5 8 2-2 5-9 5 M11 42q13 3 32-2 M24 20q-5-6 0-10m6 10q5-4 2-9',
    'M14 25q10-3 23-1l-2 11q-8 8-16 1Z M37 26q11-5 8 2-2 5-9 5 M11 42q13 3 32-2 M24 20c-8-8 5-9-1-16m7 16q6-6 2-11 M17 26q8 2 18-1',
    'M14 25q10-3 23-1l-2 11q-8 8-16 1Z M37 26q11-5 8 2-2 5-9 5 M11 42q13 2 32-2 M24 20c-5-7 3-10 0-16m6 16q4-6 1-11 M17 26q8 2 18-1'
  ]
};
const seasonalPaper = [
  ['#b7cad7','#91abbc'],['#cdc3dd','#a99bbd'],['#c3d3b0','#9aaf82'],
  ['#e7c0c7','#c49fa9'],['#c6cfac','#9daf8a'],['#a9cfc8','#86aaa5'],
  ['#eacb95','#c0a175'],['#dfb59c','#bb937f'],['#c7c09f','#a79b7a'],
  ['#dcb09c','#b68a75'],['#d1bfdc','#ab98b9'],['#bfc6dd','#9ba6c2']
];
function seasonDrawing(month){
  const season = ['steam','steam','flower','flower','flower','sail','sail','sail','leaf','leaf','leaf','steam'][month];
  return `<svg class="season-drawing" aria-hidden="true" viewBox="0 0 62 50" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round" stroke-linecap="round">${seasonalSketches[season].map((d,i)=>`<path class="season-cel cel-${i}" d="${d}"/>`).join('')}</svg>`;
}
function tintCalendar(pad,month){
  const [paper,back]=seasonalPaper[month];
  pad.style.setProperty('--season-sheet',paper);
  pad.style.setProperty('--season-back',back);
}
