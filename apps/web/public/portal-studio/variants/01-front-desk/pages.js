/* Portal / Front desk — round two. Native host extension, not an application shell.
 * All fixture records below are confined to the supplied portal-studio preview.
 * No passwords, tokens, production account data or simulated API responses are stored.
 */
(() => {
  'use strict';
  const base = new URL('.', document.currentScript.src);
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = new URL('styles.css', base).href;
  css.dataset.portalFrontDesk = 'styles';
  if (!document.querySelector('link[data-portal-front-desk]')) document.head.append(css);
  const names = {
    overview: ['Work first', 'Review desk', 'Term path', 'Open folders', 'Staff handover', 'One next task', 'Review register', 'Work lanes', 'Term index', 'Daily brief'],
    login: ['Open doorway', 'Library card', 'Key at the desk', 'Open register', 'Welcome counter', 'One field at a time', 'Credential slip', 'Help at hand', 'Bookend', 'Quiet entrance'],
    forgot: ['Addressed envelope', 'Dispatch slip', 'Recovery route', 'Help beside you', 'Check the address', 'Account card', 'Mail desk', 'Folded letter', 'Find your account', 'Return path'],
    reset: ['Code & key', 'Two small steps', 'Side by side', 'Replacement code', 'Delivery receipt', 'Focus well', 'Security margin', 'Password checklist', 'Single column', 'Recovery ledger'],
    profile: ['Account ledger', 'Identity index', 'University card', 'Open record', 'Read-only fields', 'Contact sheet', 'Account actions first', 'Academic context', 'Folded record', 'Field inspector'],
    notifications: ['Correspondence', 'Reading pane', 'Dated timeline', 'Action desk', 'Topic folders', 'Unread / read', 'Daily digest', 'Search register', 'Conversation history', 'One at a time']
  };
  const titles = {normalStudent:'Normal student', advisingStudent:'Advising student', advisor:'Advisor', coordinator:'Coordinator', administrator:'Administrator'};
  const store = {
    get(key, fallback = '') { try { return localStorage.getItem('portal-front-desk:' + key) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem('portal-front-desk:' + key, value); } catch { /* Storage can be disabled; native host still renders. */ } },
    json(key, fallback) { try { return JSON.parse(this.get(key, JSON.stringify(fallback))); } catch { return fallback; } }
  };
  const memory = new Map();
  const stateFor = key => { if (!memory.has(key)) memory.set(key, {}); return memory.get(key); };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const node = (tag, cls, html = '') => { const el = document.createElement(tag); if (cls) el.className = cls; el.innerHTML = html; return el; };
  const $ = (root, selector) => root.querySelector(selector);
  const $$ = (root, selector) => [...root.querySelectorAll(selector)];
  const isStudent = r => ['normalStudent','advisingStudent'].includes(r);
  const nativeLink = (to, text, cls='quiet-link', extra='') => `<a class="${cls}" href="${esc(href(to))}" data-page="${to}" ${extra}>${text}</a>`;
  const localButton = (text, action, cls='btn', attrs='') => `<button type="button" class="${cls}" data-fd="${action}" ${attrs}>${text}</button>`;
  const nativeButton = (text, action, cls='btn', attrs='') => `<button type="button" class="${cls}" data-action="${action}" ${attrs}>${text}</button>`;
  const textIcon = (name) => typeof icon === 'function' ? icon(name) : '';
  function unit(title, content, cls='', action='') {
    return node('section', 'fd-unit ' + cls, `<div class="section-head"><h2>${title}</h2>${action}</div>${content}`);
  }
  function routeAllowed(to, r) {
    const common = ['overview','profile','notifications','login','forgot','reset'];
    const allowed = {
      normalStudent:['my-schedule','my-courses','schedule-swap','calendar-sync'],
      advisingStudent:['my-schedule','my-courses','preferences','records','my-advisor','calendar-sync'],
      advisor:['advising','student-schedules','draft-schedule','preferences','mandatory-removals'],
      coordinator:['pending-work','directory','student-detail','advising','student-schedules','draft-schedule','preferences','mandatory-removals','group-assignments','templates','template-detail','schedule-activity','financial-records','courses','terms'],
      administrator:['directory','student-detail','student-schedules','schedule-activity','financial-records','courses','course-detail','terms','offerings','copy-offerings','mandatory-removals','group-assignments']
    };
    return common.includes(to) || (allowed[r] || []).includes(to);
  }
  function gateLinks(root, r) {
    $$ (root, 'a[data-page]').forEach(a => {
      if (routeAllowed(a.dataset.page,r)) return;
      const span=node('span','fd-unavailable-link',esc(a.textContent));
      span.title='This action is not available to your role.';
      a.replaceWith(span);
    });
  }
  function live(root, message, error=false) {
    let region=$(root,'.fd-feedback');
    if (!region) { region=node('div','fd-feedback'); root.prepend(region); }
    region.hidden=false; region.setAttribute('role',error?'alert':'status');
    region.dataset.tone=error?'error':'info'; region.textContent=message;
  }
  function appearance(root) {
    const saved=store.get('appearance');
    if (['light','dark'].includes(saved) && document.documentElement.dataset.theme!==saved) {
      lab.dark=saved==='dark'; applyLook();
    }
    root.addEventListener('click',event=>{
      const control=event.target.closest('[data-fd="theme"]'); if(!control) return;
      lab.dark=!lab.dark; applyLook(); store.set('appearance',lab.dark?'dark':'light');
      control.innerHTML=textIcon(lab.dark?'sun':'moon') + (lab.dark?'Light appearance':'Dark appearance');
      control.setAttribute('aria-label',lab.dark?'Use light appearance':'Use dark appearance');
    });
  }
  const themeControl = () => localButton(textIcon(lab.dark?'sun':'moon')+(lab.dark?'Light appearance':'Dark appearance'),'theme','fd-theme',`aria-label="Use ${lab.dark?'light':'dark'} appearance"`);
  function focusPicker(root) {
    // The host, and only the host, supplies the page-design selector after apply().
    queueMicrotask(()=> {
      const label=root.firstElementChild;
      if(label?.tagName==='LABEL' && $(root,'select')) label.classList.add('fd-host-choice');
    });
    root.addEventListener('change',event=>{
      if (!event.target.closest('.fd-host-choice')) return;
      queueMicrotask(()=>document.querySelector('#content > label select')?.focus({preventScroll:true}));
    });
  }
  function drawer(root, title, content, trigger) {
    $(root,'.fd-drawer')?.remove();
    const d=node('dialog','fd-drawer',`<header><h2>${esc(title)}</h2>${localButton('Close','close-drawer','btn')}</header><div class="fd-drawer-body">${content}</div>`);
    root.append(d); d.showModal();
    const close=()=>{d.close(); d.remove(); if(trigger?.isConnected) trigger.focus();};
    d.addEventListener('click',e=>{if(e.target.closest('[data-fd="close-drawer"]') || e.target===d)close();});
    d.addEventListener('cancel',e=>{e.preventDefault();close();});
    return d;
  }
  function fixtureState() { return new URLSearchParams(location.search).get('fd-state') || ''; }
  function clearFixture() { const u=new URL(location.href);u.searchParams.delete('fd-state');history.replaceState(history.state,'',u);render(); }
  function wireRetry(root) {root.addEventListener('click',e=>{if(e.target.closest('[data-fd="retry"]'))clearFixture();});}

  /* Original small drawings. Their moving parts use authored contours and held
     exposures, never a whole-illustration bob. The last pose is a quiet rest. */
  const artBodies = {
    door: `<path class="fd-ground" d="M23 188q72-4 145 1m-132 7 105 1"/><path fill="#d7d4c6" d="M49 186 50 26q44-7 89-2l4 163Z"/><path fill="#30352f" d="M58 182 59 35q35-5 70-1l3 149Z"/><path class="fd-door-leaf" fill="#bcd1ca" d="M60 36q29 1 56 4l2 139-58 4Z"/><path class="fd-door-lines" d="m67 47 36 3 1 54-37-2Zm0 67 37 2 1 51-38 3Z"/><path class="fd-door-handle" d="m97 111 9 1m-5-2-.2 5"/><path fill="#f0eee6" d="m75 62 24 1-1 14-22-1Z"/><path stroke-width="1.2" d="m80 68 14 1m-13 4h10"/><path d="m40 30 1 153m106-149 1 149" opacity=".35"/>`,
    card: `<path class="fd-ground" d="M22 160q72 5 148 0"/><path fill="#bcd1ca" d="m27 60 134-3 6 91q-65 8-135 2Z"/><g class="fd-sliding-card"><path fill="#f0eee6" d="M40 40q56-5 110 2l-1 97q-54 5-110-1Z"/><path fill="#f09978" d="m39 40 111 2-.2 15-110-1Z"/><path d="m54 79 30-1m-29 12 73-1m-73 12 62-.5m-63 13 41-.5"/><circle cx="118" cy="73" r="10" fill="#bcd1ca"/></g><path fill="#d1cbb9" d="m31 113 34-1 9 9 91-3 2 30q-65 8-135 2Z"/>`,
    key: `<path class="fd-ground" d="M27 157q65 3 146-1"/><path fill="#f0eee6" d="m34 55 113 3-4 91-114-4Z"/><path d="m48 73 41 1m-42 12 69 2m-70 12 42 1" opacity=".5"/><g class="fd-key"><path fill="#d9b785" d="M92 103q-9-20-26-11-18 10-7 26 11 15 25 4l36 20 8-2-1-8-8-4-4 4-26-15q5-5 3-14Z"/><circle cx="73" cy="105" r="6" fill="#f0eee6"/><path d="m89 119 32 17"/></g><path fill="#bcd1ca" d="m143 56 11-2 2 47-8 12-4-12Z"/>`,
    book: `<path class="fd-ground" d="M19 164q79 7 157-2"/><path fill="#bcd1ca" d="m20 47 76 11 78-10-2 110-77 10-77-12Z"/><path fill="#f0eee6" d="M26 40q39-2 69 14 38-16 72-13l-1 108q-33-3-71 10-34-14-70-12Z"/><path d="M95 54v105"/><g opacity=".5"><path d="m36 62 44 7m-44 7 44 8m-44 9 43 7m-43 9 32 5m35-46 43-8m-43 23 43-8m-43 23 43-7m-43 24 32-7"/></g><path class="fd-bookmark" fill="#f09978" d="m139 43 9-1-1 48-4-5-4 5Z"/>`,
    counter:`<path class="fd-ground" d="M17 172q84 3 160-1"/><path fill="#b9b4a6" d="m29 122 137 1-2 48-133-1Z"/><path fill="#f0eee6" d="M24 111q72-3 147 0l-3 15-143-1Z"/><path fill="#d7d4c6" d="m64 46 65 1-1 57-66 1Z"/><path fill="#bcd1ca" d="m69 52 55 1-1 46-55 1Z"/><path d="m77 66 35 1m-35 12 22 .5"/><g class="fd-bell"><path fill="#d9b785" d="M39 105q1-19 15-19 15 0 15 20Zm14-19v-6m-5 0h11"/></g><path d="m141 106 1-30m-4 0h8"/>`,
    envelope:`<path class="fd-ground" d="M24 164q80 5 147-1"/><path fill="#aa7e65" d="M30 76q66-4 133-1l-2 79-128 1Z"/><path class="fd-envelope-flap" fill="#eab698" d="M31 76q30 22 65 43 36-25 67-44Z"/><g class="fd-mail-sheet"><path fill="#f0eee6" d="M42 72q51-3 108-1l-1 69-106 1Z"/><path d="m55 86 58-1m-58 12 77-.5m-77 13 43-.5" opacity=".55"/><circle fill="#bcd1ca" cx="128" cy="88" r="8"/></g><path fill="#eab698" d="m31 78 65 42 67-44-2 78-128 1Z"/><path d="m36 150 43-36m77 36-43-36"/><path fill="#f0c9aa" d="m32 76 64 43 67-44q-66-3-131 1Z" class="fd-mail-lid"/>`,
    stamp:`<path class="fd-ground" d="M23 166q76 3 149-1"/><path fill="#f0eee6" d="m36 53 115 4-5 102-115-7Z"/><path d="m49 77 66 3m-67 10 42 2m-43 13 58 2" opacity=".45"/><g class="fd-stamp"><path fill="#bcd1ca" d="m95 103 42 2-1 16-44-2Z"/><path fill="#b9b4a6" d="m101 97 31 1 5 7-42-2Z"/><path fill="#d9b785" d="M111 96q-1-8-5-13-5-16 11-16 16 0 11 15-4 7-5 15Z"/></g><path d="m55 134 28 1" stroke="#8d6d58"/>`,
    lock:`<path class="fd-ground" d="M34 166q61 5 128-1"/><path class="fd-lock-shackle" d="M67 93V69q1-33 29-32 31 1 31 34v22" stroke-width="9" stroke="#b9b4a6"/><path fill="#bcd1ca" d="M51 89q47-4 91 0l-1 67q-43 5-89 0Z"/><path fill="#f0eee6" d="M89 114q-6-10 3-13 11-3 13 7 1 4-4 7l3 18-18-.1Z"/><path d="m59 98 2 49" opacity=".4"/>`
  };
  function art(kind, small=false) {
    const body=artBodies[kind]||artBodies.envelope;
    return `<svg class="fd-art ${small?'fd-art-small':''}" data-art="${kind}" viewBox="0 0 196 210" fill="none" stroke="#554e42" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }
  function animateArt(root) {
    if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const drawings=$$(root,'.fd-art');
    drawings.forEach(drawing=>{
      const kind=drawing.dataset.art;
      const subjects={door:'.fd-door-leaf',card:'.fd-sliding-card',key:'.fd-key',book:'.fd-bookmark',counter:'.fd-bell',envelope:'.fd-mail-sheet',stamp:'.fd-stamp',lock:'.fd-lock-shackle'};
      const part=$(drawing,subjects[kind]||'.fd-mail-sheet'); if(!part) return;
      const poses={
        door:['translate(0,0) skewY(0deg)','translate(0,0) skewY(0deg)','translate(3px,-1px) skewY(-2deg)','translate(7px,-2px) skewY(-5deg)','translate(7px,-2px) skewY(-5deg)','translate(3px,-1px) skewY(-2deg)','translate(0,0)'],
        envelope:['translateY(0)','translateY(0)','translateY(-8px)','translateY(-21px)','translateY(-22px)','translateY(-22px)','translateY(-18px)'],
        card:['translateY(0)','translateY(0)','translateY(-5px)','translateY(-14px)','translateY(-14px)','translateY(-11px)','translateY(-11px)'],
        key:['rotate(0deg)','rotate(0deg)','rotate(-4deg)','rotate(2deg)','rotate(2deg)','rotate(-1deg)','rotate(0deg)'],
        book:['translateY(0)','translateY(0)','translateY(-5px)','translateY(-7px)','translateY(-7px)','translateY(-2px)','translateY(0)'],
        counter:['rotate(0deg)','rotate(0deg)','rotate(-4deg)','rotate(3deg)','rotate(-2deg)','rotate(0deg)','rotate(0deg)'],
        stamp:['translateY(-12px)','translateY(-12px)','translateY(-5px)','translateY(0)','translateY(0)','translateY(-4px)','translateY(-4px)'],
        lock:['translateY(0)','translateY(0)','translateY(-3px)','translateY(-10px)','translateY(-10px)','translateY(-6px)','translateY(-6px)']
      };
      const offsets=[0,.18,.32,.48,.65,.82,1];
      const play=()=>{
        if(!drawing.isConnected || part.getAnimations().some(a=>a.playState==='running'))return;
        part.style.transformOrigin=kind==='door'?'60px 36px':'98px 110px';
        part.animate((poses[kind]||poses.envelope).map((transform,i)=>({transform,offset:offsets[i],easing:'steps(1,end)'})),{duration:900,fill:'forwards'});
        if(kind==='envelope') {
          const lid=$(drawing,'.fd-mail-lid');lid?.animate([{opacity:1,offset:0},{opacity:1,offset:.18},{opacity:0,offset:.32},{opacity:0}],{duration:900,fill:'forwards'});
        }
      };
      root.addEventListener('focusin',play,{once:true});
      drawing.addEventListener('pointerenter',play);
      requestAnimationFrame(play);
    });
  }
  function applyAuth({root,page,r,index}) {
    const form=$(root,'#auth-form'); if(!form)return;
    const header=$(root,'.signin-copy > header');
    const mark=header?.querySelector('.wordmark');
    const title={login:'Sign in',forgot:'Reset your password',reset:'Enter your reset code'}[page];
    const intro={login:'Use your GUC email and password.',forgot:'We’ll send a one-time code to your GUC email.',reset:'Use the six-digit code from your email, then choose a new password.'}[page];
    const sampleEmails={normalStudent:'omar.hassan@student.guc.edu.eg',advisingStudent:'omar.hassan@student.guc.edu.eg',advisor:'salma.adel@guc.edu.eg',coordinator:'nadia.ahmed@guc.edu.eg',administrator:'youssef.ali@guc.edu.eg'};
    const primary=$(form,'button[type="submit"]'); primary.classList.add('fd-submit');
    if(page==='login') {
      form.insertAdjacentHTML('afterbegin',`<label>GUC email<input name="email" type="email" autocomplete="username" required placeholder="name@student.guc.edu.eg" spellcheck="false" autocapitalize="none"></label><label>Password<span class="fd-password"><input name="password" type="password" autocomplete="current-password" required>${localButton('Show','show-password','fd-show','aria-label="Show password" aria-pressed="false"')}</span></label>`);
      form.insertAdjacentHTML('beforeend',nativeLink('forgot','Forgot password?','auth-recovery'));
    } else {
      const email=$(form,'input[type=email]');email.placeholder='name@student.guc.edu.eg';email.autocapitalize='none';email.spellcheck=false;
      if(page==='reset') {
        try{email.value=sessionStorage.getItem('portal-front-desk:reset-email')||'';}catch{email.value='';}
        const code=$(form,'input[inputmode=numeric]');code.name='otp';code.id='fd-reset-code';code.setAttribute('aria-describedby','fd-code-help');
        const pass=$(form,'input[name=password]');pass.name='newPassword';pass.maxLength=72;pass.setAttribute('aria-describedby','fd-password-help');
        const shell=node('span','fd-password');pass.replaceWith(shell);shell.append(pass);shell.insertAdjacentHTML('beforeend',localButton('Show','show-password','fd-show','aria-label="Show new password" aria-pressed="false"'));
        form.insertAdjacentHTML('beforeend',nativeLink('forgot','Send another code','auth-recovery'));
      }
    }
    const subtitle=node('p','fd-auth-intro',intro);
    const heading=node('h1','',title);
    const card=node('section','fd-auth-card');card.append(heading,subtitle);
    const feedback=node('div','fd-feedback');feedback.hidden=true;card.append(feedback,form);
    const top=node('header','fd-auth-top');
    const brand=node('div','fd-auth-brand');if(mark)brand.append(mark);
    brand.insertAdjacentHTML('beforeend','<span>German University in Cairo</span>');top.append(brand);
    top.insertAdjacentHTML('beforeend',themeControl());
    const kinds=page==='login'?['door','card','key','book','counter','door','card','counter','book','door']:page==='forgot'?['envelope','stamp','envelope','book','card','card','counter','envelope','book','door']:['key','lock','key','envelope','stamp','lock','book','key','card','book'];
    const picture=node('div','fd-auth-drawing',art(kinds[index-1]));
    let helpHTML=page==='login'?`<h2>Your university account</h2><p>Student addresses end in <span class="fd-nowrap">@student.guc.edu.eg</span>. Staff addresses end in <span class="fd-nowrap">@guc.edu.eg</span>.</p><p>Accounts are provided by the university. There is no sign-up.</p>`:page==='forgot'?`<h2>Before sending</h2><p>Use the address linked to your university account. Keep this page open while you check your email.</p><details><summary>No email arrived?</summary><p>Check spam and the address you entered. You can request a replacement code; only the newest code will work.</p></details>`:`<h2>Keep the newest code</h2><p id="fd-code-help">A code expires after 10 minutes. Requesting another replaces the previous code.</p><p id="fd-password-help">Use at least 8 characters, up to 72 UTF-8 bytes. A successful reset signs out existing sessions.</p>`;
    const help=node('aside','fd-auth-help',helpHTML);help.prepend(picture);
    const layout=node('div','fd-auth-layout');layout.append(card,help);
    const foot=node('footer','fd-auth-foot',`<p>Design preview · no credentials are verified and no email is sent.</p><details><summary>Preview details</summary><p>Use sample details only. Production forms use the existing API.</p>${localButton('Fill sample details','fill-preview','btn')}</details>`);
    root.replaceChildren(top,layout,foot);
    // Ten compositions vary reading order, grouping and disclosure, not the host shell.
    const compositionClasses={
      login:['split','card','key','register','counter','stages','slip','drawer','bookend','quiet'],
      forgot:['split','slip','route','drawer','stages','card','desk','letter','help-first','bookend'],
      reset:['split','stages','columns','letter','receipt','well','bookend','checklist','quiet','register']
    };
    root.dataset.fdComposition=compositionClasses[page][index-1];
    if([3,10].includes(index) && page==='forgot' || index===10 && page==='reset') {
      const step=page==='forgot'?0:1;
      const nav=node('ol','fd-recovery-route', ['GUC email','Email code','New password'].map((label,i)=>`<li ${i===step?'aria-current="step"':''}><span>${i+1}</span>${label}</li>`).join(''));
      layout.prepend(nav);
    }
    if ((page==='login' && [4,8].includes(index)) || page==='forgot' && [4,9].includes(index)) {
      const disclosure=node('details','fd-help-disclosure',`<summary>${page==='login'?'Need help signing in?':'Can’t access your university email?'}</summary><p>${page==='login'?'Check your email address and password. Only active accounts can sign in.':'Password recovery uses the email already on your account. Contact university support to resolve an inaccessible address.'}</p>`);
      card.append(disclosure);
      if(index===8 || index===4) {help.querySelector('details')?.remove();help.querySelectorAll('p').forEach(p=>p.remove());}
    }
    if(page==='reset' && index===8) {
      const checklist=node('ul','fd-password-checks',`<li data-check="length">At least 8 characters</li><li data-check="bytes">No more than 72 UTF-8 bytes</li>`);form.querySelector('input[name=newPassword]').closest('label').after(checklist);
      form.addEventListener('input',()=> {
        const value=$(form,'[name=newPassword]').value;
        $(checklist,'[data-check=length]').dataset.met=String(value.length>=8);
        $(checklist,'[data-check=bytes]').dataset.met=String(value.length>0&&new TextEncoder().encode(value).length<=72);
      });
    }
    const staged=(page==='login'&&index===6)||(page==='forgot'&&index===5)||(page==='reset'&&index===2);
    if(staged) {
      const labels=$$(form,':scope > label');
      const stage=node('div','fd-second-stage'); stage.hidden=true;
      if(page==='login')stage.append(labels[1]);
      if(page==='reset')stage.append(labels[2]);
      if(page==='forgot')stage.insertAdjacentHTML('beforeend','<p>Send the code to <strong class="fd-confirm-address"></strong>?</p>');
      stage.append(primary);stage.insertAdjacentHTML('beforeend',localButton('Back','previous-stage','btn text'));
      const next=node('button','btn fd-continue',page==='forgot'?'Check address':'Continue');next.type='button';next.dataset.fd='next-stage';
      form.insertBefore(next,$(form,'.auth-recovery'));form.insertBefore(stage,$(form,'.auth-recovery'));
      root.addEventListener('click',e=>{
        if(e.target.closest('[data-fd="next-stage"]')){
          const fields=$$(form,':scope > label input');
          const bad=fields.find(f=>!f.reportValidity());if(bad)return;
          if(page==='forgot')$(stage,'.fd-confirm-address').textContent=$(form,'[name=email]').value;
          stage.hidden=false;next.hidden=true;$(stage,'input,button')?.focus();
          root.dataset.fdStage='second';
        }
        if(e.target.closest('[data-fd="previous-stage"]')) {stage.hidden=true;next.hidden=false;next.focus();root.dataset.fdStage='first';}
      });
    }
    if(page==='reset' && index===3) {
      const first=node('div','fd-code-column');const second=node('div','fd-password-column');
      const labels=$$(form,':scope > label'); first.append(...labels.slice(0,2));second.append(...labels.slice(2),primary);
      form.prepend(first,second);
    }
    root.addEventListener('click',e=>{
      const a=e.target.closest('[data-fd]');if(!a)return;
      if(a.dataset.fd==='show-password'){
        const input=a.previousElementSibling;input.type=input.type==='password'?'text':'password';
        const shown=input.type==='text';a.textContent=shown?'Hide':'Show';a.setAttribute('aria-pressed',String(shown));a.setAttribute('aria-label',`${shown?'Hide':'Show'} ${page==='reset'?'new ':''}password`);
      }
      if(a.dataset.fd==='fill-preview') {
        $(form,'[name=email]').value=sampleEmails[r];
        const pass=$(form,'[name=password], [name=newPassword]');if(pass)pass.value='PreviewOnly123!';
        const otp=$(form,'[name=otp]');if(otp)otp.value='123456';
        form.dispatchEvent(new Event('input',{bubbles:true}));$(form,'input')?.focus();
      }
    });
    form.addEventListener('submit',event=> {
      const email=$(form,'[name=email]');
      let error='';
      if(!/^[^@\s]+@(student\.)?guc\.edu\.eg$/i.test(email.value.trim())) error='Use your GUC email: @guc.edu.eg or @student.guc.edu.eg.';
      const pass=$(form,'[name=newPassword]');
      if(pass && new TextEncoder().encode(pass.value).length>72)error='Use a password of no more than 72 UTF-8 bytes.';
      const state=fixtureState();
      if(['invalid','unavailable','expired','pending'].includes(state))error={invalid:page==='login'?'The email or password is incorrect, or the account is inactive.':page==='reset'?'That code is invalid. Check the newest email and try again.':'Check the GUC address and try again.',unavailable:'The service is unavailable. Your entries are still here; try again.',expired:'This code has expired or was replaced. Request another code to continue.',pending:'The request is still pending in this preview state.'}[state];
      if(error) {event.preventDefault();event.stopPropagation();live(card,error,true);return;}
      if(page==='forgot') {try{sessionStorage.setItem('portal-front-desk:reset-email',email.value.trim());}catch{}}
      // A valid submit deliberately bubbles to the original #auth-form handler.
    });
    const state=fixtureState();
    if(state){
      const messages={invalid:page==='login'?'The email or password is incorrect, or the account is inactive.':'The supplied details could not be accepted. Check them and try again.',unavailable:'The account service is unavailable. Retry without losing your place.',expired:'This code has expired or was replaced. Send another code to continue.',pending:'Request pending. No second request has been sent.',resolved:page==='login'?'Password updated. Sign in with your new password.':'Your last request completed. Continue with your university account.'};
      if(messages[state]){live(card,messages[state],!['pending','resolved'].includes(state));feedback.insertAdjacentHTML('beforeend',localButton('Return to working preview','retry','btn text'));}
    }
    wireRetry(root); animateArt(root);
  }
  function applyOverview({root,r,index}) {
    const heading=$(root,'.page-head'); if(!heading)return;
    const pick=(key)=>$(root,'.module-'+key);
    const queue=pick('queue'), review=pick('review'), activity=pick('activity');
    const calendar=pick('calendar') || node('section','work-module module-calendar',deskCalendar(true));
    const parts={queue,review,calendar,activity};
    if(r!=='coordinator'&&queue) {
      const workLink=$(queue,'a[data-page="pending-work"]');
      if(workLink){workLink.dataset.page=isStudent(r)?'my-schedule':'student-schedules';workLink.href=href(workLink.dataset.page);workLink.textContent=isStudent(r)?'My schedule':'All schedules';}
      if(r==='advisor') $$(queue,'.queue-entry').forEach(row=>{if(row.querySelector('[data-icon="advisor-assignment"],[data-icon="group-assignment"]') || /students need an advisor|students need a group/.test(row.textContent)) row.remove();});
      if(r==='administrator') $$(queue,'.queue-entry a').forEach(a=>{if(a.dataset.page==='group-assignments')a.textContent='View groups';});
    }
    if(r==='administrator'&&review) $$(review,'a[data-page="draft-schedule"]').forEach(a=>{a.dataset.page='student-schedules';a.href=href('student-schedules');});
    const scheduleTarget=isStudent(r)?'my-schedule':'student-schedules';
    if(!$(heading,'a[data-page]')) heading.insertAdjacentHTML('beforeend',nativeLink(scheduleTarget,isStudent(r)?'Open my schedule':'Open schedules','quiet-link study-schedule-link'));
    const grid=node('div','fd-overview-layout');
    for(const [key,part] of Object.entries(parts)){if(part){part.dataset.fdPart=key;part.id='fd-overview-'+key;grid.append(part);}}
    root.replaceChildren(heading,grid);
    // All ten choices omit the weekly widget; the native schedule route remains.
    if(index===3) {
      const timeline=unit('Term dates',`<ol class="fd-term-path">${registrationDates.map(([day,month,label,tone])=>`<li data-tone="${tone}"><time>${Number(day)} <span>${month}</span></time><strong>${label}</strong></li>`).join('')}</ol>`,'fd-term-unit',r==='administrator'?nativeLink('terms','Term settings'):'');
      timeline.dataset.fdPart='path';grid.prepend(timeline);
      calendar.hidden=true;
    }
    if(index===2 && review && !isStudent(r)) {
      const files=$$(review,'.draft-file');
      if(files.length) {
        const collection=node('div','fd-review-selector');
        const roster=node('div','fd-review-roster');roster.setAttribute('aria-label','Drafts ready for review');
        const detail=node('div','fd-review-preview');
        const memoryKey=`overview:${r}:review`, selected=stateFor(memoryKey);let current=Math.min(selected.current||0,files.length-1);
        function show(i,focus=false){
          current=i;selected.current=i;
          $$(roster,'button').forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));
          const file=files[i];const name=$(file,'strong').textContent;
          detail.innerHTML=`<span class="fd-meta">${r==='advisor'?'Assigned student':'Advising draft'}</span><h3>${esc(name)}</h3><p>${esc($(file,'small')?.textContent||'')}</p><p class="fd-muted">Open the schedule to inspect courses, preferences and validation before making changes.</p>`;
          const open=file.cloneNode(true);open.className='btn';open.innerHTML='Open schedule '+textIcon('chevron');detail.append(open);
          if(focus)$(roster,`button[data-fd-review="${i}"]`).focus();
        }
        files.forEach((file,i)=>{
          const b=node('button','fd-review-pick',`${avatar($(file,'strong').textContent)}<span><strong>${esc($(file,'strong').textContent)}</strong><small>${esc($(file,'small').textContent)}</small></span>${textIcon('chevron')}`);b.type='button';b.dataset.fdReview=i;b.addEventListener('click',()=>show(i));roster.append(b);
        });
        collection.append(roster,detail);$(review,'.draft-index').replaceWith(collection);show(current);
      }
    }
    if(index===4 && review) {
      review.classList.add('fd-files-first');
      const files=$$(review,'.draft-file');
      files.forEach(file=>{
        const inspect=node('button','fd-file-inspect','Preview');inspect.type='button';inspect.setAttribute('aria-label','Preview '+$(file,'strong').textContent);
        const wrap=node('div','fd-file-wrap');file.replaceWith(wrap);wrap.append(file,inspect);
        inspect.addEventListener('click',()=>drawer(root,$(file,'strong').textContent,`<p>${esc($(file,'small').textContent)}</p><p>This draft is ready for review. Open it to inspect the current course selections and student preferences.</p>${file.outerHTML.replace('draft-file','btn')}`,inspect));
      });
    }
    if(index===5 && activity) {
      activity.classList.add('fd-handover');
      const list=$(activity,'ol');if(list)list.classList.add('fd-event-timeline');
    }
    if(index===6 && queue) {
      const entries=$$(queue,'.queue-entry');
      if(entries.length>1) {
        const switcher=node('div','fd-task-switcher');switcher.setAttribute('role','group');switcher.setAttribute('aria-label','Choose work to focus on');
        const position=stateFor(`overview:${r}:task`);let current=Math.min(position.current||0,entries.length-1);
        const choose=i=>{position.current=i;entries.forEach((entry,j)=>entry.hidden=i!==j);$$(switcher,'button').forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));};
        entries.forEach((entry,i)=>{const b=node('button','btn',esc($(entry,'strong')?.textContent||'Task '+(i+1)));b.type='button';b.addEventListener('click',()=>choose(i));switcher.append(b);});
        $(queue,'.section-head')?.after(switcher);choose(current);
      } else if(isStudent(r)) {
        queue.insertAdjacentHTML('afterbegin','<p class="fd-meta">Next step for your schedule</p>');
      }
    }
    if(index===7 && review) {
      const list=$(review,'.draft-index');
      if(list) {
        list.classList.add('fd-review-register');
        const filter=node('label','fd-search-label',`Find a draft<input type="search" placeholder="Student name" data-fd-search-review>`);$(review,'.section-head').after(filter);
        const count=node('p','fd-result-count');count.setAttribute('role','status');review.append(count);
        const files=$$(list,'.draft-file');
        // Reuse the original links, including each student data attribute.
        filter.addEventListener('input',()=>{const q=$(filter,'input').value.toLowerCase();let visible=0;files.forEach(f=>{f.hidden=!f.textContent.toLowerCase().includes(q);if(!f.hidden)visible++;});count.textContent=visible?`${visible} ${visible===1?'draft':'drafts'} ready for review`:'No matching drafts. Try a different name.';});
        count.textContent=files.length+' drafts ready for review';
      }
    }
    if(index===8 && queue) queue.classList.add('fd-queue-lanes');
    if(index===9) {
      const toc=node('nav','fd-content-index','<p>In this overview</p>');toc.setAttribute('aria-label','On this page');
      for(const [key,part]of Object.entries(parts)){if(part)toc.insertAdjacentHTML('beforeend',`<a href="#fd-overview-${key}">${esc($(part,'h2')?.textContent||key)}</a>`);}
      toc.addEventListener('click',e=>{const a=e.target.closest('a');if(!a)return;e.preventDefault();const dest=$(root,a.getAttribute('href'));dest?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});dest?.setAttribute('tabindex','-1');dest?.focus({preventScroll:true});});
      grid.prepend(toc);
    }
    if(index===10 && activity) {
      const container=node('details','fd-activity-fold','<summary>Recent updates</summary>');activity.replaceWith(container);container.append(activity);container.dataset.fdPart='activity';
    }
    if(!isStudent(r) && [1,3,6,7,8,9,10].includes(index) && review) review.classList.add('fd-compact-review');
    if([1,2,5,6,7,8,9,10].includes(index) && queue) queue.classList.add('fd-compact-queue');
    const state=fixtureState();
    if(['empty','unavailable','pending','resolved'].includes(state)) {
      const status=unit(state==='empty'?'No work waiting':state==='unavailable'?'Work queue unavailable':state==='pending'?'Work awaiting review':'Work completed',`<p>${{empty:'There are no items in this preview queue. Your schedule and term dates remain available.',unavailable:'The queue could not be loaded. You can still use the navigation and retry.',pending:'Submitted requests remain pending until an authorized reviewer records a decision.',resolved:'There are no further actions on this completed request.'}[state]}</p>${localButton('Return to working preview','retry')}`,'fd-status-unit');
      status.dataset.fdPart='queue';queue?.replaceWith(status);
    }
    gateLinks(root,r);wireRetry(root);
  }

  function applyProfile({root,r,index}) {
    const heading=$(root,'.page-head');const personEl=$(root,'.person-title');const originalPanel=$(root,'.panel');const dl=$(originalPanel||root,'dl.details');
    if(!heading||!personEl||!dl)return;
    const rows=new Map($$(dl,':scope > div').map(el=>[$(el,'dt').textContent,el]));
    function set(label,value) {let row=rows.get(label);if(!row){row=node('div','',`<dt>${esc(label)}</dt><dd></dd>`);rows.set(label,row);}$(row,'dd').textContent=value;return row;}
    const emails={coordinator:'nadia.ahmed@guc.edu.eg',administrator:'youssef.ali@guc.edu.eg',advisor:'salma.adel@guc.edu.eg',normalStudent:'omar.hassan@student.guc.edu.eg',advisingStudent:'omar.hassan@student.guc.edu.eg'};
    set('University email',emails[r]);
    if(isStudent(r)) {
      set('Student type',r==='normalStudent'?'Normal':'Advising');set('Academic standing','Good academic standing');
      set('Schedule status',r==='normalStudent'?'Schedule assigned':'Ready for student review');
      if(r==='normalStudent')rows.delete('Assigned advisor');
    }
    const identityKeys=['Full name','University email','Role'];
    const identity=unit('Account details','', 'fd-profile-identity');const identityList=node('dl','details');identity.append(identityList);
    const academic=unit(isStudent(r)?'Academic information':'University role','', 'fd-profile-academic');const academicList=node('dl','details');academic.append(academicList);
    rows.forEach((row,key)=>(identityKeys.includes(key)?identityList:academicList).append(row));
    const security=unit('Account actions',`<p class="fd-muted">Your university manages this information. Account details are read-only.</p><div class="fd-account-links">${localButton('Copy GUC email','copy-email','btn')}${nativeLink('forgot','Reset password','btn')}${nativeButton('Sign out','sign-out','btn')}</div><div class="fd-appearance-row"><span>Appearance</span>${themeControl()}</div>`,'fd-profile-security');
    const layout=node('div','fd-profile-layout');
    const identityHead=node('section','fd-profile-person');identityHead.append(personEl);identityHead.insertAdjacentHTML('beforeend',`<p class="fd-own-account">Your account · ${esc(emails[r])}</p>`);
    const feedback=node('div','fd-feedback');feedback.hidden=true;
    root.replaceChildren(heading,feedback,layout);layout.append(identityHead,identity,academic,security);
    if(index===2){const nav=node('nav','fd-content-index','<p>My information</p>');nav.setAttribute('aria-label','Profile sections');[[identity,'Identity'],[academic,isStudent(r)?'Academic record':'University role'],[security,'Account actions']].forEach(([section,text],i)=>{section.id='fd-profile-section-'+i;nav.insertAdjacentHTML('beforeend',`<a href="#${section.id}">${text}</a>`);});layout.prepend(nav);}
    if(index===3) {
      identityHead.classList.add('fd-university-card');identityHead.insertAdjacentHTML('afterbegin',`<span class="fd-meta">German University in Cairo</span>${art('card',true)}`);
      if(isStudent(r))identityHead.insertAdjacentHTML('beforeend',`<span class="fd-card-id">Student ${esc($(rows.get('Student ID'),'dd')?.textContent)}</span>`);
    }
    if(index===4) {
      const tabsEl=node('div','fd-record-tabs');tabsEl.setAttribute('role','tablist');tabsEl.setAttribute('aria-label','Profile information');
      const sections=[identity,academic,security], labels=['Identity',isStudent(r)?'Academic record':'University role','Account actions'];const record=stateFor(`profile:${r}:record`);
      const choose=(i,focus=false)=>{record.current=i;sections.forEach((section,j)=>{section.hidden=i!==j;section.setAttribute('role','tabpanel');section.id='fd-profile-panel-'+j;section.setAttribute('aria-labelledby','fd-profile-tab-'+j);});$$(tabsEl,'button').forEach((b,j)=>{b.setAttribute('aria-selected',String(i===j));b.tabIndex=i===j?0:-1;});if(focus)tabsEl.children[i].focus();};
      labels.forEach((label,i)=>{const b=node('button','',label);b.type='button';b.id='fd-profile-tab-'+i;b.setAttribute('role','tab');b.setAttribute('aria-controls','fd-profile-panel-'+i);b.addEventListener('click',()=>choose(i));tabsEl.append(b);});
      tabsEl.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.stopPropagation();e.preventDefault();const current=record.current||0;choose(e.key==='Home'?0:e.key==='End'?2:(current+(e.key==='ArrowRight'?1:2))%3,true);});
      identityHead.after(tabsEl);choose(record.current||0);
    }
    if(index===8) {
      const context=unit(isStudent(r)?'Your current semester':'Your workspace',isStudent(r)?`<p class="fd-context-semester">Semester <strong>7</strong></p><p>Computer Engineering · Winter 2026/2027</p>${nativeLink('my-schedule','Open my schedule','btn')}`:`<p>${r==='advisor'?'Review the schedules of students assigned to you.':r==='coordinator'?'Open pending work to review requests requiring a decision.':'Manage academic terms, offerings and account records.'}</p>${nativeLink(r==='advisor'?'advising':r==='coordinator'?'pending-work':'terms',r==='advisor'?'Assigned students':r==='coordinator'?'Pending work':'Academic terms','btn')}`,'fd-profile-context');
      academic.before(context);
    }
    if(index===9) {
      [identity,academic,security].forEach((section,i)=>{const fold=node('details','fd-profile-fold',`<summary>${esc($(section,'h2').textContent)}</summary>`);fold.open=i<2;section.replaceWith(fold);fold.append(section);$(section,'.section-head').remove();});
    }
    if(index===10) {
      const inspector=unit('About this field','<p>Select a field to inspect its meaning.</p>','fd-field-inspector');layout.insertBefore(inspector,security);
      const definitions={'Full name':'Your name as stored on your university account.','University email':'This is the address used for sign-in and password-recovery codes.','Role':'Your role determines the workflows and records you may access.','Student ID':'Your university student identifier.','Student type':'Normal and advising students have different scheduling workflows.','Academic standing':'Your university-recorded academic standing.','Assigned advisor':'The advisor currently assigned to your advising record.','Schedule status':'Calculated from completed scheduling actions, not selected manually.','Semester':'Your current academic semester.','Major':'Your recorded academic major.'};
      rows.forEach((row,key)=>{const dt=$(row,'dt'),value=$(row,'dd').textContent;const b=node('button','fd-field-button',esc(key)+textIcon('chevron'));b.type='button';dt.replaceChildren(b);b.addEventListener('click',()=>{inspector.innerHTML=`<h2>${esc(key)}</h2><p class="fd-field-value">${esc(value)}</p><p>${esc(definitions[key]||'This value is supplied by the university account record.')}</p>`;});});
    }
    root.addEventListener('click',async e=>{
      if(!e.target.closest('[data-fd="copy-email"]'))return;
      try{await navigator.clipboard.writeText(emails[r]);live(root,'GUC email copied.');}catch{live(root,'Copy this address: '+emails[r]);}
    });
    const state=fixtureState();
    if(state==='unavailable')live(root,'Profile data is unavailable in this preview state. No account changes can be made.',true);
    if(state==='empty') {academicList.replaceChildren(node('p','fd-muted','No academic information has been provided. Your university identity is still available.'));}
    if(state==='pending')live(root,'Your university account information is being loaded in this preview state.');
    if(state==='resolved')live(root,'Account information is up to date.');
    if(state){feedback.hidden=false;feedback.insertAdjacentHTML('beforeend',localButton('Return to working preview','retry','btn text'));}
    wireRetry(root);gateLinks(root,r);animateArt(root);
  }
  // Workbook R117–R121 examples, used ONLY in the supplied design preview.
  // The real React adapter imports no fixtures and displays only API records.
  const events={
    scheduleSwapOpened:{title:'A swap group is available',body:'A matching whole-schedule swap is open for Group 4. Review the complete destination schedule before accepting.',topic:'Schedule swaps',route:'schedule-swap',roles:['normalStudent'],status:'Open'},
    scheduleSwapCompleted:{title:'Your group swap is complete',body:'Your whole schedule has moved to the agreed group. Open your schedule to check every lecture, tutorial and lab.',topic:'Schedule swaps',route:'my-schedule',roles:['normalStudent'],status:'Completed'},
    scheduleReadyForReview:{title:'Your schedule is ready to review',body:'Your advisor has completed your draft. Review your assigned courses and meeting times before confirming.',topic:'Your schedule',route:'my-schedule',roles:['advisingStudent'],status:'Ready for student review'},
    slotChangeDecision:{title:'Your slot-change request was reviewed',body:'The requested tutorial change has been approved. Check the current schedule and the recorded response.',topic:'Your schedule',route:'my-schedule',roles:['advisingStudent'],status:'Approved'},
    scheduleProcessed:{title:'Your schedule has been processed',body:'Your processed schedule is available. Open it to view the current weekly arrangement and available export actions.',topic:'Your schedule',route:'my-schedule',roles:['normalStudent','advisingStudent'],status:'Processed'},
    scheduleReopened:{title:'Your schedule has been reopened',body:'Your advisor reopened the schedule with a recorded reason. The draft remains hidden until it is ready for student review again.',topic:'Your schedule',route:'my-schedule',roles:['advisingStudent'],status:'Reopened'},
    extraHoursDecision:{title:'Extra-hours decision recorded',body:'Your request has been approved. Approval alone does not activate the hours; a settlement choice must be confirmed first.',topic:'Extra hours',route:'records',appRoute:'extra-hours',roles:['advisingStudent'],status:'Awaiting payment choice',art:'extra-hours'},
    paymentUpdated:{title:'Payment status updated',body:'A payment update has been recorded for your extra-hours request. Check the payment record before retrying a failed or cancelled attempt.',topic:'Payments',route:'records',appRoute:'extra-hours',roles:['advisingStudent'],status:'Payment recorded'},
    deferredChargeUpdated:{title:'Deferred charge confirmed',body:'The approved charge will be added to the next installment. No wallet or gateway payment has been taken for this deferral.',topic:'Payments',route:'records',appRoute:'extra-hours',roles:['advisingStudent'],status:'Deferred'},
    refundIssued:{title:'Refund recorded',body:'A refund has been issued against your payment. Review the wallet transaction and its reference.',topic:'Payments',route:'records',appRoute:'extra-hours',roles:['advisingStudent'],status:'Refunded'},
    graduationPlanDecision:{title:'Graduation-plan decision recorded',body:'A decision is available for your submitted graduation plan. Only accepted plans are visible in your student plan view.',topic:'Graduation',route:'records',appRoute:'my-graduation',roles:['advisingStudent'],status:'Accepted'},
    exitExamDecision:{title:'Exit-exam decision recorded',body:'The Coordinator has responded to your exit-exam request. Open the graduation workflow for the recorded decision and note.',topic:'Graduation',route:'records',appRoute:'my-graduation',roles:['advisingStudent'],status:'Decision recorded'},
    advisorAssigned:{title:'A student has been assigned to you',body:'Omar Hassan is now on your advising roster. Open assigned students to review the current record and schedule.',topic:'Assignments',route:'advising',roles:['advisor'],status:'Assigned',art:'conversation'},
    slotChangeSubmitted:{title:'Omar submitted a slot-change request',body:'An assigned student requested a different tutorial slot. Review the request and the current schedule before responding.',topic:'Slot changes',route:'student-schedules',appRoute:'slot-changes',roles:['advisor'],status:'Pending',art:'conversation'},
    slotChangeWithdrawn:{title:'Omar withdrew a slot-change request',body:'The student withdrew the pending request. No decision is needed on the withdrawn request.',topic:'Slot changes',route:'student-schedules',appRoute:'slot-changes',roles:['advisor'],status:'Withdrawn',art:'conversation'},
    extraHoursRequested:{title:'Extra-hours request needs a decision',body:'An Advisor submitted a course-specific extra-hours request. Inspect eligibility, requested hours and pricing before deciding.',topic:'Extra hours',route:'pending-work',appRoute:'extra-hours',roles:['coordinator'],status:'Pending',action:true,art:'extra-hours'},
    graduationPlanSubmitted:{title:'Graduation plan submitted',body:'A submitted plan is awaiting Coordinator review. Open the review workflow to examine the plan and prerequisite order.',topic:'Graduation',route:'pending-work',appRoute:'graduation-review',roles:['coordinator'],status:'Pending',action:true,gap:'This event’s Coordinator sender is missing in the supplied audit.'},
    exitExamRequested:{title:'Exit-exam request needs review',body:'A submitted exit-exam request is awaiting a Coordinator decision and response note.',topic:'Graduation',route:'pending-work',appRoute:'graduation-review',roles:['coordinator'],status:'Pending',action:true,gap:'This event’s Coordinator sender is missing in the supplied audit.'},
    mandatoryCourseRemovalRequested:{title:'Course removal requested',body:'Mariam Mostafa requested removal of CSEN 701. Review the academic record and the reason before making a decision.',topic:'Course removals',route:'mandatory-removals',roles:['coordinator'],status:'Pending',action:true,gap:'This event’s Coordinator sender is missing in the supplied audit.'},
    financialReversalRequested:{title:'Financial reversal needs review',body:'A payment reversal request is awaiting review. Check its original transaction and current settlement before responding.',topic:'Payments',route:'financial-records',roles:['coordinator'],status:'Pending',action:true,gap:'This event’s Coordinator sender is missing in the supplied audit.'},
    advisingDeadlineReminder:{title:'An assigned schedule is still open',body:'Review the assigned open schedules before the advising deadline. Schedule status is derived from completed actions.',topic:'Advising deadline',route:'student-schedules',roles:['advisor','coordinator'],status:'Open',action:true,gap:'R121 has no sender or timer in the supplied audit. This is a presentation example, not a delivered reminder.'},
    termUpdated:{title:'Winter dates updated',body:'The registration window opens on 22 November. Open academic terms to inspect the current boundaries.',topic:'Academic terms',route:'terms',roles:['administrator'],status:'Updated'},
    offeringsPublished:{title:'Course offerings published',body:'Published offerings are available for the current academic term.',topic:'Academic setup',route:'offerings',roles:['administrator'],status:'Published'},
    scheduleAudit:{title:'Schedule activity recorded',body:'A schedule processing action is available in the activity log with its staff actor and timestamp.',topic:'Schedule activity',route:'schedule-activity',roles:['administrator'],status:'Recorded'}
  };
  const defaults={normalStudent:['scheduleSwapOpened','scheduleSwapCompleted','scheduleProcessed'],advisingStudent:['scheduleReadyForReview','slotChangeDecision','extraHoursDecision'],advisor:['advisorAssigned','slotChangeSubmitted','slotChangeWithdrawn'],coordinator:['extraHoursRequested','mandatoryCourseRemovalRequested','graduationPlanSubmitted'],administrator:['termUpdated','offeringsPublished','scheduleAudit']};
  function previewEvents(r){
    const types=[...(defaults[r]||defaults.coordinator)];
    const requested=new URLSearchParams(location.search).get('fd-event');
    if(events[requested]?.roles.includes(r))types[0]=requested;
    return types.map((type,i)=>({...events[type],type,id:['schedule','removal','term'][i],time:['Today, 10:42','Today, 09:30','Yesterday, 16:20'][i],day:i===2?'Yesterday':'Today'}));
  }
  function readState(r) {
    const ids=store.json('read:'+r,[]);
    return new Set(Array.isArray(ids)?ids:[]);
  }
  function syncNativeRead(r) {
    const seen=readState(r);
    ['schedule','removal','term'].forEach(id=>{if(seen.has(id))readNotifications.add(id);else readNotifications.delete(id);});
    // Only synchronize the native unread indicator; never replace header controls.
    const bell=document.querySelector('.topactions a[data-page=notifications]');
    if(bell){const dot=$(bell,'.notification-dot');if(seen.size>=3)dot?.remove();else if(!dot)bell.append(node('span','notification-dot'));}
    return seen;
  }
  function noticeDrawing(entry) {
    if(entry.art==='extra-hours')return `<img class="fd-notice-art" src="${new URL('assets/extra-hours-folder.svg',base).href}" alt="" aria-hidden="true">`;
    if(entry.art==='conversation')return `<span class="fd-conversation" data-icon="advisor-assignment">${queueSketch('advisor-assignment')}</span>`;
    return `<span class="notice-symbol">${textIcon(entry.topic.includes('Schedule')?'calendar':entry.topic==='Payments'?'book':'inbox')}</span>`;
  }
  function applyNotifications({root,r,index}) {
    const heading=$(root,'.page-head');const tabsEl=$(root,'.tabs');if(!heading||!tabsEl)return;
    const entries=previewEvents(r),seen=syncNativeRead(r),ui=stateFor(`notifications:${r}:${index}`);
    const state=fixtureState();
    if(state==='read'||state==='resolved')entries.forEach(e=>seen.add(e.id));
    const allUnread=entries.filter(e=>!seen.has(e.id)).length;
    $$(tabsEl,'[data-tab]').forEach(b=>{if(b.dataset.tab==='unread')b.textContent='Unread · '+allUnread;});
    let markAll=$(heading,'[data-action=read-all]');
    if(allUnread&&!markAll){const actions=$(heading,'.actions')||node('div','actions');if(!actions.isConnected)heading.append(actions);actions.insertAdjacentHTML('beforeend',nativeButton('Mark all as read','read-all','btn primary'));}
    if(!allUnread)markAll?.remove();
    const count=node('p','fd-inbox-count');count.setAttribute('role','status');
    const controls=node('div','fd-inbox-controls');controls.append(tabsEl,count);
    const search=node('label','fd-inbox-search',`<span>Search notifications</span><input type="search" placeholder="Title, message or topic" value="${esc(ui.query||'')}">`);
    if([1,2,5,8,9].includes(index))controls.append(search);
    const list=node('div','fd-inbox-layout');
    const feedback=node('div','fd-feedback');feedback.hidden=true;
    root.replaceChildren(heading,feedback,controls,list);
    const footer=node('p','fd-preview-note','Preview records · only events relevant to this role are shown. Opening an update does not mark it as read.');root.append(footer);
    let categories;
    if(index===5) {
      categories=node('div','fd-topic-folders');categories.setAttribute('role','group');categories.setAttribute('aria-label','Notification topic');
      ['All topics',...new Set(entries.map(e=>e.topic))].forEach(topic=>{const b=node('button','',esc(topic));b.type='button';b.dataset.fdTopic=topic;b.setAttribute('aria-pressed',String((ui.topic||'All topics')===topic));categories.append(b);});
      controls.after(categories);
    }
    function readButton(e){return seen.has(e.id)?'<span class="fd-read-label">Read</span>':nativeButton('Mark as read','read-one','btn text',`data-notification="${e.id}" aria-label="Mark ${esc(e.title)} as read"`);}
    function row(e,compact=false){
      return `<article class="inbox-item ${seen.has(e.id)?'read':'unread'}" data-fd-notice="${e.id}">${noticeDrawing(e)}<div class="inbox-text"><div class="fd-notice-topline"><span class="fd-topic">${esc(e.topic)}</span>${!seen.has(e.id)?'<span class="fd-unread-label">Unread</span>':''}</div><h3><button type="button" class="fd-notice-title" data-fd="notice-detail" data-id="${e.id}">${esc(e.title)}</button></h3>${compact?'':`<p>${esc(e.body)}</p>`}<small class="fd-notice-status">${esc(e.status)}${e.gap?' · Preview example':''}</small></div><div class="notification-meta"><time>${e.time}</time>${readButton(e)}</div></article>`;
    }
    function detail(e){
      const destination=routeAllowed(e.route,r)?nativeLink(e.route,e.appRoute?'Open related workspace':'Open '+(e.route==='my-schedule'?'my schedule':e.route==='advising'?'assigned students':e.route==='pending-work'?'pending work':'workspace'),'btn'):'';
      return `<div class="fd-detail-art">${noticeDrawing(e)}</div><p class="fd-meta">${esc(e.topic)} · ${e.time}</p><h3>${esc(e.title)}</h3><p>${esc(e.body)}</p><dl class="fd-record-meta"><div><dt>Status</dt><dd>${esc(e.status)}</dd></div><div><dt>Channel</dt><dd>In-app</dd></div></dl>${e.gap?`<p class="fd-audit-note">${esc(e.gap)}</p>`:''}${e.appRoute?'<p class="fd-muted">Detailed request controls belong to the linked application workflow. This studio shows a read-only event preview.</p>':''}<div class="fd-detail-actions">${destination}${readButton(e)}</div>`;
    }
    function filtered(){let items=entries.filter(e=>tab!=='unread'||!seen.has(e.id));if(ui.topic&&ui.topic!=='All topics')items=items.filter(e=>e.topic===ui.topic);if(ui.query)items=items.filter(e=>(e.title+' '+e.body+' '+e.topic).toLowerCase().includes(ui.query.toLowerCase()));return items;}
    function paint() {
      const items=state==='empty'?[]:filtered();count.textContent=`${items.length} ${items.length===1?'notification':'notifications'} · ${allUnread} unread`;
      list.replaceChildren();
      if(state==='pending') {list.innerHTML='<div class="fd-loading" role="status"><span class="fd-loader" aria-hidden="true"></span>Loading notifications…</div>'+localButton('Return to working preview','retry');list.setAttribute('aria-busy','true');return;}
      if(state==='unavailable'||state==='denied') {list.innerHTML=`<section class="fd-empty"><h2>${state==='denied'?'This record is not available':'Notifications unavailable'}</h2><p>${state==='denied'?'You may only open notifications and records your account is permitted to view.':'Your read state has not changed. Try loading the inbox again.'}</p>${localButton('Retry','retry')}</section>`;return;}
      if(!items.length){list.innerHTML=`<section class="fd-empty">${art('envelope',true)}<h2>${ui.query?'No matching updates':tab==='unread'?'No unread notifications':'No notifications yet'}</h2><p>${ui.query?'Try another title or topic.':'New events for your account will appear here.'}</p>${ui.query?localButton('Clear search','clear-search'):''}${tab==='unread'?'<button class="btn" type="button" data-tab="all">All notifications</button>':''}${state?localButton('Return to working preview','retry'):''}</section>`;return;}
      if(index===2||index===10) {
        const chosen=items.find(e=>e.id===ui.selected)||items[0];ui.selected=chosen.id;
        const roster=node('div','fd-notice-roster');roster.setAttribute('aria-label','Choose a notification');
        roster.innerHTML=items.map(e=>`<button type="button" class="fd-notice-pick" data-fd="pick-notice" data-id="${e.id}" aria-pressed="${chosen.id===e.id}"><span>${seen.has(e.id)?'Read':'Unread'} · ${e.time}</span><strong>${esc(e.title)}</strong><small>${esc(e.topic)}</small></button>`).join('');
        const pane=node('section','fd-reading-pane',detail(chosen));pane.setAttribute('aria-label','Selected notification');list.append(roster,pane);
        if(index===10) {const position=items.indexOf(chosen);pane.insertAdjacentHTML('beforeend',`<div class="fd-next-notice">${localButton('Previous','previous-notice','btn',position===0?'disabled':'')}<span>${position+1} of ${items.length}</span>${localButton('Next','next-notice','btn',position===items.length-1?'disabled':'')}</div>`);}
      } else if([3,4,6,7,9].includes(index)) {
        const groupKey=index===4?e=>e.action?'Needs a decision':'Updates':index===6?e=>seen.has(e.id)?'Read':'Unread':index===9?e=>e.topic:e=>e.day;
        const groups=new Map();items.forEach(e=>{const key=groupKey(e);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);});
        groups.forEach((group,label)=>{const groupEl=node(index===7?'details':'section','fd-notice-group',index===7?`<summary>${esc(label)} <span>${group.length}</span></summary>`:`<h2>${esc(label)}</h2>`);if(index===7)groupEl.open=true;groupEl.insertAdjacentHTML('beforeend',group.map(e=>row(e,index===7)).join(''));list.append(groupEl);});
      } else list.innerHTML=items.map(e=>row(e,index===8)).join('');
    }
    paint();
    if(['read','resolved'].includes(state))footer.insertAdjacentHTML('beforeend',' '+localButton('Return to working preview','retry','btn text'));
    if(r==='advisingStudent') {
      const delivery=new URLSearchParams(location.search).get('fd-delivery')||'sent';
      const label={sent:'Email sent',failed:'Email delivery failed',pending:'Email pending'}[delivery]||'Email status unavailable';
      const mail=node('details','fd-email-record',`<summary>${textIcon('inbox')}<span>Probation warning <small>Email only · ${label} · preview example</small></span></summary><div><p>This warning is sent to your GUC email after two consecutive completed probation semesters. It is not an inbox decision or a mark-as-read action.</p><blockquote>If you do not leave probation in the following semester, you may be exposed to termination from the university.</blockquote><p>${delivery==='failed'?'Delivery failed. The backend retries eligible warnings; this page cannot send email.':delivery==='pending'?'Delivery is pending. This is not confirmation of successful delivery.':'The preview shows the sent state. Actual delivery requires the configured email service.'}</p></div>`);root.append(mail);
    }
    root.addEventListener('input',e=>{if(e.target.closest('.fd-inbox-search')){ui.query=e.target.value;paint();}});
    root.addEventListener('click',e=>{
      const topic=e.target.closest('[data-fd-topic]');if(topic){ui.topic=topic.dataset.fdTopic;$$(categories,'button').forEach(b=>b.setAttribute('aria-pressed',String(b===topic)));paint();return;}
      const native=e.target.closest('[data-action="read-one"],[data-action="read-all"]');
      if(native){
        const actual=readState(r);if(native.dataset.action==='read-all')entries.forEach(entry=>actual.add(entry.id));else actual.add(native.dataset.notification);
        store.set('read:'+r,JSON.stringify([...actual]));actual.forEach(id=>readNotifications.add(id));
        queueMicrotask(()=>document.querySelector('#content .tabs [aria-selected=true]')?.focus({preventScroll:true}));
        // Existing read-one/read-all handlers own the rerender and toast.
        return;
      }
      const action=e.target.closest('[data-fd]');if(!action)return;const id=action.dataset.id;
      if(action.dataset.fd==='notice-detail'){const entry=entries.find(n=>n.id===id);if(entry)drawer(root,entry.title,detail(entry),action);}
      if(action.dataset.fd==='pick-notice'){ui.selected=id;paint();$(list,`[data-fd="pick-notice"][data-id="${id}"]`)?.focus({preventScroll:true});}
      if(action.dataset.fd==='clear-search'){ui.query='';$(search,'input').value='';paint();$(search,'input').focus();}
      if(['previous-notice','next-notice'].includes(action.dataset.fd)){
        const items=filtered(),current=items.findIndex(n=>n.id===ui.selected),direction=action.dataset.fd==='next-notice'?1:-1;ui.selected=items[Math.max(0,Math.min(items.length-1,current+direction))].id;paint();$(list,'.fd-reading-pane h3')?.setAttribute('tabindex','-1');$(list,'.fd-reading-pane h3')?.focus();
      }
    });
    wireRetry(root);gateLinks(root,r);
  }

  function apply(root,page,r,index){
    root.dataset.fdPage=page;root.dataset.fdVariant=String(index);
    appearance(root);focusPicker(root);
    if(!['login','forgot','reset'].includes(page))syncNativeRead(r);
    const context={root,page,r,index};
    if(['login','forgot','reset'].includes(page))applyAuth(context);
    else if(page==='overview')applyOverview(context);
    else if(page==='profile')applyProfile(context);
    else if(page==='notifications')applyNotifications(context);
  }
  // Merge only owned page keys. Never replace the host registry or another team.
  window.portalVariants ||= Object.create(null);
  for(const [page,choices]of Object.entries(names)){
    window.portalVariants[page]=choices.map((name,i)=>({name,apply:({root,role})=>apply(root,page,role,i+1)}));
  }
})();
