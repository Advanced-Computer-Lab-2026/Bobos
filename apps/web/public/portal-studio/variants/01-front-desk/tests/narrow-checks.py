"""Extra 320/768/1024px layout checks and refresh the revised folder-queue captures."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import argparse,json,os

def run(base,out):
 out.mkdir(parents=True,exist_ok=True);report={'renders':[],'failures':[],'errors':[]}
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000});page.on('pageerror',lambda e:report['errors'].append(str(e)))
  page.goto(base+'/portal-studio/index.html?preview=live');page.wait_for_function('window.portalVariants?.overview?.length===10')
  def setup(key,design):page.evaluate('''({key,design})=>{localStorage.setItem('portal-studio-preview-session','1');localStorage.setItem('portal-page-design:'+key,String(design));role='coordinator';navigate(key)}''',locals())
  for width,height in [(320,812),(768,1024),(1024,768)]:
   page.set_viewport_size({'width':width,'height':height})
   for key in ['overview','login','forgot','reset','profile','notifications']:
    for design in range(1,11):
     setup(key,design);page.wait_for_timeout(25)
     ok=page.evaluate('document.documentElement.scrollWidth<=innerWidth+1&&document.querySelector("#content").scrollWidth<=document.querySelector("#content").clientWidth+1')
     record={'page':key,'design':design,'width':width,'height':height,'no_horizontal_overflow':ok};report['renders'].append(record)
     if not ok:report['failures'].append(record)
  for size,width,height in [('desktop',1440,1000),('mobile',390,844)]:
   page.set_viewport_size({'width':width,'height':height})
   for mode in ['light','dark']:
    page.evaluate('(mode)=>{localStorage.removeItem("portal-front-desk:appearance");lab.dark=mode==="dark";applyLook()}',mode);setup('overview',4);page.wait_for_timeout(1000)
    widths=page.locator('.queue-copy').evaluate_all('(nodes)=>nodes.map(el=>el.getBoundingClientRect().width)');assert all(w>=150 for w in widths),widths
    dest=out/'screenshots'/f'overview-04-{size}-{mode}.png';dest.parent.mkdir(exist_ok=True);page.screenshot(path=str(dest))
  b.close()
 report['passed']=not report['failures'] and not report['errors'];report['summary']={'renders':len(report['renders']),'errors':len(report['errors']),'failures':len(report['failures'])};(out/'narrow-results.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report['summary'],indent=2));print(report['failures']);return report['passed']
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--base',default='http://localhost:8000');ap.add_argument('--output',type=Path,default=Path(__file__).parent/'results');a=ap.parse_args();raise SystemExit(0 if run(a.base.rstrip('/'),a.output) else 1)
