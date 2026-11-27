// Offline compatibility harness. Not production code; no package files modified.
const fs=require('fs'),path=require('path'),cp=require('child_process');
function typescript(){if(process.env.TYPESCRIPT_PATH)return require(process.env.TYPESCRIPT_PATH);try{return require('typescript');}catch{return require(path.join(cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'));}}
const ts=typescript();
if(process.argv.length!==4){console.error('Usage: node offline_bundle.cjs project/apps/web/src project/apps/web/public/__ops05_test');process.exit(1);}
const src=process.argv[2],out=process.argv[3];fs.mkdirSync(out,{recursive:true});
const jupyter=process.env.OPS05_JUPYTER_STATIC || cp.execFileSync(process.env.PYTHON || 'python3',['-c','import pathlib,jupyterlab;print(pathlib.Path(jupyterlab.__file__).parent / "static")'],{encoding:'utf8'}).trim();
for(const f of ['6540.51c00e890179a4832552.js','961.29c067b15a524e556eed.js'])if(!fs.existsSync(path.join(jupyter,f))){console.error('The exact archived React 18.2 Jupyter runtime is unavailable. Use the supplied project production build and manual acceptance checklist instead; do not claim these tests ran. Missing: '+f);process.exit(1);}
let runtime='window.__wm={};window.__wc={};self.webpackChunk_jupyterlab_application_top={push:x=>Object.assign(__wm,x[1])};\n';
for(const f of ['6540.51c00e890179a4832552.js','961.29c067b15a524e556eed.js'])runtime+=fs.readFileSync(path.join(jupyter,f),'utf8')+'\n';
runtime+=`function __wr(id){if(id===44914)id=96540;if(__wc[id])return __wc[id].exports;const m={exports:{}};__wc[id]=m;__wm[id](m,m.exports,__wr);return m.exports;}window.React=__wr(96540);window.ReactDOM=__wr(40961);\n`;
let modules='window.__modules={};window.__cache={};\n',count=0,errors=[];
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())walk(p);else if(/\.(jsx|js)$/.test(item.name)&&!item.name.includes('.test.')){
let text=fs.readFileSync(p,'utf8').replaceAll('import.meta.env.VITE_API_BASE_URL','"http://127.0.0.1:8000"').replaceAll('import.meta.env.DEV','false');
const result=ts.transpileModule(text,{fileName:p,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
for(const e of result.diagnostics.filter(d=>d.category===1))errors.push(p+':'+ts.flattenDiagnosticMessageText(e.messageText,' '));
const key='/'+path.relative(src,p);modules+=`__modules[${JSON.stringify(key)}]=function(require,module,exports){\n${result.outputText}\n};\n`;count++;
}}}walk(src);if(errors.length){console.log(errors);process.exit(1);}
const loader=`function __resolve(name,from){if(!name.startsWith('.'))return name;let bits=(from.slice(0,from.lastIndexOf('/')+1)+name).split('/'),out=[];for(const b of bits){if(b==='..')out.pop();else if(b!=='.'&&b)out.push(b);}return '/'+out.join('/');}
function __req(name,from='/main.jsx'){const key=__resolve(name,from);if(key==='react')return React;if(key==='react-dom'||key==='react-dom/client')return ReactDOM;if(key.endsWith('.css'))return {};if(__cache[key])return __cache[key].exports;if(!__modules[key])throw Error('Missing module '+key);const m={exports:{}};__cache[key]=m;__modules[key](n=>__req(n,key),m,m.exports);return m.exports;}
window.__opsModules=__req;__req('/main.jsx');`;
fs.writeFileSync(path.join(out,'app-test.js'),runtime+modules+loader);
fs.writeFileSync(path.join(out,'app-test.css'),['style.css','workspace-polish.css','form-controls.css','operations/operations-base.css','operations/operations-react.css'].map(f=>fs.readFileSync(path.join(src,f),'utf8').replace(/@import[^;]+;/g,'')).join('\n'));
fs.writeFileSync(path.join(out,'index.html'),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="app-test.css"></head><body><div id="root"></div><script src="app-test.js"></script></body></html>');
console.log(`Transpiled ${count} source modules with zero syntax errors. React 18.2.0 offline compatibility runtime; not a Vite/React 19 production build.`);
