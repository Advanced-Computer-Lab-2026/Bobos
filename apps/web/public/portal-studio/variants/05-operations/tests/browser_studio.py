from pathlib import Path
from playwright.sync_api import sync_playwright
import urllib.request,json,os
BASE=os.environ.get('OPS05_STUDIO_BASE','http://127.0.0.1:8000/portal-studio/').rstrip('/')+'/'
HERE=Path(__file__).resolve().parent;OUT=HERE/'reports';OUT.mkdir(exist_ok=True);EV=HERE.parent/'evidence'
html=urllib.request.urlopen(BASE+'index.html?preview=live').read().decode()
shim=f'''<base href="{BASE}"><script>window.__store={{}};Object.defineProperty(window,'localStorage',{{value:{{getItem:k=>__store[k]??null,setItem:(k,v)=>__store[k]=String(v),removeItem:k=>delete __store[k]}}}});history.pushState=history.replaceState=()=>{{}};</script>'''
checks=[];functional=[];errors=[]
def record(name,passed,**details):
 functional.append({'name':name,'passed':bool(passed),**details})
 assert passed,(name,details)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce');page.set_default_timeout(4500);page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html.replace('<head>','<head>'+shim),wait_until='networkidle');page.get_by_role('button',name='Sign in',exact=True).click();page.wait_for_timeout(150)
 record('Original preview sign-in returns Overview',page.evaluate('page')=='overview')
 # Read-only witness registrations stand in for the four independently owned folders.
 page.evaluate('window.__siblingChoices=[{name:"Sibling witness",apply(){}}];for(const k of ["overview","my-courses","offerings","advising"])window.portalVariants[k]=window.__siblingChoices;')
 # Re-load only our plugin; this must neither replace registry nor overwrite sibling keys.
 page.add_script_tag(url=BASE+'variants/05-operations/pages.js')
 record('Coexists with four sibling registry entries',page.evaluate('["overview","my-courses","offerings","advising"].every(k=>window.portalVariants[k]===window.__siblingChoices)'))
 page.evaluate('for(const k of ["overview","my-courses","offerings","advising"])delete window.portalVariants[k]')
 for mode in ['light','dark']:
  page.evaluate('(dark)=>{lab.dark=dark;applyLook();navigate("overview")}',mode=='dark');page.wait_for_timeout(400);page.screenshot(path=str(EV/f'studio-overview-1440-{mode}.png'))
 for key in ['pending-work','schedule-activity','financial-records']:
  page.evaluate('(k)=>navigate(k)',key)
  for width,mode in [(1440,'light'),(1440,'dark'),(390,'light'),(390,'dark')]:
   page.set_viewport_size({'width':width,'height':1000 if width>500 else 844});page.evaluate('(dark)=>{lab.dark=dark;applyLook()}',mode=='dark')
   for v in range(11):
    page.locator('#content > label select').select_option(str(v));page.wait_for_timeout(12)
    data=page.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,dropdown:document.querySelectorAll("#content > label select").length,sidebar:document.querySelectorAll(".sidebar").length})')
    checks.append({'page':key,'width':width,'theme':mode,'variant':v,'overflow':data['scroll']-width,'dropdown':data['dropdown'],'sidebar':data['sidebar']})
   page.locator('#content > label select').select_option('7' if key!='schedule-activity' else '5');page.screenshot(path=str(EV/f'studio-{key}-{width}-{mode}.png'))
  page.set_viewport_size({'width':1440,'height':1000});page.locator('#content > label select').select_option('4');page.evaluate('navigate("overview")');page.evaluate('(k)=>navigate(k)',key)
  record(key+' choice survives away/back',page.locator('#content > label select').input_value()=='4')
  record(key+' single host dropdown',page.locator('#content > label select').count()==1)
  page.locator('#ops05-search').fill('no-such-person-812');record(key+' empty search',page.get_by_text('No matching records',exact=True).count()==1)
  page.get_by_role('button',name='Clear filters',exact=True).click();record(key+' clear restores records','0 of' not in page.locator('.ops05-count').inner_text()[:5])
  page.get_by_label('From date',exact=True).fill('2026-11-20');page.get_by_label('Through date',exact=True).fill('2026-11-01');record(key+' invalid date range',page.locator('.ops05-feedback').inner_text()=='End date must not precede start date.')
  page.get_by_role('button',name='Clear filters',exact=True).click()
  page.locator('#content > label select').select_option('6');boxes=page.locator('.ops05-compare-pick input');record(key+' compare initial checked',boxes.nth(0).is_checked() and boxes.nth(1).is_checked());boxes.nth(0).click();boxes.nth(1).click();record(key+' compare empty selection honest',page.get_by_text('Choose records above to compare.',exact=True).count()==1)
  if key!='pending-work':
   page.locator('#content > label select').select_option('1');page.locator('#ops05-search').fill('Omar')
   with page.expect_download() as d:page.get_by_role('button',name='Export CSV',exact=True).click()
   data=Path(d.value.path()).read_text(encoding='utf-8-sig');record(key+' CSV contains filtered record','Omar' in data);record(key+' CSV excludes unrelated sample','Farah' not in data)
   page.get_by_role('button',name='Clear filters',exact=True).click()
  if key=='financial-records':
   page.get_by_role('button',name='View record',exact=True).first.click();record('Financial preview details use host dialog',page.locator('dialog[open]').count()==1);page.get_by_role('button',name='Close',exact=True).first.click();record('Host modal returns focus',page.evaluate('document.activeElement.textContent.trim()')=='View record')
  page.locator('#content > label select').select_option('7')
 # Independent values, followed by actual supplied account menu/logout/login.
 page.evaluate('navigate("pending-work")');page.locator('#content > label select').select_option('2');page.evaluate('navigate("schedule-activity")');page.locator('#content > label select').select_option('5');page.evaluate('navigate("financial-records")');page.locator('#content > label select').select_option('9')
 record('Independent page storage values',page.evaluate('["pending-work","schedule-activity","financial-records"].map(k=>localStorage.getItem("portal-page-design:"+k)).join(",")')=='2,5,9')
 page.locator('.account-button').click();page.get_by_role('button',name='Sign out',exact=True).click();record('Original sign-out returns login',page.evaluate('page')=='login');page.get_by_role('button',name='Sign in',exact=True).click();record('Sign-in returns approved Overview',page.evaluate('page')=='overview');page.evaluate('navigate("financial-records")');record('Choice survives sign-out/sign-in',page.locator('#content > label select').input_value()=='9')
 page.evaluate('role="advisingStudent";navigate("calendar-sync")');previous=page.evaluate('connected');page.locator('[data-action="toggle-calendar"]').click();current=page.evaluate('connected');page.evaluate('navigate("overview");navigate("calendar-sync")');record('Calendar state survives navigation',page.evaluate('connected')==current and previous!=current)
 page.evaluate('role="coordinator";navigate("pending-work")');page.locator('#content > label select').select_option('1');links=page.locator('.ops05-shortcuts [data-page]');dest=links.first.get_attribute('data-page');links.first.click();record('Original work queue link navigates',page.evaluate('page')==dest)
 # Explicitly invoke owned permission checks: do not rely on a page being absent from sidebar.
 for key in ['pending-work','schedule-activity','financial-records']:
  denied=page.evaluate('k=>{const root=document.createElement("div");window.portalVariants[k][0].apply({root,page:k,role:"normalStudent"});return root.textContent.includes("not available to your role")}',key)
  record(key+' unauthorized role guard',denied)
 b.close()
report={'environment':'Fresh original baseline + folder copy; HTTP-fed Chromium harness; in-memory storage; history no-op. Native origin/reload behavior not certified.','layoutChecks':checks,'functionalChecks':functional,'browserErrors':errors,'overflows':[c for c in checks if c['overflow']>1]}
(OUT/'studio-final-report.json').write_text(json.dumps(report,indent=2));print('LAYOUT',len(checks),'FUNCTIONAL',len(functional),'ERRORS',errors,'OVERFLOWS',report['overflows'])
