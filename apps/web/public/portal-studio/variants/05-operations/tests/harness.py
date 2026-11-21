"""Explicitly restricted-browser test transport, not a production app entry point."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import urllib.request,json,os
HERE=Path(__file__).resolve().parent
BASE=os.environ.get('OPS05_REACT_BASE','http://127.0.0.1:8000/__ops05_test/').rstrip('/')+'/'
OUT=HERE/'reports';OUT.mkdir(exist_ok=True)
html=urllib.request.urlopen(BASE+'index.html').read().decode()
fixture=(HERE/'fixtures.js').read_text()
shim=f'''<base href="{BASE}"><script>window.__store={{}};Object.defineProperty(window,'localStorage',{{value:{{getItem:k=>__store[k]??null,setItem:(k,v)=>__store[k]=String(v),removeItem:k=>delete __store[k]}}}});history.pushState=history.replaceState=()=>{{}};{fixture}</script>'''
