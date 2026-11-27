#!/usr/bin/env python3
"""Smoke + local-preview workflow tests, run after copying this folder into a fresh baseline.
python studio-browser.py --url http://127.0.0.1:8000/portal-studio/index.html --output studio-evidence
These tests exercise preview state, not server authorization, MongoDB, SMTP or concurrency.
"""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
KEYS=['directory','advising','student-schedules','mandatory-removals','student-detail','draft-schedule']
STORE='portal-ad4-preview:v2'
def run(args):
 out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
 result={'renders':[],'checks':[],'errors':[],'source':'fresh-baseline static Portal preview'}
 def check(name,ok=True):
  assert ok,name
  result['checks'].append(name)
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox'])
  def page_for(role='coordinator',reduce=False):
   ctx=b.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce' if reduce else 'no-preference');p=ctx.new_page();p.on('pageerror',lambda e: result['errors'].append(str(e)))
   p.goto(args.url+'?preview=live&role='+role);p.locator('#auth-form button[type=submit]').click();p.wait_for_timeout(80)
   return ctx,p
  def go(p,key,student=0,n=None):
   p.evaluate('([key,student])=>{page=key;selectedStudent=student;tab="details";render();}',[key,student])
   if n is not None:p.locator('#content > label select').select_option(str(n))
  def data(p):return p.evaluate('(key)=>JSON.parse(localStorage.getItem(key))',STORE)
  ctx,p=page_for()
  check('only six owned registry keys',p.evaluate('JSON.stringify(portalAdvising04.keys.sort())')==json.dumps(sorted(KEYS),separators=(',',':')))
  check('all six keys have ten choices',p.evaluate('portalAdvising04.keys.every(k=>portalVariants[k].length===10)'))
  # Baseline calendar and shell dimensions are measured before entering any variant.
  for dark in [False,True]:
   p.evaluate('(dark)=>{lab.dark=dark;applyLook();page="overview";render();}',dark);p.wait_for_timeout(1600)
   p.locator('[data-calendar-nav="1"]').first.click();p.locator('[data-calendar-nav="-1"]').first.click()
   p.screenshot(path=str(out/f'overview-{"dark" if dark else "light"}.png'),full_page=False)
  shell=p.locator('.sidebar').bounding_box();header=p.locator('.topbar').bounding_box()
  if not args.workflow_only:
   for key in KEYS:
    go(p,key,n=0);check(f'{key}:Original selectable',p.locator('#content[data-ad4]').count()==0)
    for dark in [False,True]:
     p.evaluate('(dark)=>{lab.dark=dark;applyLook();render();}',dark)
     for width,height in [(1440,1000),(390,844)]:
      p.set_viewport_size({'width':width,'height':height})
      for n in range(1,11):
       p.locator('#content > label select').select_option(str(n));p.wait_for_timeout(25)
       overflow=p.evaluate('document.documentElement.scrollWidth>innerWidth+1')
       result['renders'].append({'page':key,'role':'coordinator','design':n,'theme':'dark' if dark else 'light','width':width,'overflow':overflow})
       assert not overflow,(key,n,dark,width,'page overflow')
       assert p.locator('#content > label select').count()==1
       assert p.locator('#content > label select option').count()==11
       assert p.locator('#content[data-ad4-design="'+str(n)+'"]').count()==1
       if width==1440:
        box=p.locator('.sidebar').bounding_box();head=p.locator('.topbar').bounding_box();assert box['width']==shell['width'] and head['height']==header['height']
       if (not dark and width==1440) or (n==3):
        p.wait_for_timeout(80);p.screenshot(path=str(out/f'{key}-{n}-{"dark" if dark else "light"}-{width}.png'),full_page=False)
    p.set_viewport_size({'width':1440,'height':1000});p.evaluate('lab.dark=false;applyLook();render()')
  # Independent selection, genuine departure and return through existing links.
  for k,n in zip(KEYS,[2,3,4,5,6,7]):go(p,k,n=n)
  for key,n in zip(KEYS,[2,3,4,5,6,7]):
   p.locator('.sidebar a.navlink[data-page="overview"]').click();
   if key in ['student-detail','draft-schedule']:
    p.locator('.sidebar a[data-page="directory"]').click();p.locator('#search').fill('Omar');p.locator('#content a[data-page="student-detail"]:visible').first.click()
    if key=='draft-schedule':p.locator('#content a[data-page="draft-schedule"]').first.click()
   else:p.locator(f'.sidebar a[data-page="{key}"]').click()
   check(f'{key}:independent design persists after navigation',p.locator('#content > label select').input_value()==str(n))
  # Filter return and empty states.
  go(p,'directory',n=3);p.locator('#search').fill('71578');expect(p.locator('[data-ad4-count]')).to_contain_text('1 of')
  p.locator('#content a[data-page="student-detail"]:visible').first.click();p.locator('#content a[data-page="directory"]').first.click();check('directory filters survive student round-trip',p.locator('#search').input_value()=='71578')
  p.locator('#search').fill('no-match');expect(p.locator('.ad4-empty')).to_be_visible();p.locator('[data-ad4-action=clear-filters]').first.click();check('empty search and clear',p.locator('#search').input_value()=='')
  go(p,'directory',n=9);boxes=p.locator('[data-ad4-compare]');boxes.nth(0).check();boxes.nth(1).check();check('comparison limited to two',boxes.nth(2).is_disabled())
  # Confirmed assignment; keyboard cancellation preserves data and restores focus.
  go(p,'student-detail',student=0,n=1);trigger=p.locator('[data-action=assign-advisor]');trigger.click();p.keyboard.press('Escape');expect(p.locator('.ad4-dialog')).to_have_count(0);check('native dialog Escape removes dialog',p.locator('.ad4-dialog').count()==0);check('dialog restores trigger focus',trigger.evaluate('(e)=>e===document.activeElement'))
  trigger.click();p.locator('.ad4-dialog select[name=advisor]').select_option('Dr. Hany Youssef');p.locator('.ad4-dialog button[type=submit]').click();expect(p.locator('.ad4-dialog')).to_have_count(0);p.wait_for_timeout(50);check('coordinator reassignment retains history',data(p)['students'][0]['advisor']=='Dr. Hany Youssef' and len(data(p)['students'][0]['history'])==2)
  # Coordinator mandatory decisions require response; acceptance edits only unprocessed drafts.
  go(p,'mandatory-removals',n=3);p.locator('[data-ad4-action=context-removal]').click();p.locator('.ad4-dialog select[name=decision]').select_option('Approved');p.locator('.ad4-dialog button[type=submit]').click();check('removal response is required',p.locator('.ad4-dialog').count()==1)
  p.locator('.ad4-dialog textarea[name=note]').fill('First makeup route confirmed.');p.locator('.ad4-dialog button[type=submit]').click();p.wait_for_timeout(70)
  check('approved removal updates mandatory exemption and unprocessed draft',data(p)['removals'][0]['status']=='Approved' and 'CSEN 701' in data(p)['drafts'][0]['removed'] and 'CSEN 701' not in data(p)['drafts'][0]['courses'])
  p.locator('[data-ad4-action=next-record]').click();p.locator('[data-ad4-action=context-removal]').click();p.locator('.ad4-dialog select[name=decision]').select_option('Rejected');p.locator('.ad4-dialog textarea[name=note]').fill('The course must remain in the current draft.');p.locator('.ad4-dialog button[type=submit]').click();p.wait_for_timeout(50);check('rejection retains the mandatory course',data(p)['removals'][1]['status']=='Rejected' and 'CSEN 703' in data(p)['drafts'][1]['courses'])
  go(p,'draft-schedule',student=10,n=1);p.locator('[data-ad4-action=slots][data-code="CSEN 704"]').click();check('full lab option disabled',p.locator('.ad4-dialog select[name=lab] option[value="CSEN 704:lab:9"]').evaluate('(e)=>e.disabled'));p.locator('.ad4-dialog select[name=lab]').select_option('');p.locator('.ad4-dialog button[type=submit]').click();p.wait_for_timeout(40);check('component removal makes draft incomplete',p.locator('[data-ad4-action=mark-ready]').is_disabled());p.locator('[data-ad4-action=slots][data-code="CSEN 704"]').click();p.locator('.ad4-dialog select[name=lab]').select_option('CSEN 704:lab:4');p.locator('.ad4-dialog button[type=submit]').click();p.wait_for_timeout(40);check('assigning required lab restores validity',p.locator('[data-ad4-action=mark-ready]').is_enabled())
  # Draft 10 is a complete editable advising draft with no external blockers.
  go(p,'draft-schedule',student=10,n=1);expect(p.locator('[data-ad4-action=mark-ready]')).to_be_enabled();p.locator('[data-ad4-action=mark-ready]').click();p.locator('.ad4-dialog button[type=submit]').click();p.wait_for_timeout(50)
  check('complete draft becomes review-ready',data(p)['drafts'][10]['status']=='Ready for student review');p.screenshot(path=str(out/'draft-ready.png'),full_page=False)
  p.locator('[data-action=process]').click();p.locator('.ad4-dialog button[type=submit]').click();p.wait_for_timeout(50);check('review-ready valid draft processes',data(p)['drafts'][10]['status']=='Processed');p.screenshot(path=str(out/'draft-processed.png'),full_page=False)
  p.locator('[data-ad4-action=reopen]').click();p.locator('.ad4-dialog button[type=submit]').click();check('reopening requires reason',p.locator('.ad4-dialog').count()==1)
  p.locator('.ad4-dialog textarea[name=reason]').fill('Review requested after timetable publication.');p.locator('.ad4-dialog button[type=submit]').click();p.wait_for_timeout(50);check('reopening returns Draft and retains history',data(p)['drafts'][10]['status']=='Draft' and len(data(p)['drafts'][10]['history'])==3)
  go(p,'draft-schedule',student=1,n=1);check('missing component and pending request block readiness',p.locator('[data-ad4-action=mark-ready]').is_disabled() and p.locator('[data-action=process]').is_disabled());p.locator('[data-action=save-draft]').click();check('incomplete draft can be saved',data(p)['drafts'][1]['version']>1)
  go(p,'draft-schedule',student=2,n=7);check('absent preferences are explicitly optional','No scheduling preferences submitted' in p.locator('#content').inner_text())
  go(p,'draft-schedule',student=11,n=10);check('payment-choice blocker prevents processing',p.locator('[data-action=process]').is_disabled())
  go(p,'draft-schedule',student=10,n=6);p.locator('[data-ad4-step="1"]').click();check('step two exposes timetable',p.locator('.ad4-week').is_visible());p.locator('[data-ad4-step="2"]').click();check('step three exposes validation',p.locator('[data-ad4-part=validation]').is_visible())
  # Native sign-out/sign-in and Overview remain outside the variant.
  p.locator('.account-button').click();p.locator('[data-action=sign-out]').click();expect(p.locator('#auth-form')).to_be_visible();p.locator('#auth-form button[type=submit]').click();expect(p.locator('#content')).to_have_attribute('data-screen','overview');p.locator('.sidebar a[data-page=advising]').click();check('sign out → sign in → Overview → advising preserves choice',p.locator('#content > label select').input_value()=='3')
  ctx.close()
  # Every design additionally exercised as Advisor and Administrator at desktop light.
  for role in ['advisor','administrator']:
   ctx,p=page_for(role);p.evaluate('lab.dark=false;applyLook();render()')
   for key in KEYS:
    go(p,key)
    for n in range(1,11):
     p.locator('#content > label select').select_option(str(n));p.wait_for_timeout(15);overflow=p.evaluate('document.documentElement.scrollWidth>innerWidth+1');assert not overflow
     result['renders'].append({'page':key,'role':role,'design':n,'theme':'light','width':1440,'overflow':overflow})
   if role=='advisor':
    go(p,'directory',n=3);check('advisor cannot use full directory',p.locator('.ad4-unavailable').count()==1)
    go(p,'advising',n=3);check('advisor can browse other advisors’ advising students','Dr. Hany Youssef' in p.locator('#content').inner_text());p.locator('[data-ad4-action=my-students]').click();check('my-assigned is an optional filter',p.locator('[data-ad4-filter=advisor]').input_value()=='Dr. Salma Adel')
    go(p,'student-detail',n=1);check('advisor has no reassignment action',p.locator('[data-action=assign-advisor]').count()==0)
    go(p,'mandatory-removals',n=3);p.locator('[data-ad4-action=context-removal]').click();check('advisor cannot decide removals',p.locator('.ad4-dialog select[name=decision]').count()==0);p.keyboard.press('Escape')
    go(p,'draft-schedule',student=4,n=1);p.locator('[data-ad4-action=request-removal]').first.click();check('ineligible second makeup disabled',p.locator('.ad4-dialog select[name=reason] option',has_text='Second makeup').evaluate('(e)=>e.disabled'));p.locator('.ad4-dialog select[name=reason]').select_option('First makeup');p.locator('.ad4-dialog textarea[name=note]').fill('Use the first makeup opportunity.');p.locator('.ad4-dialog button[type=submit]').click();p.wait_for_timeout(40);check('assigned advisor submits eligible request without removing course',data(p)['drafts'][4]['pendingRemoval'] and 'CSEN 701' in data(p)['drafts'][4]['courses'])
   else:
    go(p,'advising',n=1);check('administrator cannot use advising browser',p.locator('.ad4-unavailable').count()==1)
    go(p,'student-detail',n=1);check('administrator has no transcript',p.locator('.ad4-academic').count()==0);p.locator('[data-ad4-action=account-status]').click();p.locator('.ad4-dialog button[type=submit]').click();p.wait_for_timeout(40);check('administrator confirms account access without deleting record',data(p)['students'][0]['account']=='Inactive' and len(data(p)['students'])==12)
    go(p,'draft-schedule',n=1);check('administrator draft is read-only',p.locator('[data-action=save-draft]').is_disabled() and p.locator('[data-action=process]').is_disabled())
   ctx.close()
  ctx,p=page_for(reduce=True);go(p,'directory',n=3);svg=p.locator('[data-ad4-art]').first;first=svg.get_attribute('data-pose');p.wait_for_timeout(1000);check('reduced motion keeps owned drawing at rest',svg.get_attribute('data-pose')==first);ctx.close()
  b.close()
 check('no browser JavaScript errors',not result['errors']);(out/'studio-results.json').write_text(json.dumps(result,indent=2));print(json.dumps({'renders':len(result['renders']),'checks':len(result['checks']),'errors':result['errors']},indent=2))
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:8000/portal-studio/index.html');a.add_argument('--output',default='studio-evidence');a.add_argument('--browser',default='/usr/bin/chromium');a.add_argument('--workflow-only',action='store_true');run(a.parse_args())
