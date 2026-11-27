#!/usr/bin/env python3
"""Check host continuity, five-role visibility, native dialog focus, and finite motion.
Uses existing Portal preview; does not emulate production authentication or APIs.
"""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--base',default='http://127.0.0.1:8001');p.add_argument('--browser',default='/usr/bin/chromium');p.add_argument('--out',type=Path,default=Path(__file__).parent.parent/'evidence');a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
manifest=json.loads((Path(__file__).parent.parent/'manifest.json').read_text());results=[]
def check(name,condition):
 assert condition,name
 results.append({'name':name,'passed':True});print('PASS',name,flush=True)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=a.browser,headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.set_default_timeout(6000)
 page.goto(a.base+'/portal-studio/index.html?preview=live&role=administrator');page.screenshot(path=str(a.out/'existing-signin.png'));page.locator('#auth-form button').click()
 page.locator('[data-calendar-nav="1"]').click();month=page.evaluate('calendarMonth');page.locator('a[data-page=courses]').first.click();page.locator('#content>label>select').select_option('3');page.locator('a[data-page=overview]').first.click();check('Calendar position survives an academic page round-trip',page.evaluate('calendarMonth')==month)
 page.locator('[data-calendar-nav="-1"]').click();check('Existing calendar previous control still works',page.evaluate('calendarMonth')==month-1)
 page.locator('.account-button').click();page.locator('#account-menu a[data-page=profile]').click();check('Existing profile opens',page.locator('main[data-screen=profile]').count()==1);page.locator('.brand a').first.click();check('Existing brand returns to Overview',page.locator('main[data-screen=overview]').count()==1)
 for mode in ['dark','light']:
  page.evaluate('(dark)=>{lab.dark=dark;applyLook()}',mode=='dark');page.wait_for_timeout(250)
  page.screenshot(path=str(a.out/f'overview-{mode}-1440.png'))
  page.locator('a[data-page=courses]').first.click();page.locator('#content>label>select').select_option('3');page.mouse.move(1100,60);page.screenshot(path=str(a.out/f'academic-{mode}-1440.png'))
  shell=page.evaluate('''()=>({sidebar:Math.round(document.querySelector('.sidebar').getBoundingClientRect().width),header:Math.round(document.querySelector('.topbar').getBoundingClientRect().height),font:getComputedStyle(document.querySelector('.as-root')).fontFamily,mainfont:getComputedStyle(document.querySelector('main')).fontFamily})''')
  check(f'{mode} shell dimensions and inherited fonts stay unchanged',shell['sidebar']==224 and shell['header']==48 and shell['font']==shell['mainfont'])
  page.locator('a[data-page=overview]').first.click()
 for role in ['administrator','coordinator','advisor','normalStudent','advisingStudent']:
  for spec in manifest['pages']:
   key=spec['key'];page.evaluate('([k,r])=>{role=r;navigate(k)}',[key,role]);page.locator('#content>label>select').select_option('4')
   text=page.locator('.as-root').inner_text();denied='This page is not available for your role' in text
   check(f'{role} / {key} read boundary',denied==(role not in spec['readRoles']))
   if not denied and role!=spec['writeRole']:
    check(f'{role} / {key} write controls absent',page.locator('.as-root [data-as-action=course-edit],.as-root [data-as-action=unassign],.as-root [data-as-action=publication],.as-root [data-action=add-course],.as-root [data-action=create-term],.as-root [data-action=add-offering],.as-root [data-as-action=delete-template]').count()==0)
 page.evaluate('role="administrator";navigate("courses")');page.locator('#content>label>select').select_option('3');opener=page.locator('[data-action=add-course]');opener.click();page.locator('.as-dialog input[name=code]').wait_for();page.wait_for_timeout(50)
 check('Native modal receives initial field focus',page.evaluate('document.activeElement.name')=='code')
 page.locator('.as-dialog [data-as-close]').focus();page.keyboard.press('/');check('Slash inside academic modal does not open host quick-find',page.locator('#dialog[open]').count()==0)
 page.keyboard.press('Escape');check('Escape closes modal and restores original opener',page.locator('.as-dialog[open]').count()==0 and page.evaluate('document.activeElement.dataset.action')=='add-course')
 # Error recovery at mobile width remains in the same dialog, with no body overflow.
 page.set_viewport_size({'width':390,'height':844});opener.click();page.locator('.as-dialog button[type=submit]').click();page.screenshot(path=str(a.out/'course-validation-mobile.png'))
 check('Mobile validation stays visible without body overflow',page.locator('.as-dialog .as-errors').count()==1 and page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
 page.keyboard.press('Escape');page.evaluate('role="coordinator";navigate("group-assignments")');page.locator('#content>label>select').select_option('3');page.locator('[data-as-action=assignment]').first.click();page.screenshot(path=str(a.out/'assignment-review-mobile.png'))
 check('Mobile before/after review remains a contained native modal',page.locator('.as-dialog .as-before-after').count()==1 and page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
 page.keyboard.press('Escape');page.set_viewport_size({'width':1440,'height':1000});page.evaluate('role="administrator";navigate("courses")');page.locator('#content>label>select').select_option('1');page.locator('[data-action=add-course]').click()
 art=page.locator('.as-dialog .as-task-art');strip=page.locator('.as-dialog .as-strip');check('Reduced motion uses a static final pose',strip.evaluate('(e)=>getComputedStyle(e).animationName')=='none')
 page.emulate_media(reduced_motion='no-preference');page.mouse.move(0,999);page.wait_for_timeout(100);rest=strip.evaluate('(e)=>getComputedStyle(e).transform');page.locator('.as-dialog-head').hover();page.wait_for_timeout(180);moving=strip.evaluate('(e)=>getComputedStyle(e).transform');page.wait_for_timeout(1300);finish=strip.evaluate('(e)=>getComputedStyle(e).transform');check('Task artwork plays finite held poses and rests',moving!=finish and finish==rest)
 check('No unhandled shell or permission JavaScript errors',not errors)
 version=b.version;b.close()
(a.out/'shell-and-evidence.json').write_text(json.dumps({'suite':'shell-and-evidence','base':a.base,'browser':version,'passed':len(results),'failed':0,'javascriptErrors':errors,'cases':results},indent=2)+'\n')
