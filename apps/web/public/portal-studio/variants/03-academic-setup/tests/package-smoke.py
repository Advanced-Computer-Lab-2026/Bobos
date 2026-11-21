#!/usr/bin/env python3
"""Recheck the installed bundle after ZIP extraction. Requires the original Portal host."""
import argparse,json,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--base',default='http://127.0.0.1:8000');p.add_argument('--browser',default='/usr/bin/chromium');p.add_argument('--out',type=Path,default=Path(__file__).parent.parent/'evidence');a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
bundle=Path(__file__).parent.parent;m=json.loads((bundle/'manifest.json').read_text());checks=[]
def check(name,value):
 checks.append({'name':name,'passed':bool(value)})
 if not value:raise AssertionError(name)
# Runtime dependency files, not private test/install tooling, must resolve locally.
assets=['pages.js','styles.css']+[str(p.relative_to(bundle)) for p in (bundle/'assets').rglob('*') if p.is_file()]
for rel in assets:
 with urllib.request.urlopen(a.base+'/portal-studio/variants/03-academic-setup/'+rel,timeout=8) as response:
  check('Local runtime file: '+rel,response.status==200 and response.read()==(bundle/rel).read_bytes())
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=a.browser,headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce');errors=[];failed=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failed.append(r.url));page.goto(a.base+'/portal-studio/index.html?preview=live&role=administrator');page.locator('#auth-form button').click()
 for spec in m['pages']:
  key=spec['key'];page.evaluate('([key,roleName])=>{role=roleName;navigate(key)}',[key,spec['writeRole']])
  names=page.evaluate('(key)=>portalVariants[key].map(v=>v.name)',key)
  check(key+' / manifest agrees with ten registrations',names==[v['name'] for v in spec['variants']])
  for v in spec['variants']:
   page.locator('#content>label>select').select_option(str(v['id']));check(f"{key} / choice {v['id']} renders",page.locator('.as-root h1').count()==1)
  page.locator('#content>label>select').select_option('0');check(key+' / Original has no adapter scope',page.locator('.as-root').count()==0)
 page.set_viewport_size({'width':390,'height':844});page.evaluate('role="coordinator";navigate("template-detail")');page.locator('#content>label>select').select_option('1');week=page.locator('.as-week').first;week.focus();page.keyboard.press('ArrowRight');page.wait_for_timeout(150);check('Narrow timetable supports native keyboard horizontal scrolling',week.evaluate('(e)=>e.scrollLeft')>0);check('Local scrolling does not widen the page',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
 check('No unhandled JavaScript errors',not errors);check('No failed browser requests',not failed);version=b.version;b.close()
report={'suite':'package-smoke','base':a.base,'browser':version,'passed':len(checks),'failed':0,'javascriptErrors':errors,'failedRequests':failed,'cases':checks};(a.out/'package-smoke.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['passed','failed','javascriptErrors','failedRequests']}))
