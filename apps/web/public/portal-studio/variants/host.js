window.portalVariants = Object.create(null);
function attachPageDesign(page, role, render) {
  const choices = window.portalVariants[page];
  if (!choices?.length) return;
  const root = document.querySelector('#content') || document.querySelector('#app');
  const wrap = document.createElement('label');
  wrap.textContent = 'Page design ';
  wrap.style.cssText='display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:6px 12px;font:inherit';
  const select = document.createElement('select');
  select.add(new Option('Original', '0'));
  choices.forEach((v,i)=>select.add(new Option(v.name,String(i+1))));
  const key='portal-page-design:'+page;
  select.value=localStorage.getItem(key)||'0';
  const choice=choices[Number(select.value)-1];
  choice?.apply({root,page,role});
  wrap.append(select);root.prepend(wrap);
  select.onchange=()=>{localStorage.setItem(key,select.value);render();};
}
