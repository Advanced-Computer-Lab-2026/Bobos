"""Browser checks for the supplied Portal Studio (not backend authentication).
Run after copying this folder into a freshly extracted baseline and serving its
apps/web/public directory: python browser-check.py --base http://localhost:8000
Requires Python Playwright and a Chromium browser. No npm/build step is used.
"""
from __future__ import annotations
import argparse,json,os,time
from pathlib import Path
from playwright.sync_api import sync_playwright

PAGES=['overview','login','forgot','reset','profile','notifications']
ROLES=['normalStudent','advisingStudent','advisor','coordinator','administrator']
STATES={'overview':['empty','unavailable','pending','resolved'],'login':['invalid','unavailable','pending','resolved'],
 'forgot':['invalid','unavailable','pending','resolved'],'reset':['invalid','expired','unavailable','pending','resolved'],
 'profile':['empty','unavailable','pending','resolved'],'notifications':['empty','unavailable','pending','denied','read','resolved']}

def run(base: str, output:Path, screenshots:bool=True):
 output.mkdir(parents=True,exist_ok=True)
 result={'base':base,'environment':{},'render_checks':[],'role_checks':[],'state_checks':[],'action_checks':[],'flow_checks':[], 'errors':[], 'failures':[]}
 start=time.monotonic()
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  result['environment']={'chromium':browser.version,'viewport_desktop':'1440x1000','viewport_mobile':'390x844'}
  page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
  page.set_default_timeout(5000)
  page.on('pageerror', lambda e:result['errors'].append(str(e)))
  page.goto(base+'/portal-studio/index.html?preview=live')
  page.wait_for_function('window.portalVariants?.overview?.length===10')
  assert all(page.evaluate('(key)=>window.portalVariants[key]?.length',key)==10 for key in PAGES), 'Each owned registry needs ten choices'
  # Native preview fixtures are selected only for deterministic test setup.
  def setup(key,design=1,role='coordinator',state='',event='',delivery=''):
   page.evaluate('''({key,design,role: r,state,event,delivery})=>{
    localStorage.setItem('portal-studio-preview-session','1');
    localStorage.setItem('portal-page-design:'+key,String(design));
    role=r; navigate(key); const url=new URL(location.href);
    for(const [k,v] of Object.entries({'fd-state':state,'fd-event':event,'fd-delivery':delivery})){if(v)url.searchParams.set(k,v);else url.searchParams.delete(k)}
    history.replaceState({},'',url);render();
   }''',{'key':key,'design':design,'role':role,'state':state,'event':event,'delivery':delivery})
  def check(condition,label):
   if not condition:result['failures'].append(label)
   return bool(condition)
  def geometry():
   return page.evaluate('''()=>({document:document.documentElement.scrollWidth<=innerWidth+1,content:document.querySelector('#content').scrollWidth<=document.querySelector('#content').clientWidth+1, workspace:!document.querySelector('.workspace')||document.querySelector('.workspace').scrollWidth<=document.querySelector('.workspace').clientWidth+1})''')
  def select(key,design):
   page.locator('#content > label select').select_option(str(design))
   page.wait_for_function('([key,design])=>document.querySelector("#content")?.dataset.fdPage===key&&document.querySelector("#content")?.dataset.fdVariant===String(design)',arg=[key,design])
  def sample():
   details=page.locator('.fd-auth-foot details');details.locator('summary').click()
   page.locator('[data-fd="fill-preview"]').click()
   step=page.locator('[data-fd="next-stage"]')
   if step.count() and step.is_visible():step.click()
  # Every design in both viewport sizes and both inherited color modes.
  for size,width,height in [('desktop',1440,1000),('mobile',390,844)]:
   page.set_viewport_size({'width':width,'height':height})
   for mode in ['light','dark']:
    page.evaluate('(mode)=>{localStorage.removeItem("portal-front-desk:appearance");lab.dark=mode==="dark";applyLook()}',mode)
    for key in PAGES:
     setup(key,0)
     for design in range(1,11):
      select(key,design)
      page.wait_for_timeout(75)
      shape=geometry();record={'page':key,'design':design,'size':size,'mode':mode,**shape}
      result['render_checks'].append(record)
      check(all(shape.values()),f'overflow {key}/{design}/{size}/{mode}: {shape}')
      check(page.locator('#content > label select').count()==1,f'exactly one native selector: {record}')
      if key=='overview':check(page.locator('.module-week').count()==0,'weekly widget omitted '+str(record))
      if screenshots:
       # Capture the viewport, without pretending the fixed native workspace is a full document.
       target=output/'screenshots'/f'{key}-{design:02}-{size}-{mode}.png';target.parent.mkdir(exist_ok=True)
       page.screenshot(path=str(target))
  # All five role renderers × all sixty designs, including staff/student profile rules.
  page.set_viewport_size({'width':1440,'height':1000})
  for r in ROLES:
   for key in PAGES:
    for design in range(1,11):
     setup(key,design,r);shape=geometry()
     check(all(shape.values()),f'role overflow {key}/{design}/{r}: {shape}')
     if key=='profile':
      text=page.locator('#content').inner_text()
      # Inspect DOM as some profile variants use tabs/disclosures.
      dom=page.locator('#content').text_content()
      if r.endswith('Student'):check('Student type' in dom and 'Academic standing' in dom,f'student profile fields {r}/{design}')
      else:check('Student type' not in dom,f'no student fields on staff profile {r}/{design}')
     if r!='coordinator':check(page.locator('#content a[data-page="pending-work"]').count()==0,f'pending role boundary {r}/{key}/{design}')
     result['role_checks'].append({'page':key,'design':design,'role':r,**shape})
  # Applicable state fixtures are URL-only, never production responses or senders.
  for key,states in STATES.items():
   for state in states:
    for design in range(1,11):
     setup(key,design,'coordinator',state)
     shape=geometry();check(all(shape.values()),f'state overflow {key}/{design}/{state}')
     check(page.evaluate('new URL(location.href).searchParams.get("fd-state")')==state,f'fixture URL {key}/{design}/{state}')
     check(page.locator('#content [data-fd-page]').count()==0,'no nested page roots')
     retry=page.locator('[data-fd="retry"]')
     check(retry.count()>0,f'reversible state {key}/{design}/{state}')
     if retry.count():
      retry.first.click()
      check(page.evaluate('new URL(location.href).searchParams.get("fd-state")') is None,f'retry clears only fixture {key}/{design}/{state}')
     result['state_checks'].append({'page':key,'design':design,'state':state,'retry_checked':True,**shape})
  # Native action paths in each design, rather than DOM-only rendering.
  for key in PAGES:
   for design in range(1,11):
    try:
     page.evaluate('''()=>{localStorage.removeItem('portal-front-desk:read:coordinator');readNotifications.clear()}''')
     setup(key,design)
     if key=='overview':
      page.locator('#content a[data-page="student-schedules"]').first.click()
      assert page.evaluate('page')=='student-schedules'
     elif key in ['login','forgot','reset']:
      sample();page.locator('#auth-form button[type="submit"]').click()
      assert page.evaluate('page')=={'login':'overview','forgot':'reset','reset':'login'}[key]
     elif key=='profile':
      # Native recovery action is accessible even behind tabs / folded sections.
      if design==4:page.get_by_role('tab',name='Account actions',exact=True).click()
      if design==9:page.locator('.fd-profile-fold').last.locator('summary').click()
      page.locator('#content a[data-page="forgot"]').click()
      assert page.evaluate('page')=='forgot'
     else:
      page.locator('[data-action="read-one"]').first.click()
      assert len(json.loads(page.evaluate('localStorage.getItem("portal-front-desk:read:coordinator")')))==1
     result['action_checks'].append({'page':key,'design':design,'passed':True})
    except Exception as e:
     result['action_checks'].append({'page':key,'design':design,'passed':False,'error':str(e)})
     result['failures'].append(f'action {key}/{design}: {e}')
  # Independent selection survives navigation and the host's native session flow.
  try:
   setup('overview',1);select('overview',7)
   page.locator('a[data-page="notifications"]').first.click();select('notifications',2)
   page.locator('a[data-page="overview"]').first.click()
   assert page.locator('#content > label select').input_value()=='7'
   page.locator('.account-button').click();page.get_by_role('link',name='My profile',exact=True).click();select('profile',4)
   page.locator('.account-button').click();page.locator('#account-menu [data-action="sign-out"]').click()
   assert page.evaluate('page')=='login'
   select('login',1);sample();page.locator('#auth-form button[type="submit"]').click()
   assert page.evaluate('page')=='overview' and page.locator('#content > label select').input_value()=='7'
   page.locator('a[data-page="notifications"]').first.click();assert page.locator('#content > label select').input_value()=='2'
   page.locator('.account-button').click();page.get_by_role('link',name='My profile',exact=True).click();assert page.locator('#content > label select').input_value()=='4'
   page.reload();assert page.locator('#content > label select').input_value()=='4'
   result['flow_checks'].append({'name':'independent selection + navigation + sign-out/sign-in + reload','passed':True})
  except Exception as e: result['failures'].append('persistence flow: '+str(e))
  # Calendar remains owned by the host; design changes do not reset its month.
  try:
   setup('overview',1);before=page.evaluate('calendarMonth');page.get_by_role('button',name='Next month',exact=True).click()
   after=page.evaluate('calendarMonth');assert before!=after
   select('overview',2);assert page.evaluate('calendarMonth')==after
   page.locator('a[data-page="notifications"]').first.click();page.locator('a[data-page="overview"]').first.click();assert page.evaluate('calendarMonth')==after
   result['flow_checks'].append({'name':'native calendar month continuity','passed':True})
  except Exception as e: result['failures'].append('calendar flow: '+str(e))
  # Drawer and tabs: escape, focus return, no competing host tab handler.
  try:
   setup('overview',4);trigger=page.locator('.fd-file-inspect').first;trigger.click();assert page.locator('.fd-drawer').evaluate('(el)=>el.open');page.keyboard.press('Escape');assert page.locator('.fd-drawer').count()==0;assert trigger.evaluate('(el)=>el===document.activeElement')
   setup('profile',4);page.get_by_role('tab',name='Identity',exact=True).click();page.keyboard.press('ArrowRight');assert page.get_by_role('tab',name='University role').get_attribute('aria-selected')=='true'
   result['flow_checks'].append({'name':'drawer Escape/focus return and profile arrow-key tabs','passed':True})
  except Exception as e: result['failures'].append('keyboard flow: '+str(e))
  # Inbox state persists per preview role; email-only record never has read/send actions.
  try:
   page.evaluate('localStorage.removeItem("portal-front-desk:read:coordinator")');setup('notifications',1)
   page.locator('[data-action="read-all"]').click();assert page.locator('[data-action="read-one"]').count()==0
   page.get_by_role('tab',name='Unread').click();assert 'No unread notifications' in page.locator('#content').inner_text()
   page.reload();assert page.locator('[data-action="read-one"]').count()==0
   setup('notifications',5,'advisingStudent',delivery='failed')
   email=page.locator('.fd-email-record');assert 'Email delivery failed' in email.inner_text();assert email.locator('button').count()==0
   page.locator('.fd-inbox-search input').fill('no-such-update-928');assert 'No matching updates' in page.locator('#content').inner_text();page.locator('[data-fd="clear-search"]').click()
   result['flow_checks'].append({'name':'read-all/unread/reload, role-local state, email-only and search recovery','passed':True})
  except Exception as e:result['failures'].append('inbox flow: '+str(e))
  # Original still delegates to its renderer; no timetable/selector is destroyed globally.
  try:
   setup('overview',1);page.locator('#content > label select').select_option('0');assert page.locator('.module-week').count()==1;assert page.locator('[data-fd-page]').count()==0
   page.set_viewport_size({'width':390,'height':844});setup('notifications',2)
   page.locator('[data-action="mobile-menu"]').click()
   assert page.locator('#dialog[open] nav[aria-label="Mobile navigation"]').is_visible()
   page.locator('#dialog [data-action="close-dialog"]').first.click()
   result['flow_checks'].append({'name':'Original restore and native mobile navigation','passed':True})
  except Exception as e:result['failures'].append('original/mobile flow: '+str(e))
  # Inherited reduced-motion preference must prevent authored WAAPI movements.
  try:
   page.emulate_media(reduced_motion='reduce');setup('login',1);page.wait_for_timeout(100)
   assert page.locator('.fd-art').evaluate('(el)=>el.getAnimations({subtree:true}).filter(a=>a.playState==="running").length')==0
   result['flow_checks'].append({'name':'reduced-motion authored illustration','passed':True})
  except Exception as e:result['failures'].append('reduced-motion: '+str(e))
  browser.close()
 result['elapsed_seconds']=round(time.monotonic()-start,2)
 result['summary']={key:len(result[key]) for key in ['render_checks','role_checks','state_checks','action_checks','flow_checks','errors','failures']}
 result['passed']=not(result['errors'] or result['failures'])
 (output/'browser-results.json').write_text(json.dumps(result,indent=2))
 print(json.dumps(result['summary'],indent=2));print('PASS' if result['passed'] else 'FAIL');print('\n'.join(result['failures'][:20]))
 return result['passed']

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--base',default='http://localhost:8000');parser.add_argument('--output',type=Path,default=Path(__file__).parent/'results');parser.add_argument('--no-screenshots',action='store_true');args=parser.parse_args()
 raise SystemExit(0 if run(args.base.rstrip('/'),args.output,not args.no_screenshots) else 1)
