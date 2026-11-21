const academicScript=document.currentScript;
const academicBase=new URL('.',academicScript?.src||location.href);
if(!document.querySelector('link[data-academic-setup]')){const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('styles.css',academicBase).href;css.dataset.academicSetup='';document.head.append(css);}
window.portalVariants ||= Object.create(null);
for(const [page,names] of Object.entries(choiceNames))window.portalVariants[page]=names.map((name,index)=>({name,apply:context=>applyAcademic(context,index)}));
// A deliberately small diagnostic surface, with no auth or API override.
window.portalAcademicSetup=Object.freeze({version:'2.0.0',pages:Object.keys(choiceNames),requirements,storageKey:storeKey});
