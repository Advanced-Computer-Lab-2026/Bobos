from harness import *
EVIDENCE=(HERE.parent/'evidence');EVIDENCE.mkdir(exist_ok=True)
checks=[];errors=[];screens=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce');page.set_default_timeout(4500);page.on('pageerror',lambda e:errors.append(str(e)))
 def start(role):
  global page
  page.close();page=b.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce');page.set_default_timeout(4500);page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_viewport_size({'width':1440,'height':1000});page.set_content(html.replace('<head>','<head>'+shim),wait_until='networkidle');page.get_by_label('GUC email',exact=True).fill(role+'@guc.edu.eg');page.get_by_label('Password',exact=True).fill('fixture-only');page.get_by_role('button',name='Sign in').click();page.locator('.sidebar').wait_for();page.wait_for_timeout(80)
 def nav(name):
  page.set_viewport_size({'width':1440,'height':1000});page.locator('.sidebar').get_by_role('button',name=name,exact=True).click();page.wait_for_timeout(80)
 def choose(n):page.get_by_label('Page design',exact=True).select_option(str(n));page.wait_for_timeout(12)
 def matrix(key,evidence=False):
  page.locator('[data-operation-page="'+key+'"]').wait_for()
  page.wait_for_timeout(50)
  actual=page.locator('[data-operation-page]').get_attribute('data-operation-page');assert actual==key,(key,actual)
  assert page.get_by_label('Page design',exact=True).count()==1,key
  assert page.get_by_label('Page design',exact=True).locator('option').count()==11,key
  for width,theme in [(1440,'light'),(1440,'dark'),(390,'light'),(390,'dark')]:
   page.set_viewport_size({'width':width,'height':1000 if width>500 else 844});page.evaluate('(theme)=>document.documentElement.dataset.theme=theme',theme)
   for variant in range(0,11):
    choose(variant)
    sizes=page.evaluate('({doc:document.documentElement.scrollWidth,window:innerWidth,body:document.body.scrollWidth})')
    checks.append({'page':key,'width':width,'theme':theme,'variant':variant,'overflow':max(sizes['doc'],sizes['body'])-width,'errors':len(errors)})
   if evidence and width in [1440,390] and theme=='light':
    choose(7 if key not in ['financial-reversal','payment-confirmation'] else 3)
    page.evaluate('window.scrollTo(0,0);document.querySelectorAll(".modal-card").forEach(x=>x.scrollTop=0)')
    filename=f'react-{key}-{width}-light.png';page.screenshot(path=str(EVIDENCE/filename));screens.append(filename)
  page.set_viewport_size({'width':1440,'height':1000});page.evaluate("document.documentElement.dataset.theme='light'");choose(1)
  (OUT/'react-matrix-report.json').write_text(json.dumps({'checks':checks,'browserErrors':errors,'screenshots':screens,'overflows':[x for x in checks if x['overflow']>1]},indent=2))
  print(key,'done',flush=True)
 start('coordinator')
 for key,name in [('pending-work','Pending work'),('schedule-activity','Schedule activity'),('financial-records','Financial records')]:
  nav(name);matrix(key,evidence=True)
 page.get_by_role('button',name='View',exact=True).first.click();matrix('financial-record-detail',True)
 page.get_by_role('button',name='Review reversal',exact=True).last.click();matrix('financial-reversal',True);page.get_by_role('button',name='Close reversal').click()
 nav('Extra-hours requests');matrix('extra-hours',True);page.get_by_role('button',name='Open request',exact=True).first.click();matrix('extra-hours-detail',True)
 nav('Graduation review');matrix('graduation-review',True);page.get_by_role('button',name='Open plan',exact=True).click();matrix('graduation-plan-review',True);page.get_by_role('button',name='Close',exact=True).click();page.get_by_role('button',name='Exit-exam requests',exact=True).click();matrix('exit-exam-review',True);page.get_by_role('button',name='Open request',exact=True).first.click();matrix('exit-exam-detail',True)
 start('advisor');nav('Extra-hours requests');page.get_by_role('button',name='New request',exact=True).click();matrix('extra-hours-request',True)
 nav('Advising students');page.get_by_role('button',name='Graduation plan',exact=True).first.click();matrix('graduation-plans',True);page.get_by_role('button',name='Open plan',exact=True).first.click();matrix('graduation-plan',True);page.get_by_role('button',name='Exit-exam requests',exact=True).click();matrix('exit-exam-request',True)
 start('advisingStudent');nav('Extra-hours requests');matrix('my-extra-hours',True);page.get_by_role('button',name='Wallet',exact=True).click();matrix('wallet',True);page.get_by_role('button',name='Financial history',exact=True).click();matrix('payment-history',True);page.get_by_role('button',name='Open confirmation',exact=True).first.click();matrix('payment-confirmation',True)
 page.get_by_role('button',name='Requests',exact=True).click();choose(1);page.get_by_role('button',name='Open request',exact=True).nth(1).click();choose(1);page.get_by_role('button',name='Choose payment option',exact=True).click();matrix('settlement',True);page.get_by_role('radio',name='Pay now through the sandbox gateway').check();page.get_by_role('button',name='Continue to gateway',exact=True).click();matrix('payment-gateway',True)
 nav('My graduation');matrix('my-graduation',True);page.get_by_role('button',name='Exit-exam responses',exact=True).click();matrix('my-exit-exams',True)
 b.close()
report={'status':'completed','runtime':'React 18.2.0 offline compatibility harness; source APIs intercepted only in tests','checks':checks,'screenshots':screens,'browserErrors':errors,'overflows':[x for x in checks if x['overflow']>1]}
(OUT/'react-matrix-report.json').write_text(json.dumps(report,indent=2))
print('TOTAL',len(checks),'ERRORS',errors,'OVERFLOWS',len(report['overflows']))
print(report['overflows'][:20])
