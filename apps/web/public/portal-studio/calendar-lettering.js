const monthAlphabet={
 A:'M0 13 3.9 1 5 1 9 13m-7-4 5-.3',B:'M1 13 1.5 1q8-2 6 3-1 2-6 3 8-2 7 3-1 4-7 3',
 C:'M8 2q-7-4-7 6 0 7 7 4',D:'M1 13 1.6 1q8-1 7 6t-7.6 6',E:'M8 1l-7 .4L.6 13l8-.7M1 7l5-.4',
 F:'m1 13 .6-12L9 .8M2 7l4-.4',G:'M8 2Q2-1 1 6t4 7l3-1 .2-5-4 .5',
 H:'M1 1 .6 13M8 1l.4 12M1 7l7-.6',I:'M2 1h5M5 1l-.5 12M2 13l5-.3',
 J:'M4 1l5-.3m-2 0-.5 9q-1 6-6 2',L:'M1.8 1 1 13l7-.3',M:'M.5 13 1.5 1l3.3 7L8.5 1l.5 12',
 N:'M1 13 1.5 1 8 12.5 8.6 .8',O:'M4.6 1Q0 1 1 9t6.7 2Q11-1 4.6 1Z',
 P:'M1 13 1.4 1q8-2 7 3T1 7',R:'M1 13 1.4 1q8-2 7 3T2 7l7 6',
 S:'M8 2Q2-1 1.3 3.5T5.5 7q5 2 2 5t-7-.3',T:'M0 1.5 9 1M4.7 1l-.3 12',
 U:'M1 .9.8 9q0 5 4 4t3.6-6L9 1',V:'M.5 1 4 13l1-.2L9 1',
 Y:'M0 1l4.5 6L9 1M4.5 7l-.3 6'
};
function inkMonth(name){
 return `<svg aria-hidden="true" class="ink-month" viewBox="-1 -1 ${name.length*12+1} 17" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linejoin="round" stroke-linecap="round">${Array.from(name.toUpperCase(),(c,i)=>`<path transform="translate(${12*i} ${[.2,0,.5,-.15][i%4]}) rotate(${[-2,1,-1,2][i%4]} 4 7)" d="${monthAlphabet[c]}"/>`).join('')}</svg>`;
}
