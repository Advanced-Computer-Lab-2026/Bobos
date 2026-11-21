#!/usr/bin/env python3
"""Supplemental visual/interaction evidence; no live API or provider calls."""
import argparse
import json
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ap=argparse.ArgumentParser()
ap.add_argument('--base',default='http://localhost:8000')
ap.add_argument('--output',default='supplemental-evidence')
a=ap.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
checks=[];errors=[]
def check(name,condition,detail=None):
    checks.append({'name':name,'passed':bool(condition),'detail':detail})
def shot(page,name):page.screenshot(path=str(out/(name+'.png')))
def go(page,key,n=1,role='advisingStudent'):
    page.goto(f'{a.base}/portal-studio/index.html?preview=live&role={role}&page={key}')
    if key!='overview':
        page.locator('#content > label select').select_option(str(n))
        page.evaluate('PortalStudentLife.resetPreview()')
def scenario(page,key,value):page.evaluate('([k,v])=>PortalStudentLife.setScenario(k,v)',[key,value])
def action(page,value):page.locator(f'[data-sl2-action="{value}"]:visible').first.click()
def shell(page):return page.evaluate('''()=>{let result={};for(const selector of ['.sidebar','.topbar']){const e=document.querySelector(selector),r=e.getBoundingClientRect(),s=getComputedStyle(e);result[selector]={x:r.x,y:r.y,width:r.width,height:r.height,fontFamily:s.fontFamily,background:s.backgroundColor}}return result}''')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or shutil.which('chromium-browser'),args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
    page=context.new_page();page.set_default_timeout(7000);page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(a.base+'/portal-studio/index.html?preview=live')
    page.get_by_role('button',name='Sign in',exact=True).click()
    go(page,'overview',role='coordinator');page.wait_for_timeout(1800)
    initial=page.evaluate('calendarMonth')
    page.locator('[data-calendar-nav="1"]').click();page.wait_for_timeout(1600)
    check('overview:next-month',page.evaluate('calendarMonth')==initial+1)
    shot(page,'overview-next-month')
    page.locator('[data-calendar-nav="-1"]').click();page.wait_for_timeout(1600)
    check('overview:previous-month',page.evaluate('calendarMonth')==initial)
    page.locator('[data-calendar-nav="1"]').click();page.wait_for_timeout(1600)
    page.locator('[data-calendar-nav="today"]').click();page.wait_for_timeout(1600)
    check('overview:today',page.evaluate('calendarMonth')==0)
    if page.locator('[data-deadline]').count():
        page.locator('[data-deadline]').first.click()
        check('overview:deadline-detail',page.locator('[data-deadline]').first.get_attribute('aria-pressed')=='true')
        shot(page,'overview-deadline-open')
        page.locator('[data-deadline]').first.click()
    for mode in ['dark','light']:
        go(page,'overview',role='coordinator');page.evaluate(f'lab.dark={str(mode=="dark").lower()};applyLook();render()');page.wait_for_timeout(1000)
        shot(page,'teaching-week-'+mode)
        page.locator('.desk-calendar').scroll_into_view_if_needed();shot(page,'teaching-week-calendar-'+mode)
    # Same role, viewport, theme and untouched shell for side-by-side comparison.
    for mode in ['dark','light']:
        go(page,'overview');page.evaluate(f'lab.dark={str(mode=="dark").lower()};applyLook();render()');page.wait_for_timeout(1200)
        before=shell(page);shot(page,'overview-'+mode)
        for key,n in [('my-schedule',6),('records',4),('my-advisor',6)]:
            page.locator(f'.sidebar [data-page="{key}"]').click()
            page.locator('#content > label select').select_option(str(n))
            page.wait_for_timeout(120)
            after=shell(page)
            check(f'continuity:{mode}:{key}',before==after,{'overview':before,'page':after})
            shot(page,f'continuity-{mode}-{key}-{n}')
            page.locator('.sidebar .navlink[data-page="overview"]').click()
    # A real mobile navigation control, not a forced click on a hidden sidebar.
    page.set_viewport_size({'width':390,'height':844});go(page,'overview');page.wait_for_timeout(600)
    page.locator('[data-action="mobile-menu"]').click()
    check('mobile:navigation-open',page.locator('dialog[open] nav[aria-label="Mobile navigation"]').is_visible())
    shot(page,'mobile-navigation-open')
    page.locator('dialog[open] [data-page="my-schedule"]').click()
    check('mobile:navigation-route',page.locator('#content').get_attribute('data-screen')=='my-schedule')
    page.locator('#content > label select').select_option('2');page.evaluate('PortalStudentLife.resetPreview()')
    action(page,'request-slot');page.locator('.sl2-dialog textarea').fill('Please consider a later tutorial. Local preview only.')
    shot(page,'mobile-slot-request-form')
    page.locator('.sl2-dialog button[type="submit"]').click()
    check('mobile:slot-submit',page.evaluate('PortalStudentLife.readPreview().requests[0].status')=='Pending')
    shot(page,'mobile-slot-request-pending')
    # Representative permission, terminal and recovery states.
    page.set_viewport_size({'width':1440,'height':1000})
    for key,n,role,state,label in [
        ('my-schedule',10,'advisingStudent','resolved','schedule-resolved'),
        ('my-schedule',6,'advisor','draft','staff-incomplete-draft'),
        ('my-schedule',2,'advisingStudent','draft','student-unreleased-draft'),
        ('my-schedule',3,'normalStudent','processed','processed-schedule'),
        ('preferences',5,'advisor','default','staff-preferences-readonly'),
        ('preferences',6,'advisingStudent','deadline','preferences-deadline'),
        ('records',7,'advisingStudent','empty','records-empty'),
        ('my-advisor',2,'advisingStudent','unassigned','advisor-unassigned'),
        ('my-courses',10,'advisingStudent','error','courses-load-error'),
    ]:
        go(page,key,n,role);scenario(page,key,state);shot(page,label)
    go(page,'preferences',3)
    action(page,'add-time')
    page.locator('[data-field="start"]').last.fill('12:00');page.locator('[data-field="end"]').last.fill('10:00')
    page.locator('[data-action="save-preferences"]').click()
    check('state:preference-validation',page.locator('.sl2-feedback[role="alert"]').count()>0)
    page.locator('.sl2-feedback').scroll_into_view_if_needed();shot(page,'preference-validation')
    go(page,'calendar-sync',9,'normalStudent');scenario(page,'calendar-sync','conflict');action(page,'sync-now')
    page.wait_for_function('document.querySelector("[data-sl2-action=sync-now]")?.textContent==="Retry sync"')
    shot(page,'calendar-retry');action(page,'sync-now')
    page.wait_for_function('PortalStudentLife.readPreview().syncHistory.length===1');shot(page,'calendar-retried')
    check('state:calendar-recovery',page.evaluate('PortalStudentLife.readPreview().syncHistory.length')==1)
    go(page,'schedule-swap',3,'normalStudent')
    page.locator('[data-sl2-destination="1"]').check();page.locator('[data-sl2-destination="2"]').check();action(page,'submit-swap')
    shot(page,'swap-confirmation');page.locator('.sl2-dialog button[type="submit"]').click();shot(page,'swap-open-request')
    check('state:swap-open',page.evaluate('PortalStudentLife.readPreview().swaps[0].status')=='Open')
    check('runtime:no-errors',not errors,errors)
    browser.close()
report={'scope':'Supplemental host operation, visual continuity and local preview states','checks':len(checks),'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'browserErrors':errors,'results':checks}
(out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='results'},indent=2))
raise SystemExit(1 if report['failed'] else 0)
