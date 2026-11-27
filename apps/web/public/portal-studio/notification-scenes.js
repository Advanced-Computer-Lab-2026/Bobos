// The registration marks, line weights and paper tones are shared across the five plates.
const notificationScenes = (() => {
  const ink = '#39372f', paper = '#f5ecd6', brass = '#d6ae70', sage = '#99b5a7';
  const path = (d, fill='none', extra='') => `<path d="${d}" fill="${fill}" ${extra}/>`;
  const circle = (x,y,r,fill) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
  const group = (transform, drawing) => `<g transform="${transform}">${drawing}</g>`;
  const letter = (x,y,angle=0,fill=paper) => group(`translate(${x} ${y}) rotate(${angle})`,
    path('M0 1 48 0 49 29 1 30Z',fill)+path('m1 2 23 17L47 2M2 28l14-13m31 12L32 15'));
  const moving = (name,art) => `<g class="scene-${name}">${art}</g>`;
  const rivet = (x,y) => circle(x,y,3,brass)+path(`m${x-1} ${y+1} 2-2`);
  const feet = path('m160 173-2 9 15 1 4-10m108-1 4 9 14-1-2-10',ink);
  function tube(full) {
    const glass = path('M-8 54h192q24 0 24 24v13h-17V78q0-7-8-7H-8Z','#adc9c6')+
      path('M0 58h181q19 0 21 17M42 56v11m4-11v11m67-12v13m4-13v13','#adc9c6');
    const capsule = group('rotate(-9 273 113)',path('M252 58q19-8 38 0l1 84q-20 9-39 0Z','#c7d8ce')+
      path('m256 72 29-3 2 49-28 5Z',paper)+path('m262 81 16-2m-16 10 11-1m-10 10 14-2')+
      path('M249 56q20-9 43-1l1 12q-23 8-43 1Z',brass)+path('m250 132 43-2v11q-19 9-42 2Z',brass));
    return glass + feet + path('m138 144 25-18 131-5 29 23-3 29-178 3Z','#557d75')+
      path('m139 144 143-5 41 5-3 29-179 3Z','#71998b')+
      path('m145 145 135-3 10 5-145 2Z','#b2cab5')+
      path('M169 137V87q17-8 54-3l5 49Z','#527872')+
      path('m165 85 60-4 2 10-62 4Z',brass)+
      circle(197,111,14,paper)+path('m189 111 2-5m11-2 3 4')+moving('needle',path('m197 111 6-7'))+circle(197,111,1.8,ink)+
      path('m242 129 17-11 42-1 12 9-14 12-45 2Z',ink)+
      (full?moving('capsule',capsule):path('m242 128 14-12 41-1 12 10-13 7-43 3Z',brass)+path('m256 124 41-4'))+
      path('m152 154 50-1v13l-50 1Z','#cbbf9b')+path('m161 160 30-1')+rivet(308,157)+
      (full?letter(329,152,5):group('translate(342 157)',path('M0 1q18-6 32 0l-1 12q-16 5-31-1Z',brass)+path('M1 2q15 4 29-1')));
  }
  function pigeon(full) {
    const pigeonBody = path('M244 103q20-3 31-28 7-17 24-21 15-4 20 7 16-3 22 8l-20 6q-3 24-22 42-15 15-47 14l-49 12 27-26-42 8Z','#a7bdc1')+
      path('M262 100q21-12 26-31 5 14 23 17l-8 13q-19 8-41 1Z','#71968a')+
      path('m266 103 32-8m-26 14 21-6')+
      path('M275 98q-31-6-58 19l-25 20 50-10q22-8 33-29Z','#78959f')+
      path('m214 127 42-22m-29 19 28-15m-17 12 17-8')+
      circle(309,64,2.4,ink)+path('m321 64 16 4-16 4Z',brass)+
      path('m272 129-2 10-11 4m11-4 7 2m11-17-2 13-9 5m9-5 6 3','none','stroke="#b47d5e" stroke-width="3"');
    return path('m75 151 59-20 242 4 38 17-64 21-276-6Z','#99775b')+
      path('m75 151 275 9 64-8-1 12-62 21-275-8Z','#bd9873')+
      path('m86 164 94 3m132 3 28 1m24-4 33-9')+
      path('m95 136-2-53 67-11 44 13v52l-64 10Z','#78968a')+
      path('m95 85 46 11 63-11-44-13Z','#bbcab2')+
      path('m141 96 63-11v52l-64 10Z','#638276')+
      path('m149 100 46-6v14l-46 6Z',ink)+
      (full?letter(154,104,-9,'#e5c68c'):path('m152 121 37-5 1 9-38 5Z',brass))+
      moving('bird',full?pigeonBody:path('M216 124q23-14 40-30 12-13 31-7 16 5 14 21-3 22-27 28l-57 4-25 1Z','#9eafb0')+path('M214 132q19-30 58-33-9 25-36 29Z','#78959f')+path('m217 129 37-22m-25 18 23-13')+path('m278 92q4 5 10 2m1 8-12 3 9-7Z',brass)+path('m264 136-7 5m17-6-5 5'))+
      (full?group('translate(274 124) rotate(-16)',path('m-6-4 13-1 1 7-13 2Z','#cf735e')+path('m4-2 9-2 2 6-10 3Z',paper)):
        path('M321 146q1-16 15-21-1 15-15 21Zm1-2 9-13','#e1cfaa'));
  }
  function lighthouse(full) {
    const tower = path('m213 153 12-76 29-1 16 75Z',paper)+path('m221 103 38 4 4 20-45-6Z','#c67d64')+
      path('m218 76 41-2 2 6-44 2Z','#688881')+path('m222 73 1-25 30-1 3 26Z','#edcc8c')+
      path('m229 49-1 23m17-24 1 23m-22-22 30 22m-30 1 27-23')+
      path('m217 47 20-14 22 13-2 4-38 1Z','#709288')+path('m238 33-1-8')+circle(237,24,2,brass)+
      path('m215 67 46-1v9l-46 2Zm5 0v8m8-8v7m17-8v8m11-8v7')+
      path('m233 151 .5-15q5-8 11-1l1 16Z','#657673');
    const shore = path('M48 169q65-6 94-14l45-9 27-14 12 10 34-1 31 16 33 6 62 9-72 8-123-3-96 2Z','#84988a')+
      path('m163 160 24-9 20 1m59 4 26 9m-81-25-16 13m-86 18 41-6');
    const boat = group(full?'translate(313 123)':'translate(98 149) scale(.73)',
      path('m0 20 53-2-9 12-31 3Z','#b8785d')+path('m24 19-1-30 20 26Z',paper)+path('m20-21 1 38-19 1Z','#a5bbbb')+path('m22-23 11 2-11 6Z',brass));
    return (full?moving('beam',path('m239 56 177-49-6 81Z','#edc888','opacity=".28" stroke="none"')):
      group('translate(325 48)',path('M-13-8q8 0 13 7 8-10 18-9M19 6q6 0 10 5 5-7 12-6','none','stroke="var(--muted)"')))+shore+tower+
      moving('boat',boat)+path('m53 186q26-4 53 0m25-2 20-2m143 8 44 1m9-10 30-2','none','stroke="var(--muted)" opacity=".7"');
  }
  function press(full) {
    const bed = feet+path('m137 149 38-13 135-1 31 14-26 17-177 5Z','#91a79c')+
      path('m138 157 175-5 28-5-1 17-24 13-177 4Z','#68877c');
    const arch = path('m160 143-4-66q-1-26 18-30l88-5 7 16-78 9q-12 0-11 14l3 60Z','#708c80')+
      path('m162 138-2-61q-2-23 19-25l62-4')+
      path('m230 47 29-2 1 27-28 3Z',brass)+
      path('m241 32 8-1 1 65-8 2Z','#a9aaa0')+
      path('m240 42 10-4m-9 44 9-4m-8 10 8-4m-7 10 7-4')+
      path('m206 36 76-8 1 5-76 8Z',brass)+circle(205,39,5,'#92735a')+circle(284,30,5,'#92735a');
    const platen = path('m235 92 20-2 9 16 29 4-1 9-87 7-4-9 29-9Z','#6c8079')+path('m205 121 85-7');
    return bed+arch+(full?moving('impression',platen):platen)+
      (full?group('translate(211 136) rotate(-6)',path('m0 1 88 2 14 13-82 8Z',paper)+path('m19 9 35-2m-29 7 48-5','#efe4ca')+circle(78,10,4,'#c98670')):
      path('m212 144 64-5 10 4-63 6Z','#b39368'))+
      (full?letter(320,156,7):group('translate(328 152)',path('m0 6 26-4 8 10-27 4Z',brass)+path('m8 1 10-2 4 6-12 2Z','#718b7c')))+rivet(152,168);
  }
  function line(full) {
    const cord=path('M58 45q148 61 311 14l42-14','none','stroke="#ad9375" stroke-width="2.5"');
    const peg=(x,y)=>group(`translate(${x} ${y}) rotate(8)`,path('m-3-4 7-1-1 18-5 1Z',brass)+path('m-2 4 5-1'));
    const print=(x,y,a,color,art)=>group(`translate(${x} ${y}) rotate(${a})`,path('M0 0 64 2 61 76 1 75Z',paper)+path('m6 8 51 1-2 54-48 1Z',color)+art);
    const plant=path('m333 153-1-33m1 19q-26-1-27-20 22 0 27 20Zm-1-8q1-25 24-28 2 19-24 28Z',sage)+
      path('m313 148 38-2-4 28-26 1Z','#c68e71')+path('m311 145 42-2v8l-41 3Z','#daac8b');
    return path('m43 47 9-7 9 3 6 123-13 2Z','#9a785e')+path('m398 45 8-4 7 3 4 116-12 2Z','#ae8768')+
      cord+(full?moving('prints',print(108,63,-6,'#648a91',path('m13 50 9-15 11 9 12-20 8 27Z','#d9dfc4')+circle(20,21,4,paper))+
        print(204,76,6,'#b77b66',path('M12 49q21-31 39 1Zm9-12 1-15 5-1 2 12m7 0 1-13 5 2 1 17',paper))):
        moving('prints',group('translate(180 79) rotate(5)',path('m0 0 26 1-2 24-9-5-14 4Z','#9caf9a'))))+
      (full?peg(138,68)+peg(231,78):peg(191,78))+peg(293,72)+plant+
      path('m35 173 46-3m219 10 63-3m26-10 40-3','none','stroke="var(--muted)" opacity=".65"');
  }
  function coffee() {
    // A letter lies flat under the saucer; its turned corner has its own opaque face.
    const stationery = path('M57 147q57 2 118 15l-18 25q-53-12-116-16Z',paper)+
      path('m157 187-13-13 22-2q-5 7-9 15Z','#dfd0af')+
      path('m69 160 34 6m-39 1 56 11','none','stroke="#a5967b" stroke-width="1.2"');
    const saucer = path('M62 155q49-14 102 0-49 21-102 0Z','#91aa9a')+
      path('M71 156q42 10 84-1','none','stroke="#c9d3b8" stroke-width="1.3"');
    const cup = path('M82 112c-31-15-36 23-4 24','none','stroke="#d6ae70" stroke-width="8"')+
      path('M82 112c-31-15-36 23-4 24','none','stroke-width="1.3"')+
      path('M80 105q32 6 65 0l-4 30q-3 20-29 19-25-1-28-20Z',paper)+
      path('m81 115q32 7 62 0l-1 7q-30 6-60-1Z','#719386')+
      path('M80 105c0-9 65-9 65 0s-65 9-65 0Z',paper)+
      path('M87 105q25-6 51 0-25 6-51 0Z','#574a38');
    const steam = moving('coffee-steam',path('M102 85c-11-12 10-17 1-30m20 29c-11-11 10-17 1-30','none','stroke="var(--muted)" stroke-width="1.5"'));
    const bell = circle(228,114,4,brass)+path('m225 118 1 5h5v-5',brass)+
      path('M201 149q2-27 28-28 25 0 28 27l5 5-66 1Z',brass)+
      path('m208 137 4-6','none','stroke="#f5ecd6" stroke-width="2"')+
      path('m196 153q31-4 66-1l2 6q-33 4-70 1Z','#dfbb80')+
      path('m190 161q37-6 78-1l2 7q-39 6-82 0Z','#60877a');
    return path('M39 184q111 5 241-1','none','stroke="var(--line)" stroke-width="1.2"')+
      stationery+saucer+cup+steam+bell;
  }
  const scenes = {tube,pigeon,lighthouse,press,line,coffee};
  return function draw(name,full) {
    const key = !full && (!name || name === 'tube') ? 'coffee' : Object.hasOwn(scenes,name) ? name : 'tube';
    return `<svg class="notification-plate" data-scene="${key}" data-mail="${full?'unread':'empty'}"
      viewBox="${key === 'coffee' ? '0 0 320 210' : '0 0 460 202'}" aria-hidden="true" focusable="false" fill="none" stroke="${ink}" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round">${scenes[key](full)}</svg>`;
  };
})();

const plateVisibility = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add('arrived');
      plateVisibility.unobserve(entry.target);
    }
  }
}, {threshold:0.2});

function observeNotificationPlate(plate) {
  plateVisibility.disconnect();
  if (plate) plateVisibility.observe(plate);
}
