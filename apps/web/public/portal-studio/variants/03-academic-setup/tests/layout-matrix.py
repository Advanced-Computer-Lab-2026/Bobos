#!/usr/bin/env python3
"""Exercise every studio choice in both existing themes and four viewport widths.
Screenshots are viewport evidence, not stitched content. Source host/sidebar stays mounted.
"""
import argparse,json,time
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--base',default='http://127.0.0.1:8000');p.add_argument('--browser',default='/usr/bin/chromium');p.add_argument('--out',type=Path,default=Path(__file__).parent.parent/'evidence');a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
pages=['terms','courses','course-detail','offerings','copy-offerings','templates','template-detail','group-assignments']
roles={k:('coordinator' if k in ['templates','template-detail','group-assignments'] else 'administrator') for k in pages}
results=[];failures=[];js=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=a.browser,headless=True,args=['--no-sandbox']);ctx=b.new_context(reduced_motion='reduce');page=ctx.new_page();page.set_default_timeout(5000);page.on('pageerror',lambda e:js.append(str(e)))
 page.goto(a.base+'/portal-studio/index.html?preview=live&role=administrator');page.locator('#auth-form button').click()
 # Adjacent submissions are sentinel registrations. The academic adapter must not overwrite them.
 page.evaluate('window.portalVariants["integration-sibling"]=[{name:"Sibling sentinel",apply:()=>{}}]')
 for width in [1440,1024,768,390]:
  page.set_viewport_size({'width':width,'height':1000 if width>768 else 844})
  for mode in ['dark','light']:
   page.evaluate('(dark)=>{lab.dark=dark;applyLook()}',mode=='dark')
   for key in pages:
    page.evaluate('([key,roleName])=>{role=roleName;navigate(key)}',[key,roles[key]])
    for variant in range(1,11):
     page.locator('#content>label>select').select_option(str(variant));page.locator('.as-root').wait_for()
     checks=page.evaluate('''()=>{const s=document.querySelector('.as-root'),host=document.querySelector('#content>label>select'),main=document.querySelector('main');return {oneSelector:document.querySelectorAll('#content>label>select').length===1,elevenOptions:host.options.length===11,variant:host.value,shellPage:s.dataset.asPage,heading:!!s.querySelector('h1'),bodyFits:document.documentElement.scrollWidth<=innerWidth+1,contentFits:s.getBoundingClientRect().right<=innerWidth+1,sidebar:innerWidth>1000?Math.round(document.querySelector('.sidebar').getBoundingClientRect().width):null,header:Math.round(document.querySelector('.topbar').getBoundingClientRect().height),sibling:window.portalVariants['integration-sibling'][0].name==='Sibling sentinel',errors:!!s.querySelector('.as-notice.is-error')};}''')
     bad=[n for n in ['oneSelector','elevenOptions','heading','bodyFits','contentFits','sibling'] if not checks[n]]
     if checks['shellPage']!=key or checks['variant']!=str(variant):bad.append('wrongPageOrChoice')
     if width==1440 and (checks['sidebar']!=224 or checks['header']!=48):bad.append('shellDimensions')
     # Each search must remain operable rather than becoming ornamental in a layout.
     search=page.locator('.as-root input[data-as-field=query]')
     if search.count():
      search.fill('zzzz-no-such-academic-record');
      if page.locator('.as-empty').count()!=1:bad.append('searchEmpty')
      search.fill('')
     if key=='copy-offerings':
      checkboxes=page.locator('.as-root input[data-as-check]')
      if not checkboxes.count():bad.append('noTransferSelection')
      else:
       box=checkboxes.filter(visible=True).first if False else checkboxes.first
       # Hidden folded sections still provide at least one visible first row.
       box.set_checked(False);box.set_checked(True)
     if width==1440 and mode=='dark' or width==390 and mode=='light':
      dest=a.out/'layouts'/f'{width}-{mode}';dest.mkdir(parents=True,exist_ok=True)
      page.locator('#content').evaluate('(e)=>{e.scrollTop=0}');page.screenshot(path=str(dest/f'{key}-{variant:02}.png'))
     case={'page':key,'variant':variant,'width':width,'mode':mode,'passed':not bad,'checks':checks,'failures':bad};results.append(case)
     if bad:failures.append(case);print('FAIL',key,variant,width,mode,bad,flush=True)
    # Original uses original renderer with the academic scope absent.
    page.locator('#content>label>select').select_option('0')
    if page.locator('.as-root').count():failures.append({'page':key,'width':width,'mode':mode,'failures':['OriginalStillAdapted']})
   print('FINISHED',width,mode,flush=True)
 b.close()
report={'suite':'layout-matrix','base':a.base,'cases':len(results),'passed':sum(r['passed'] for r in results),'originalChecks':64,'failed':len(failures),'javascriptErrors':js,'results':results,'failures':failures}
(a.out/'layout-matrix.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ['cases','passed','failed','originalChecks','javascriptErrors']}),flush=True)
raise SystemExit(1 if failures or js else 0)
