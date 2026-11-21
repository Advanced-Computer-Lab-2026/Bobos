import { readFile, writeFile } from 'node:fs/promises';
const files = ['src/rules.js','src/motion.js','src/studio.js'];
await writeFile(new URL('pages.js',import.meta.url), '// Generated from src/ by node build.mjs. No external runtime dependencies.\n' + (await Promise.all(files.map(f=>readFile(new URL(f,import.meta.url),'utf8')))).join('\n'));
