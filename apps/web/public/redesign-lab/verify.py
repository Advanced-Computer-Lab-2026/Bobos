"""Browser QA for the review artifacts; no application services are needed."""
import json
import os
from pathlib import Path
import sys
import shutil

if os.environ.get('BOBOS_PLAYWRIGHT_PATH'):
    sys.path.insert(0, os.environ['BOBOS_PLAYWRIGHT_PATH'])
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
(ROOT / 'screenshots').mkdir(exist_ok=True)
chrome_path = os.environ.get('CHROME_PATH') or shutil.which('google-chrome') or shutil.which('chromium')
if not chrome_path:
    chrome_path = next((str(path) for path in [
        Path('C:/Program Files/Google/Chrome/Application/chrome.exe'),
        Path('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
    ] if path.is_file()), None)
report = {'views': [], 'errors': [], 'interactions': []}

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=chrome_path, headless=True, args=['--disable-gpu', '--no-first-run'])
    context = browser.new_context(viewport={'width':1440,'height':1100}, device_scale_factor=1)
    page = context.new_page()
    page.on('pageerror', lambda error: report['errors'].append(str(error)))
    for number, name in enumerate(['quiet','editorial','studio','clay','contrast'],1):
        url = f'http://127.0.0.1:4178/{number:02}-{name}.html'
        page.goto(url)
        page.evaluate('document.fonts.ready')
        page.evaluate("Promise.all([document.fonts.load('13px Styrene'),document.fonts.load('24px Tiempos')])")
        routes = page.locator('#page-select option').evaluate_all('(els)=>els.map(e=>e.value)')
        for width, height in [(1440,1100),(390,844)]:
            page.set_viewport_size({'width':width,'height':height})
            for route in routes:
                page.select_option('#page-select',route)
                page.evaluate('document.fonts.ready')
                checks = page.evaluate('''()=>({heading:!!document.querySelector('h1'),overflow:document.documentElement.scrollWidth>innerWidth+1,emoji:/\\p{Extended_Pictographic}/u.test(document.body.innerText),badFooter:/Academic portal|Development workspace|Active session/.test(document.body.innerText),fonts:[document.body,document.querySelector('h1')].every(el=>{const s=getComputedStyle(el);return document.fonts.check(s.fontWeight+' '+s.fontSize+' '+s.fontFamily)})})''')
                report['views'].append({'version':number,'width':width,'route':route,**checks})
                if not checks['heading'] or checks['overflow'] or checks['emoji'] or checks['badFooter'] or not checks['fonts']:
                    report['errors'].append({'version':number,'width':width,'route':route,'checks':checks})
            page.select_option('#page-select','overview')
            page.screenshot(path=str(ROOT/'screenshots'/f'{number:02}-{name}-{width}.png'),full_page=True)
        print(f'Version {number}: {len(routes)*2} page/viewport checks complete.',flush=True)
    page.set_viewport_size({'width':1440,'height':1100})
    page.goto('http://127.0.0.1:4178/01-quiet.html?page=notifications')
    before=page.locator('.inbox-item').count()
    page.get_by_role('button',name='Create test notification').click()
    assert page.locator('.inbox-item').count()==before+1
    page.get_by_role('button',name='Mark all as read',exact=True).click()
    page.get_by_role('tab',name='Unread',exact=True).click()
    assert page.get_by_text('No unread notifications.',exact=True).is_visible()
    report['interactions'].append('Create test notification, mark all read, unread tab')
    page.select_option('#page-select','directory')
    page.locator('#search').fill('Omar')
    assert page.locator('tbody tr:visible').count()==1
    page.locator('#search').fill('zzzz')
    assert page.locator('tbody tr:visible').count()==0
    report['interactions'].append('Student search and empty results')
    page.select_option('#page-select','courses')
    page.get_by_role('button',name='Add course',exact=True).click()
    assert page.locator('dialog').is_visible()
    page.keyboard.press('Escape')
    assert not page.locator('dialog').is_visible()
    assert page.get_by_role('button',name='Add course',exact=True).evaluate('(el)=>el===document.activeElement')
    report['interactions'].append('Dialog opens, Escape closes, trigger focus restored')
    page.select_option('#page-select','mandatory-removals')
    page.get_by_role('button',name='Review request',exact=True).first.click()
    page.locator('dialog textarea').fill('Approved after reviewing the credit load.')
    page.get_by_role('button',name='Submit decision',exact=True).click()
    assert not page.locator('dialog').is_visible()
    report['interactions'].append('Removal decision dialog validates and submits')
    page.select_option('#page-select','financial-records')
    with page.expect_download() as download:
        page.get_by_role('button',name='Export CSV',exact=True).click()
    assert download.value.suggested_filename=='sample-financial-records.csv'
    report['interactions'].append('CSV export downloads a file')
    page.select_option('#page-select','calendar-sync')
    page.get_by_role('button',name='Disconnect',exact=True).click()
    assert page.get_by_role('button',name='Connect account',exact=True).is_visible()
    report['interactions'].append('Calendar connected and disconnected states')
    for role in ['normalStudent','advisingStudent','advisor','administrator','coordinator']:
        page.select_option('#role-select',role)
        assert page.locator('h1').inner_text().startswith('Good day')
    report['interactions'].append('All five role navigation sets')
    page.goto('http://127.0.0.1:4178/01-quiet.html?page=forgot')
    page.get_by_label('University email',exact=True).fill('sample@guc.edu.eg')
    page.get_by_role('button',name='Send reset code',exact=True).click()
    page.get_by_label('Reset code',exact=True).fill('123456')
    page.get_by_label('New password',exact=True).fill('SamplePassword!')
    page.get_by_role('button',name='Update password',exact=True).click()
    assert page.get_by_role('heading',name='Welcome back.',exact=True).is_visible()
    report['interactions'].append('Password reset preview flow')
    page.goto('http://127.0.0.1:4178/01-quiet.html?page=directory')
    page.screenshot(path=str(ROOT/'screenshots'/'quiet-directory.png'),full_page=True)
    page.select_option('#page-select','my-schedule')
    page.screenshot(path=str(ROOT/'screenshots'/'quiet-schedule.png'),full_page=True)
    page.select_option('#page-select','login')
    page.screenshot(path=str(ROOT/'screenshots'/'quiet-login.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    page.select_option('#page-select','overview')
    page.get_by_role('button',name='Menu',exact=True).click()
    page.locator('dialog').get_by_role('link',name='Student directory',exact=True).click()
    assert not page.locator('dialog').is_visible()
    assert page.get_by_role('heading',name='Student directory',exact=True).is_visible()
    report['interactions'].append('Mobile menu opens and navigates')
    page.goto('http://127.0.0.1:4178/compare.html')
    assert page.locator('article').count()==5
    page.set_viewport_size({'width':1440,'height':1100})
    page.evaluate('document.fonts.ready')
    page.screenshot(path=str(ROOT/'comparison.png'),full_page=True)
    page.goto((ROOT/'01-quiet.html').as_uri())
    assert page.get_by_role('heading',name='Good day, Nadia.',exact=True).is_visible()
    report['interactions'].append('Standalone HTML opens directly without a server')
    browser.close()

(ROOT/'qa-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({'views':len(report['views']),'errors':report['errors'],'interactions':report['interactions']},indent=2))
if report['errors']:
    sys.exit(1)
