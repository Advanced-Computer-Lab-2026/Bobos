"""Additional permission/fixture/validation checks; operates the installed Studio only."""
from pathlib import Path
import argparse,json,os
from playwright.sync_api import sync_playwright

def run(base,out):
 out.mkdir(parents=True,exist_ok=True);result={'checks':[],'errors':[],'failures':[]}
 fixtures=json.loads((Path(__file__).parent/'event-fixtures.json').read_text())
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(5000)
  page.on('pageerror',lambda e:result['errors'].append(str(e)));page.goto(base+'/portal-studio/index.html?preview=live');page.wait_for_function('window.portalVariants?.overview?.length===10')
  def setup(key='notifications',design=2,r='coordinator',state='',event='',delivery=''):
   page.evaluate('''({key,design,r,state,event,delivery})=>{localStorage.setItem('portal-studio-preview-session','1');localStorage.setItem('portal-page-design:'+key,String(design));role=r;tab='all';navigate(key);const u=new URL(location.href);for(const [k,v]of Object.entries({'fd-state':state,'fd-event':event,'fd-delivery':delivery})){if(v)u.searchParams.set(k,v);else u.searchParams.delete(k)}history.replaceState({},'',u);render()}''',locals())
  def test(name,fn):
   try:fn();result['checks'].append({'name':name,'passed':True})
   except Exception as e:result['checks'].append({'name':name,'passed':False,'error':repr(e)});result['failures'].append(name+': '+repr(e))
  def eventcheck(item,r):
   setup(r=r,event=item['type']);assert page.locator('.fd-reading-pane').count()==1
   assert page.locator('.fd-notice-roster button').count()==3
   if item['missing_sender_notice']:assert page.locator('.fd-audit-note').count()==1
   assert page.locator('.fd-reading-pane [data-action="read-one"]').count()==1
   if r!='coordinator':assert page.locator('#content a[data-page="pending-work"]').count()==0
  for item in fixtures:
   for r in item['roles']:test('event fixture '+item['type']+'/'+r,lambda item=item,r=r:eventcheck(item,r))
  def emailcheck(delivery):
   setup(r='advisingStudent',delivery=delivery);email=page.locator('.fd-email-record');assert email.count()==1
   assert {'sent':'Email sent','pending':'Email pending','failed':'Email delivery failed'}[delivery] in email.inner_text()
   email.locator('summary').click();assert email.locator('button,[data-action]').count()==0
  for state in ['sent','pending','failed']:test('email-only '+state,lambda state=state:emailcheck(state))
  def opening():
   page.evaluate("localStorage.removeItem('portal-front-desk:read:coordinator')")
   for design in range(1,11):
    setup(design=design)
    before=page.evaluate("localStorage.getItem('portal-front-desk:read:coordinator')")
    if design in [2,10]:page.locator('.fd-notice-pick').nth(1).click()
    else:page.locator('.fd-notice-title').first.click();page.keyboard.press('Escape')
    assert page.evaluate("localStorage.getItem('portal-front-desk:read:coordinator')")==before
  test('Opening/selecting does not mark read in all ten arrangements',opening)
  def deniedevent():
   setup(r='normalStudent',event='extraHoursRequested');assert 'Extra-hours request needs a decision' not in page.locator('#content').inner_text();assert page.locator('a[data-page="pending-work"]').count()==0
  test('Disallowed event query cannot expose Coordinator handoff',deniedevent)
  def emailinvalid():
   setup('login',1);page.locator('[name=email]').fill('someone@example.com');page.locator('[name=password]').fill('PreviewOnly123!');page.locator('#auth-form button[type=submit]').click();assert page.evaluate('page')=='login';assert 'Use your GUC email' in page.locator('.fd-feedback').inner_text();assert page.locator('[name=password]').input_value()=='PreviewOnly123!'
  test('Invalid GUC domain preserves entries and blocks preview submit',emailinvalid)
  def passwordbytes():
   setup('reset',8);page.locator('[name=email]').fill('nadia.ahmed@guc.edu.eg');page.locator('[name=otp]').fill('123456');page.locator('[name=newPassword]').fill('é'*37);page.locator('#auth-form button[type=submit]').click();assert page.evaluate('page')=='reset';assert '72 UTF-8 bytes' in page.locator('.fd-feedback').inner_text();assert page.locator('[data-check=bytes]').get_attribute('data-met')=='false'
  test('Reset enforces 72 bytes, not 72 Unicode characters',passwordbytes)
  def wrongcode():
   setup('reset',1);page.locator('[name=email]').fill('nadia.ahmed@guc.edu.eg');page.locator('[name=otp]').fill('123');page.locator('[name=newPassword]').fill('PreviewOnly123!');page.locator('#auth-form button[type=submit]').click();assert page.evaluate('page')=='reset';assert not page.locator('[name=otp]').evaluate('(el)=>el.validity.valid')
  test('Short OTP rejected by native input validity',wrongcode)
  def conversation():
   setup(r='advisor');drawing=page.locator('.fd-reading-pane .fd-conversation svg');assert drawing.is_visible();page.locator('.fd-reading-pane').hover();assert page.locator('.fd-reading-pane .question-outline').evaluate('(el)=>getComputedStyle(el).animationName')=='question-boil'
   page.emulate_media(reduced_motion='reduce');assert page.locator('.fd-reading-pane .question-outline').evaluate('(el)=>getComputedStyle(el).animationName')=='none';page.emulate_media(reduced_motion='no-preference')
  test('Native conversation artwork visible, locally animated and reduced-motion safe',conversation)
  def coexist():
   page.evaluate("window.portalVariants['other-team-sentinel']=[{name:'Keep me',apply(){}}]")
   page.add_script_tag(url=base+'/portal-studio/variants/01-front-desk/pages.js')
   assert page.evaluate("portalVariants['other-team-sentinel'][0].name")=='Keep me'
   assert page.locator('link[data-portal-front-desk]').count()==1
   assert page.evaluate("['overview','login','forgot','reset','profile','notifications'].every(k=>portalVariants[k].length===10)")
  test('Registry merge preserves other-team keys and installs CSS only once',coexist)
  b.close()
 result['passed']=not result['errors'] and not result['failures'];result['summary']={'checks':len(result['checks']),'errors':len(result['errors']),'failures':len(result['failures'])};(out/'extra-results.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result['summary'],indent=2));print('\n'.join(result['failures']));return result['passed']
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--base',default='http://localhost:8000');ap.add_argument('--output',type=Path,default=Path(__file__).parent/'results');a=ap.parse_args();raise SystemExit(0 if run(a.base.rstrip('/'),a.output) else 1)
