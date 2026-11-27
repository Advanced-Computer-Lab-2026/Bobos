const binderStations=[16,50,84];
function binderRow(part){
  const track='M8.7 36C12.1 34.3 13.9 27.6 14.5 20.6C15.2 14.5 15.5 5.2 10.8 1.9Q9 .5 7.3 1.9C1.9 4.4 1 13 2.8 16';
  const wire='M4.6 4.9Q5.6 2.9 7.3 1.9Q9 .5 10.8 1.9C15.5 5.2 15.2 14.5 14.5 20.6C13.9 27.6 12.1 34.3 8.7 36';
  const art={
    feet:`<ellipse cx="2.8" cy="16.1" rx="3.55" ry="1.95" fill="#605d50"/>
      <path d="M2.8 16C1 13 1.9 4.4 7.4 1.9Q9 .9 10.8 1.9" fill="none" stroke="#4b4a42" stroke-width="3"/>
      <path d="M2.8 15.8Q1.4 5.3 7.3 2.2" fill="none" stroke="#9d9e8e" stroke-width="1.35"/>`,
    punches:`<ellipse cx="8.7" cy="36" rx="3.65" ry="2.2" fill="#4b463c" stroke="#e6dac1" stroke-width="1"/>`,
    wires:`<path class="ring-track" d="${track}" fill="none" stroke="none"/>
      <path d="${wire}" fill="none" stroke="#484741" stroke-width="3.3"/>
      <path d="${wire}" fill="none" stroke="#c3c2af" stroke-width="1.55"/>
      <path d="M8 1.8Q10.2 1 12 4.5M14.5 12.3Q15 19 13.4 24.2" fill="none" stroke="#f6f0db" stroke-width=".85"/>`,
    threads:`<g class="threaded-wire" fill="none"><path d="${track}" pathLength="1" stroke="#484741" stroke-width="3.3"/><path d="${track}" pathLength="1" stroke="#c3c2af" stroke-width="1.55"/></g>`,
    eyelets:'<ellipse class="traveling-punch" rx="3.3" fill="none" stroke="#817963" stroke-width="1"/>'
  };
  return `<div class="binder-row binder-${part}" aria-hidden="true">${binderStations.map(left=>
    `<svg style="left:${left}%" viewBox="0 0 20 42" stroke-linecap="round">${art[part]}</svg>`).join('')}</div>`;
}
