// Small drawings for the binding, in a 300 by 28 strip. The page and its
// illustration stay live underneath each material.
const calendarBindings={
  sashiko:{
    label:'Sashiko cloth',
    art:`<g fill="none" stroke="#e3ddc3" stroke-width="1.15" stroke-linecap="round" stroke-dasharray="2.8 2.2 2 2.1">
      ${[-25,25,75,125,175,225,275].map(x=>`<path transform="translate(${x})" d="M0 27Q24-22 50 27M6 27q19-36 38 0M13 27q12-22 24 0M24 1q15 26 27 0"/>`).join('')}
      </g><path d="M0 25.7q80 .7 154-.1t146 .4" fill="none" stroke="#263c4d"/>`
  },
  marble:{
    label:'Marbled endpaper',
    art:`<path d="M-4 28C13 8 30 23 53 11 72 1 53-4 48 0c-5 4 8 8-8 12-12 3-19-2-31 1L-3 19Zm80 0c1-13 30-11 49-23l8-7h12c-13 18-32 20-52 30Zm92 0c13-16 39-12 64-27h17c-33 24-60 14-72 29Z" fill="#eecca7"/>
      <path d="M-3 20c16-18 29.5-3 45-11 9-5-3.7-9 13-13M59 30c8-15 37-10 54-24l8-8m28 31c18-14 34-8 59-26m54 28c12-16 35-14 46-31" fill="none" stroke="#6f777a" stroke-width="4.2"/>
      <path d="M-4 24c19-19 32-4 48-14 11-6-2-11 13-12m-41 29c14-6 23-2 42-9 17-7 15-13 13-18m26 29c10-6 22-7 34-13 11-6 16-12 17-15m41 28c17-9 32-8 58-26m17 9c16-8 24-8 36-15" fill="none" stroke="#624d49" stroke-width="1.2"/>`
  },
  survey:{
    label:'Survey pad',
    art:`<path d="M0 22.5 300 22" fill="none" stroke="#e9dfb9" stroke-width="1"/>
      <g stroke="#e3dfc2" stroke-width="1">${Array.from({length:51},(_,i)=>`<path d="M${i*6} 22.5v-${i%5===0?10:i%2===0?5.5:3.5}"/>`).join('')}</g>
      <path d="m14 4 5 8H9ZM276 5v8m-4-4h8" fill="none" stroke="#deddbd" stroke-width="1.15"/>`
  },
  birch:{
    label:'Birch press',
    art:`<g fill="none" stroke="#947252" stroke-width="1.05" opacity=".88">
      <path d="M-2 6c24 3 49-5 73-1 14 1 21 7 31 6s12-5 30-6m13 1c34 4 66-2 97 0m13 1 46-2"/>
      <path d="M0 17c33 2 57-7 79-3 11 2 15 7 28 6 17-2 18-9 37-9 28 1 62 4 86 0m11 1 62-.8"/>
      <path d="M20 24q30-2 49-2m36-7c-10 1-16-4-10-5 7-2 15 0 18 2q-1 2-8 3Zm34 4c23-6 53-1 77-3m9 7 60-4"/></g>
      <g fill="#8a7457" stroke="#6f634d" stroke-width=".85"><circle cx="9" cy="13" r="2.9"/><circle cx="291" cy="13" r="2.9"/></g>
      <path d="m7.5 14 2.6-2.5m279.4 2.3 2.9-2" stroke="#e0cb9b"/>`
  },
  lunar:{
    label:'Lunar almanac',
    art:`<g fill="none" stroke="#c4bfab" stroke-width=".9"><path d="m6 21 17-12 13 6 20-11m184 19 17-12 15 6 22-11" stroke-dasharray="2 3"/>
      <path d="M115 14q7-1 13-.5m44 0 12-.5"/></g>
      <g fill="#e6d6a5"><circle cx="23" cy="9" r="1.7"/><circle cx="36" cy="15" r="1.4"/><circle cx="56" cy="4" r="1.7"/>
      <path d="M137 8.3c-6 1-7.8 9-1.3 11.2q2.8.9 5-1.4-8.6-.5-3.7-9.8Z"/><circle cx="151" cy="14" r="5.8"/><path d="M164 8.3c6 .9 7.8 9 1.3 11.2q-2.8.9-5-1.4 8.6-.5 3.7-9.8Z"/>
      <circle cx="257" cy="11" r="1.6"/><circle cx="272" cy="17" r="1.3"/><circle cx="294" cy="6" r="1.7"/></g>`
  },
  ticket:{
    label:'Library pocket',
    art:`<path d="M4 22q78 .7 146 .2t146-.6" fill="none" stroke="#d7ac8b" stroke-width="1.1" stroke-dasharray="3 2.5"/>
      <path d="m111 5 77-.4-.1 16.3-77.8.3Z" fill="#bd9d65" stroke="#614f42" stroke-width="1"/>
      <path d="m119 8 60-.3-.2 10.3-60 .2Z" fill="#ede1c5" stroke="#7c644e" stroke-width=".9"/>
      <path d="m126 12.2 16-.3m4 .3 6-.2m4 .4 7-.2m-37 2.9 32-.3" stroke="#9a8c72" stroke-width=".85"/>
      <g fill="#6c5746"><circle cx="114.5" cy="13" r=".95"/><circle cx="184" cy="12.8" r=".95"/></g>`
  },
  herbarium:{
    label:'Herbarium',
    art:`<g fill="none" stroke="#d1d6b7" stroke-width="1.1"><path d="M-4 23C20 21 37 13 57 11s35 1 52-7m101 21q25-14 45-13 25 2 48-8"/>
      <path d="M18 19q-3-4-1-8 4 2 3 7m9-3q5-7 11-7-1 5-8 6m11-2q-1-5 2-8 3 2 .5 7m8 1q6 6 12 5-2-5-9-6m13 .3q4-6 10-7-1 4-7 7m14-1q6 5 11 3-3-3-8-4m133 11q2-6 7-8 0 5-5 7m11-4q6 5 11 3-2-4-8-4m12-2q1-5 6-8 0 5-3 8m14 0q2 5 8 6-1-5-5-6m11-2q2-5 8-7-1 5-6 7"/></g>
      <path d="m139 0 17 .1-.5 24-7.8-4.3-8.5 4.7Z" fill="#d3c399" stroke="#7b795e" stroke-width=".9"/>`
  }
};
function bindingDrawing(style){
  const binding=calendarBindings[style];
  return binding ? `<svg class="material-binding" viewBox="0 0 300 28" preserveAspectRatio="none" aria-hidden="true">${binding.art}</svg>` : '';
}
