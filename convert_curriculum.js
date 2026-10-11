const fs = require('fs');

const raw = fs.readFileSync('C:/Users/Dareen/Desktop/Untitled spreadsheet - MET and DMET Curriculum.csv', 'utf8');
const lines = raw.split(/\r?\n/);

let curSemester = 1;
let curMajor = 'All';
const courseMap = new Map();

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const mSem = line.match(/^(\d+)(?:st|nd|rd|th)?\s*Semester/i);
  if (mSem) {
    curSemester = parseInt(mSem[1], 10);
    curMajor = 'All';
    continue;
  }
  if (line.toLowerCase().startsWith('english')) {
    curSemester = 1;
    curMajor = 'All';
    continue;
  }
  if (line.toLowerCase().startsWith('german')) {
    curSemester = 1;
    curMajor = 'All';
    continue;
  }
  if (line.includes('For CSEN Major')) {
    curMajor = 'CS';
    continue;
  }
  if (line.includes('For DMET Major')) {
    curMajor = 'DMET';
    continue;
  }

  // Parse comma-delimited columns
  const parts = [];
  let cur = '';
  let inQ = false;
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) {
      parts.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  parts.push(cur.trim());

  if (parts.length < 3) continue;

  const col0 = parts[0].replace(/^"|"$/g, '').trim();
  const col1 = parts[1].replace(/^"|"$/g, '').trim();
  const col2 = parts[2].replace(/^"|"$/g, '').trim();

  if (!col0 || col0.toLowerCase().includes('course code') || col0.toLowerCase().includes('note that')) {
    continue;
  }

  const code = (col0 + col1).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!code || code.length < 4 || code.includes('XXXX')) continue;

  const name = col2.replace(/\s+/g, ' ').trim();
  if (!name || name.toLowerCase().includes('elective') || name.toLowerCase().includes('seminar')) continue;

  const total = parseFloat(parts[6]) || 0;

  let credits = 4;
  if (name.toLowerCase().includes('german') || name.toLowerCase().includes('english') || name.toLowerCase().includes('methods') || name.toLowerCase().includes('presentation') || name.toLowerCase().includes('writing') || name.toLowerCase().includes('management')) {
    credits = 2;
  } else if (total >= 8) {
    credits = 6;
  }

  let type = 'core';
  if (name.toLowerCase().includes('german') || name.toLowerCase().includes('english') || name.toLowerCase().includes('methods') || name.toLowerCase().includes('presentation') || name.toLowerCase().includes('writing') || name.toLowerCase().includes('management') || code.startsWith('HUMA')) {
    type = 'huma';
  }

  const rawP = [parts[7], parts[8], parts[9]].filter(Boolean);
  const prereqs = [];
  for (const p of rawP) {
    const cleanP = p.replace(/\s+/g, '').replace(/X/gi, '').toUpperCase();
    if (cleanP && cleanP.length >= 4) {
      prereqs.push(cleanP);
    }
  }

  const majors = curMajor === 'All' ? ['CS', 'DMET'] : [curMajor];

  if (!courseMap.has(code)) {
    courseMap.set(code, {
      code,
      name,
      credits,
      type,
      majors,
      semester: curSemester <= 10 ? curSemester : 1,
      seasons: ['winter', 'spring'],
      prereqs,
    });
  } else {
    const existing = courseMap.get(code);
    for (const m of majors) {
      if (!existing.majors.includes(m)) existing.majors.push(m);
    }
  }
}

// Ensure prerequisites only point to courses defined in this catalogue
const allCodes = new Set(courseMap.keys());
for (const [code, c] of courseMap.entries()) {
  c.prereqs = c.prereqs.filter((p) => allCodes.has(p) && p !== code);
}

const header = 'Course Code,Course Name,Credit Hours,Course Type,Faculty/Major,Recommended Semester,Offering Season,Prerequisites';
const outRows = [header];

for (const c of courseMap.values()) {
  const majorStr = c.type === 'huma' && c.majors.length >= 2 ? 'All' : c.majors.join('; ');
  const prereqStr = c.prereqs.join('; ');
  const seasonStr = c.seasons.join('; ');
  outRows.push([
    c.code,
    `"${c.name.replace(/"/g, '""')}"`,
    c.credits,
    c.type,
    `"${majorStr}"`,
    c.semester,
    `"${seasonStr}"`,
    `"${prereqStr}"`
  ].join(','));
}

const outFile = 'C:/Users/Dareen/Desktop/MET_and_DMET_Curriculum_Importable.csv';
fs.writeFileSync(outFile, outRows.join('\n'), 'utf8');
console.log(`Successfully generated ${outRows.length - 1} courses into ${outFile}`);
