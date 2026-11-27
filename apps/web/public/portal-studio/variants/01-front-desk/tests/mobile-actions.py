"""Operate each primary action at a 390px viewport; this is the native preview."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import argparse,json,os

def run(base,out):
 out.mkdir(parents=True,exist_ok=True);report={'checks':[],'errors':[],'failures':[]}
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':390,'height':844});page.set_default_timeout(5000);page.on('pageerror',lambda e:report['errors'].append(str(e)))
  page.goto(base+'/portal-studio/index.html?preview=live');page.wait_for_function('window.portalVariants?.overview?.length===10')
  for key in ['overview','login','forgot','reset','profile','notifications']:
   for design in range(1,11):
    try:
     page.evaluate('''({key,design})=>{localStorage.setItem('portal-studio-preview-session','1');localStorage.setItem('portal-page-design:'+key,String(design));localStorage.removeItem('portal-front-desk:read:coordinator');readNotifications.clear();role='coordinator';tab='all';navigate(key)}''',{'key':key,'design':design})
     if key=='overview':page.locator('#content a[data-page="student-schedules"]').first.click();assert page.evaluate('page')=='student-schedules'
     elif key in ['login','forgot','reset']:
      page.locator('.fd-auth-foot details summary').click();page.locator('[data-fd="fill-preview"]').click();step=page.locator('[data-fd="next-stage"]')
      if step.count() and step.is_visible():step.click()
      page.locator('#auth-form button[type="submit"]').click();assert page.evaluate('page')=={'login':'overview','forgot':'reset','reset':'login'}[key]
     elif key=='profile':
      if design==4:page.get_by_role('tab',name='Account actions',exact=True).click()
      if design==9:page.locator('.fd-profile-fold').last.locator('summary').click()
      page.locator('#content a[data-page="forgot"]').click();assert page.evaluate('page')=='forgot'
     else:
      page.locator('[data-action="read-one"]').first.click();assert len(json.loads(page.evaluate('localStorage.getItem("portal-front-desk:read:coordinator")')))==1
     report['checks'].append({'page':key,'design':design,'passed':True})
    except Exception as e:report['checks'].append({'page':key,'design':design,'passed':False});report['failures'].append(f'{key}/{design}: {e!r}')
  b.close()
 report['passed']=not report['failures'] and not report['errors'];report['summary']={'checks':len(report['checks']),'errors':len(report['errors']),'failures':len(report['failures'])};(out/'mobile-action-results.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report['summary'],indent=2));print('\n'.join(report['failures']));return report['passed']
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--base',default='http://localhost:8000');ap.add_argument('--output',type=Path,default=Path(__file__).parent/'results');a=ap.parse_args();raise SystemExit(0 if run(a.base.rstrip('/'),a.output) else 1)
