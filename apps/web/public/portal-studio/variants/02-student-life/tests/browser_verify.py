#!/usr/bin/env python3
"""Integration verification against the supplied Portal host.
Serve project/apps/web/public, then run with --base http://localhost:8000.
This tests local preview workflows, NOT a live API, OAuth provider, or database.
"""
import argparse
import json
import shutil
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

KEYS = ['my-schedule', 'my-courses', 'schedule-swap', 'preferences', 'records', 'my-advisor', 'calendar-sync']
ROLES = ['normalStudent', 'advisingStudent', 'advisor', 'coordinator', 'administrator']
ALLOWED = {
 'my-schedule': ROLES, 'my-courses': ROLES[:2], 'schedule-swap': ROLES[:1],
 'preferences': ROLES[1:4], 'records': ROLES[1:4], 'my-advisor': ROLES[1:2], 'calendar-sync': ROLES[:2],
}
parser=argparse.ArgumentParser()
parser.add_argument('--base', default='http://localhost:8000')
parser.add_argument('--output', default='verification-results')
parser.add_argument('--mode', choices=['all','layouts','workflows'], default='all')
parser.add_argument('--screenshots', action='store_true')
args=parser.parse_args()
out=Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True)
results=[];errors=[];failures=[]
started=time.time()

def record(name, condition, detail=None):
 row={'name':name,'passed':bool(condition)}
 if detail is not None: row['detail']=detail
 results.append(row)
 if not condition: failures.append(row); print('FAIL',name,detail,flush=True)

def role_for(key): return 'normalStudent' if key in ['schedule-swap','calendar-sync'] else 'advisingStudent'

def goto(page,key,role=None,design=1,reset=False):
 page.goto(f'{args.base}/portal-studio/index.html?preview=live&role={role or role_for(key)}&page={key}')
 page.locator('#content > label select').select_option(str(design))
 if reset: page.evaluate('PortalStudentLife.resetPreview()')

def scenario(page,key,state): page.evaluate('([key,state])=>PortalStudentLife.setScenario(key,state)',[key,state])
def state(page): return page.evaluate('PortalStudentLife.readPreview()')
def click_action(page,action): page.locator(f'[data-sl2-action="{action}"]:visible').first.click()
def submit_dialog(page): page.locator('.sl2-dialog[open] button[type="submit"]').click()
def close_dialog(page):
 if page.locator('.sl2-dialog[open]').count(): page.locator('.sl2-dialog[open] [data-close]').first.click()
def show_field(page, selector, step=None):
 if page.locator('.sl2-step-nav').count() and step is not None:
  page.locator(f'[data-sl2-action="preference-step"][data-step="{step}"]').click()
 # Operate actual summary controls, not forced clicks or un-hiding style overrides.
 ancestors=page.locator('details').filter(has=page.locator(selector)).all()
 for detail in ancestors:
  if detail.get_attribute('open') is None: detail.locator(':scope > summary').click()
 return page.locator(selector)

def run_workflow(page,key,n):
 goto(page,key,design=n,reset=True)
 name=f'workflow:{key}:{n}'
 if key=='my-schedule':
  before=page.evaluate('PortalStudentLife.fixtureMeetings().map(m=>[m.id,m.day,m.start,m.room])')
  click_action(page,'request-slot')
  page.locator('.sl2-dialog select[name="meeting"]').select_option('0-Tutorial')
  page.locator('.sl2-dialog textarea').fill(f'Later tutorial please — design {n}.')
  submit_dialog(page)
  record(name+':submit',state(page)['requests'][-1]['status']=='Pending')
  click_action(page,'request-slot')
  page.locator('.sl2-dialog select[name="meeting"]').select_option('0-Tutorial');submit_dialog(page)
  record(name+':duplicate-validation',page.locator('.sl2-dialog-error').is_visible())
  close_dialog(page);click_action(page,'withdraw-slot');submit_dialog(page)
  record(name+':withdraw',state(page)['requests'][-1]['status']=='Withdrawn')
  record(name+':assignments-unchanged',before==page.evaluate('PortalStudentLife.fixtureMeetings().map(m=>[m.id,m.day,m.start,m.room])'))
  record(name+':draft-export-disabled',page.locator('[data-sl2-action="schedule-pdf"]').is_disabled())
 elif key=='my-courses':
  record(name+':credits','19' in page.locator('.sl2-total').inner_text())
  if not page.locator('[data-sl2-action="meeting"]:visible').count():
   click_action(page,'sections')
  page.locator('[data-sl2-action="meeting"]:visible').first.click()
  record(name+':component-details',all(t in page.locator('.sl2-dialog[open]').inner_text() for t in ['Location','Instructor','Group']))
  close_dialog(page)
  if n==10:
   page.locator('[data-sl2-search="courses"]').fill('no-such-course')
   record(name+':no-match',page.locator('.sl2-search-count').inner_text().startswith('No matches'))
   page.locator('[data-sl2-search="courses"]').fill('CSEN 701')
   record(name+':search',page.locator('[data-course-index]:visible').count()==1)
  if n==9:
   page.locator('[data-sl2-compare="2"]').click()
   record(name+':comparison-limit',not page.locator('[data-sl2-compare="2"]').is_checked())
 elif key=='schedule-swap':
  click_action(page,'submit-swap')
  record(name+':empty-selection',page.locator('.sl2-feedback[role="alert"]').is_visible())
  page.locator('[data-sl2-destination="1"]').check();page.locator('[data-sl2-destination="2"]').check()
  click_action(page,'submit-swap');submit_dialog(page)
  record(name+':multiple-destinations',state(page)['swaps'][-1]['desired']==[1,2])
  page.locator('[data-tab="groups"]').click()
  record(name+':one-open',page.locator('[data-sl2-action="submit-swap"]').is_disabled())
  page.locator('[data-tab="mine"]').click();click_action(page,'withdraw-swap');submit_dialog(page)
  record(name+':withdraw',state(page)['swaps'][-1]['status']=='Withdrawn')
  page.locator('[data-tab="open"]').click();click_action(page,'complete-swap');submit_dialog(page)
  record(name+':whole-exchange',state(page)['group']==1 and state(page)['swaps'][-1]['status']=='Completed')
  record(name+':all-components-move',len(page.evaluate('PortalStudentLife.fixtureMeetings(PortalStudentLife.readPreview().group).filter(m=>m.group===1)'))==12)
 elif key=='preferences':
  show_field(page,'#preference-notes',3).fill(f'Preference saved from design {n}.')
  page.locator('[data-action="save-preferences"]').click()
  record(name+':save',state(page)['prefs']['notes']==f'Preference saved from design {n}.')
  show_field(page,'.sl2-time-rows',2)
  click_action(page,'add-time')
  page.locator('[data-field="start"]').last.fill('12:00');page.locator('[data-field="end"]').last.fill('10:00')
  page.locator('[data-action="save-preferences"]').click()
  record(name+':invalid-time',page.locator('.sl2-feedback').inner_text()=='Each time range must end after it starts.')
  page.locator('[data-field="end"]').last.fill('13:30');page.locator('[data-action="save-preferences"]').click()
  record(name+':valid-time',state(page)['prefs']['times'][-1]['end']=='13:30')
  record(name+':does-not-process',state(page)['status']=='readyForStudentReview')
 elif key=='records':
  page.locator('[data-sl2-year]').select_option('2024/2025')
  with page.expect_download() as dl:
   page.locator('[data-sl2-action="transcript-pdf"],[data-action="transcript"]').first.click()
  path=out/f'transcript-design-{n}.pdf';dl.value.save_as(path)
  raw=path.read_bytes()
  record(name+':pdf',raw.startswith(b'%PDF-1.4') and b'2024/2025' in raw and b'CSEN 401' in raw and b'CSEN 501' not in raw)
  record(name+':year-persisted',page.evaluate('JSON.parse(sessionStorage.getItem("portal-student-life:round2:record-year:advisingStudent"))')=='2024/2025')
 elif key=='my-advisor':
  record(name+':contact',page.locator('a[href="mailto:salma.adel@guc.edu.eg"]:visible').count()>=1)
  show_field(page,'[data-sl2-advisor-note]').fill(f'Private preparation — design {n}.')
  record(name+':private-note',state(page)['advisorNote']==f'Private preparation — design {n}.')
  if page.locator('[data-sl2-check]:visible').count():
   page.locator('[data-sl2-check]:visible').first.check()
   record(name+':checklist',state(page)['checks'][0])
  if n==6:
   click_action(page,'draft-email')
   record(name+':mail-draft',page.locator('.sl2-dialog a[href^="mailto:"]').get_attribute('href').find('body=')>0)
   close_dialog(page)
 elif key=='calendar-sync':
  click_action(page,'sync-now')
  page.wait_for_function('PortalStudentLife.readPreview().syncHistory.length===1')
  click_action(page,'sync-now');page.wait_for_function('PortalStudentLife.readPreview().syncHistory.length===2')
  record(name+':idempotent-preview-sync','No schedule changes' in state(page)['syncHistory'][0]['detail'])
  page.locator('[data-action="toggle-calendar"],[data-sl2-action="toggle-calendar"]').first.click();submit_dialog(page)
  record(name+':disconnect',not state(page)['connected'] and page.locator('[data-sl2-action="sync-now"]').is_disabled())
  page.locator('[data-action="toggle-calendar"],[data-sl2-action="toggle-calendar"]').first.click();submit_dialog(page)
  record(name+':reconnect',state(page)['connected'])
  show_field(page,'[data-action="export-calendar"]')
  with page.expect_download() as dl: page.locator('[data-action="export-calendar"]').click()
  path=out/f'calendar-design-{n}.ics';dl.value.save_as(path);raw=path.read_text()
  record(name+':calendar-file',raw.count('BEGIN:VEVENT')==12 and 'TZID:Africa/Cairo' in raw and raw.count('RRULE:')==12)
 # Failure and recovery are available in every composition, keeping the design selected.
 scenario(page,key,'error');record(name+':load-error',page.locator('[data-sl2-action="retry"]').is_visible())
 click_action(page,'retry');record(name+':retry',not page.locator('[data-sl2-action="retry"]').count() and page.locator('.sl2-page').get_attribute('data-sl2-design')==str(n))
 scenario(page,key,'empty');record(name+':empty',page.locator('.sl2-page').is_visible() and page.locator('.sl2-page').inner_text().find('undefined')<0)
 scenario(page,key,'unavailable');record(name+':unavailable',page.locator('.sl2-page').is_visible() and page.locator('.sl2-page').inner_text().find('undefined')<0)
 if key in ['my-schedule','my-courses','schedule-swap','records','my-advisor']:
  record(name+':unavailable-no-mutations',page.locator('.sl2-page [data-sl2-action],.sl2-page [data-action]').count()==0)
 elif key=='preferences':
  record(name+':unavailable-readonly',page.locator('[data-action="save-preferences"]').is_disabled())
 elif key=='calendar-sync':
  record(name+':unavailable-sync-disabled',page.locator('[data-sl2-action="sync-now"]').is_disabled())
 scenario(page,key,'default')

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or shutil.which('chromium-browser'),args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce',accept_downloads=True)
 page=context.new_page();page.set_default_timeout(7000)
 page.on('pageerror',lambda error:errors.append(str(error)))
 page.goto(f'{args.base}/portal-studio/index.html?preview=live')
 page.get_by_role('button',name='Sign in',exact=True).click()
 record('host:sign-in-overview',page.locator('#content').inner_text().find('Good')>=0)
 if args.mode in ['all','workflows']:
  for key in KEYS:
   for n in range(1,11):
    try: run_workflow(page,key,n)
    except Exception as exc:
     record(f'workflow:{key}:{n}:exception',False,str(exc));page.screenshot(path=str(out/f'failure-{key}-{n}.png'))
   print('WORKFLOWS',key,flush=True)
  # Actual host navigation, independent selector persistence, and original restoration.
  goto(page,'my-schedule',design=6,reset=True)
  page.locator('.sidebar [data-page="my-courses"]').click()
  page.locator('#content > label select').select_option('3')
  page.locator('.sidebar [data-page="my-schedule"]').click()
  record('host:selection-return',page.locator('#content > label select').input_value()=='6')
  page.locator('.sidebar [data-page="my-courses"]').click()
  record('host:selection-independent',page.locator('#content > label select').input_value()=='3')
  page.locator('#content > label select').select_option('0')
  record('host:original',page.locator('.sl2-page').count()==0 and page.locator('.course-list').count()==1)
  # Popover is host-owned. Open it rather than force clicking a hidden sign-out action.
  page.locator('[popovertarget="account-menu"]').click()
  page.locator('[data-action="sign-out"]').click()
  record('host:sign-out',page.get_by_role('button',name='Sign in',exact=True).is_visible())
  page.get_by_role('button',name='Sign in',exact=True).click()
  record('host:sign-in-again',page.locator('.sidebar').is_visible())
  page.locator('.sidebar .navlink[data-page="overview"]').click()
  page.locator('.sidebar [data-page="my-schedule"]').click()
  record('host:selection-after-sign-in',page.locator('#content > label select').input_value()=='6')
  # Preserve native Original interactions when entering and leaving our variants.
  goto(page,'calendar-sync','normalStudent',1,True)
  page.locator('#content > label select').select_option('0')
  page.locator('[data-action="toggle-calendar"]').click()
  page.locator('#content > label select').select_option('1')
  record('host:calendar-original-to-variant',not state(page)['connected'])
  page.locator('[data-action="toggle-calendar"]').click();submit_dialog(page)
  page.locator('#content > label select').select_option('0')
  record('host:calendar-variant-to-original',page.locator('[data-action="toggle-calendar"]').inner_text()=='Disconnect')
  goto(page,'preferences','advisingStudent',1,True)
  page.locator('#content > label select').select_option('0')
  page.locator('#preference-notes').fill('Written in Original')
  page.locator('[data-action="save-preferences"]').click()
  page.locator('#content > label select').select_option('5')
  record('host:preferences-original-to-variant',page.locator('#preference-notes').input_value()=='Written in Original')
  page.locator('#preference-notes').fill('Written in variant');page.locator('[data-action="save-preferences"]').click()
  page.locator('#content > label select').select_option('0')
  record('host:preferences-variant-to-original',page.locator('#preference-notes').input_value()=='Written in variant')
  goto(page,'my-schedule','advisingStudent',2,True)
  page.locator('[data-sl2-action="day"]').first.focus();page.keyboard.press('ArrowRight')
  record('keyboard:day-navigation',page.locator('[data-sl2-action="day"]').nth(1).get_attribute('aria-pressed')=='true')
  first=page.locator('[data-sl2-action="meeting"]:visible').first;first.click();page.keyboard.press('Escape')
  page.wait_for_timeout(30)
  record('keyboard:dialog-escape',page.locator('.sl2-dialog[open]').count()==0)
  record('keyboard:dialog-focus-return',page.evaluate('document.activeElement?.dataset.sl2Action')=='meeting')
  record('accessibility:reduced-motion',page.locator('.sl2-meeting').first.evaluate('(e)=>getComputedStyle(e).animationName')=='none')
  # Every role/page permission combination, including unavailable owned URL routes.
  for key in KEYS:
   for role in ROLES:
    goto(page,key,role,1,True)
    text=page.locator('.sl2-page').inner_text()
    record(f'permissions:{key}:{role}',('This page is not available for your role' in text)==(role not in ALLOWED[key]))
    if role not in ALLOWED[key]: record(f'permissions:{key}:{role}:no-actions',page.locator('.sl2-page [data-sl2-action],.sl2-page [data-action]').count()==0)
  for role in ROLES:
   goto(page,'my-schedule',role,1,True);scenario(page,'my-schedule','draft')
   record(f'permissions:incomplete-draft:{role}',page.locator('.sl2-meeting').count()==(10 if role in ['advisor','coordinator','administrator'] else 0))
  for role in ROLES[:2]:
   goto(page,'my-courses',role,1,True);scenario(page,'my-courses','draft')
   record(f'permissions:unreleased-course-sections:{role}',page.locator('.sl2-course-register').count()==0)
  goto(page,'preferences','advisor',1,True)
  record('permissions:staff-preferences-readonly',page.locator('.sl2-preferences-body input:not(:disabled),.sl2-preferences-body textarea:not(:disabled),.sl2-preferences-body select:not(:disabled)').count()==0)
  goto(page,'records','advisor',1,True)
  record('permissions:staff-records-no-wallet',page.locator('[data-tab="wallet"]').count()==0)
  goto(page,'my-schedule','normalStudent',1,True);scenario(page,'my-schedule','ready')
  record('permissions:normal-cannot-see-draft',page.locator('.sl2-meeting').count()==0)
  goto(page,'my-schedule','advisingStudent',1,True);scenario(page,'my-schedule','processed')
  record('schedule:processed-export-available',page.locator('[data-sl2-action="schedule-pdf"]').is_enabled() and page.locator('[data-sl2-action="request-slot"]').is_disabled())
  with page.expect_download() as dl: click_action(page,'schedule-pdf')
  dl.value.save_as(out/'processed-schedule.pdf')
  page.evaluate('window.print=()=>window.__printInvoked=true');click_action(page,'schedule-print')
  record('schedule:print',page.evaluate('window.__printInvoked===true'))
  page.pdf(path=str(out/'printed-schedule.pdf'),format='A4',print_background=True)
  page.evaluate('PortalStudentLife.resetPreview()');scenario(page,'my-schedule','deadline')
  record('schedule:deadline',page.locator('[data-sl2-action="request-slot"]').is_disabled())
  page.evaluate('PortalStudentLife.resetPreview()');scenario(page,'my-schedule','resolved')
  record('schedule:decisions',all(x in page.locator('.sl2-request-list').inner_text() for x in ['Approved','Rejected','Withdrawn','Replacement:']))
  goto(page,'calendar-sync','normalStudent',9,True);scenario(page,'calendar-sync','conflict');click_action(page,'sync-now')
  page.wait_for_function('document.querySelector("[data-sl2-action=sync-now]")?.textContent==="Retry sync"')
  record('calendar:provider-retry-feedback','did not respond' in page.locator('.sl2-feedback').inner_text())
  click_action(page,'sync-now');page.wait_for_function('PortalStudentLife.readPreview().syncHistory.length===1')
  record('calendar:provider-retry-success',len(state(page)['syncHistory'])==1)
  # Coexistence of registries is verified without pretending other submissions are supplied.
  page.evaluate('''()=>{window.portalVariants.__other_contributor=[{name:'sentinel',apply(){}}];const script=document.createElement('script');script.src='/portal-studio/variants/02-student-life/pages.js?coexistence=1';document.body.append(script);}''')
  page.wait_for_timeout(100)
  record('integration:registry-coexistence',page.evaluate('window.portalVariants.__other_contributor[0].name==="sentinel"'))
 if args.mode in ['all','layouts']:
  for mode in ['dark','light']:
   for width in [1440,390]:
    page.set_viewport_size({'width':width,'height':1000 if width==1440 else 844})
    for key in KEYS:
     goto(page,key,design=1,reset=True)
     page.evaluate(f'lab.dark={"true" if mode=="dark" else "false"};applyLook();render()')
     for n in range(1,11):
      page.locator('#content > label select').select_option(str(n))
      stats=page.evaluate('''()=>({width:document.documentElement.scrollWidth,viewport:innerWidth,h1:document.querySelectorAll('#content h1').length,selected:document.querySelectorAll('#content > label select').length,invalidText:/undefined|NaN/.test(document.querySelector('.sl2-page').innerText),sidebar:document.querySelector('.sidebar').getBoundingClientRect().width})''')
      record(f'layout:{mode}:{width}:{key}:{n}',stats['width']<=width+1 and stats['h1']==1 and stats['selected']==1 and not stats['invalidText'],stats)
      if args.screenshots and (width==1440 or n in [1,6,10]):
       page.screenshot(path=str(out/f'{mode}-{width}-{key}-{n}.png'))
     print('LAYOUTS',mode,width,key,flush=True)
 record('runtime:no-page-errors',not errors,errors)
 browser.close()
report={'scope':'Supplied static Portal preview; not live APIs or Google OAuth','base':args.base,'elapsedSeconds':round(time.time()-started,2),'checks':len(results),'passed':sum(r['passed'] for r in results),'failed':len(failures),'browserErrors':errors,'results':results}
(out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='results'},indent=2))
sys.exit(1 if failures else 0)
