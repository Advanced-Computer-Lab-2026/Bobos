// Requirement 49 - the student's PROCESSED schedule as a printable PDF.
// Two pure layers so the content is testable without parsing a PDF:
//   buildPdfModel(...)     -> every string / row / block the PDF is drawn from
//   renderSchedulePdf(...) -> Promise<Buffer> (pdfkit, A4 landscape, in memory)
// The calendar input is the SAME buildWeeklyCalendar() output req 31 serves,
// so courses, days off and credit-hour totals always agree with the screen.
import PDFDocument from 'pdfkit';
import { TEACHING_DAYS } from './weeklyCalendar.js';
import { toMinutes } from './timetable.js';

const TYPE_SHORT = { lecture: 'L', tutorial: 'T', lab: 'Lab' };
const TYPE_LABEL = { lecture: 'Lecture', tutorial: 'Tutorial', lab: 'Lab' };
const STATUS_LABEL = { processed: 'Processed', ready_for_student_review: 'Ready for student review', draft: 'Draft' };
const MAX_NAME = 160;

const clip = (s, max = MAX_NAME) => {
  const str = String(s == null ? '' : s);
  return str.length > max ? `${str.slice(0, max - 3)}...` : str;
};
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function scheduleFileName(student, term) {
  const safe = (v) => String(v == null ? '' : v).replace(/\//g, '-').replace(/[^A-Za-z0-9._-]/g, '');
  return `schedule-${safe(student.studentId)}-${safe(term.academicYear)}-${safe(term.season)}.pdf`;
}

function formatTimestamp(date) {
  try {
    return `${new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo'
    }).format(date)} (Cairo time)`;
  } catch (err) {
    return date.toISOString();
  }
}

export function buildPdfModel({ student, term, schedule, calendar, generatedAt = new Date() }) {
  const blocks = TEACHING_DAYS.flatMap((day) =>
    (calendar.week[day] || []).map((s) => ({
      day,
      type: s.type,
      courseCode: s.courseCode,
      typeLabel: TYPE_SHORT[s.type] || s.type,
      groupNumber: s.groupNumber || '',
      room: s.room || '',
      startTime: s.startTime,
      endTime: s.endTime
    }))
  );
  const starts = blocks.map((b) => Math.floor(toMinutes(b.startTime) / 60) * 60).filter(Number.isFinite);
  const ends = blocks.map((b) => Math.ceil(toMinutes(b.endTime) / 60) * 60).filter(Number.isFinite);

  const courses = calendar.courses.map((c) => ({
    courseCode: c.courseCode,
    courseName: clip(c.courseName),
    creditHours: c.creditHours || 0,
    sessions: c.slots.map(
      (s) => `${TYPE_LABEL[s.type] || s.type}${s.groupNumber ? ` (${s.groupNumber})` : ''}: ${s.day} ${s.startTime}-${s.endTime}, ${s.room || '-'}`
    )
  }));

  return {
    title: 'Weekly Schedule',
    fileName: scheduleFileName(student, term),
    header: [
      { label: 'Full name', value: student.fullName || '-' },
      { label: 'Student ID', value: student.studentId || '-' },
      { label: 'GUC email', value: student.email || '-' },
      { label: 'Major', value: student.major || '-' },
      { label: 'Semester', value: student.currentSemester != null ? String(student.currentSemester) : '-' },
      { label: 'Academic term', value: `${term.season} ${term.academicYear}` },
      { label: 'Study group', value: schedule.studyGroup || '-' },
      { label: 'Status', value: STATUS_LABEL[schedule.status] || schedule.status },
      { label: 'Generated', value: formatTimestamp(generatedAt) }
    ],
    days: TEACHING_DAYS,
    daysOff: calendar.daysOff,
    daysOffLine: `Days off: ${calendar.daysOff.length ? calendar.daysOff.join(', ') : 'none'}`,
    grid: {
      startMinutes: Math.min(8 * 60, ...starts),
      endMinutes: Math.max(18 * 60, ...ends),
      blocks
    },
    courses,
    courseCount: courses.length,
    totalCreditHours: calendar.totalCreditHours,
    totalLine: `Total credit hours: ${calendar.totalCreditHours}`
  };
}

const COLORS = {
  lecture: { fill: '#e3ebff', edge: '#1f4ed8' },
  tutorial: { fill: '#e1f5ea', edge: '#15724b' },
  lab: { fill: '#fdf0d8', edge: '#b26b00' }
};
const INK = '#1b2333';
const MUTED = '#5b6578';
const RULE = '#cfd6e3';
const HEAD_BG = '#eef1f7';

function drawHeader(doc, model, x, y, width) {
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(20).text(model.title, x, y, { lineBreak: false });
  doc.font('Helvetica').fontSize(9).fillColor(MUTED)
    .text('German University in Cairo - Student schedule', x, y + 24, { lineBreak: false });
  y += 42;
  const cols = 3;
  const colW = width / cols;
  model.header.forEach((h, i) => {
    const cx = x + (i % cols) * colW;
    const cy = y + Math.floor(i / cols) * 24;
    doc.font('Helvetica').fontSize(7).fillColor(MUTED).text(h.label.toUpperCase(), cx, cy, { width: colW - 8, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(INK)
      .text(h.value, cx, cy + 9, { width: colW - 8, height: 12, ellipsis: true, lineBreak: false });
  });
  y += Math.ceil(model.header.length / cols) * 24 + 4;
  doc.moveTo(x, y).lineTo(x + width, y).lineWidth(0.8).strokeColor(RULE).stroke();
  return y + 8;
}

// Lanes so that (unexpected) overlapping sessions sit side by side.
function laneLayout(list) {
  const sorted = [...list].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  const laneEnds = [];
  const placed = sorted.map((b) => {
    const s = toMinutes(b.startTime);
    let lane = laneEnds.findIndex((end) => end <= s);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
    laneEnds[lane] = toMinutes(b.endTime);
    return { ...b, lane };
  });
  return { placed, lanes: Math.max(1, laneEnds.length) };
}

function drawGrid(doc, model, x, y, width, height) {
  const timeW = 40;
  const headH = 18;
  const colW = (width - timeW) / model.days.length;
  const { startMinutes, endMinutes } = model.grid;
  const bodyH = height - headH;
  const perMin = bodyH / (endMinutes - startMinutes);
  const offSet = new Set(model.daysOff);

  doc.save();
  doc.rect(x, y, width, headH).fill(HEAD_BG);
  model.days.forEach((day, i) => {
    const cx = x + timeW + i * colW;
    if (offSet.has(day)) doc.rect(cx, y + headH, colW, bodyH).fill('#f6f7fa');
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(8.5)
      .text(day + (offSet.has(day) ? ' (off)' : ''), cx, y + 5, { width: colW, align: 'center', lineBreak: false });
  });

  for (let m = startMinutes; m <= endMinutes; m += 60) {
    const ly = y + headH + (m - startMinutes) * perMin;
    doc.moveTo(x + timeW, ly).lineTo(x + width, ly).lineWidth(0.4).dash(2, { space: 2 }).strokeColor(RULE).stroke().undash();
    doc.fillColor(MUTED).font('Helvetica').fontSize(7)
      .text(hhmm(m), x, Math.min(y + height - 9, Math.max(y + headH + 1, ly - 4)), { width: timeW - 5, align: 'right', lineBreak: false });
  }
  model.days.forEach((_, i) => {
    const cx = x + timeW + i * colW;
    doc.moveTo(cx, y).lineTo(cx, y + height).lineWidth(0.5).strokeColor(RULE).stroke();
  });
  doc.rect(x, y, width, height).lineWidth(0.8).strokeColor(RULE).stroke();

  model.days.forEach((day, i) => {
    const { placed, lanes } = laneLayout(model.grid.blocks.filter((b) => b.day === day));
    const laneW = (colW - 4) / lanes;
    for (const b of placed) {
      const bx = x + timeW + i * colW + 2 + b.lane * laneW;
      const by = y + headH + (toMinutes(b.startTime) - startMinutes) * perMin + 1;
      const bh = Math.max(10, (toMinutes(b.endTime) - toMinutes(b.startTime)) * perMin - 2);
      const bw = laneW - 1;
      const c = COLORS[b.type] || { fill: '#eeeeee', edge: '#777777' };
      doc.rect(bx, by, bw, bh).fill(c.fill);
      doc.rect(bx, by, 2.5, bh).fill(c.edge);
      const tx = bx + 5;
      const tw = bw - 7;
      const lines = [
        { text: b.courseCode, font: 'Helvetica-Bold', size: 8 },
        { text: `${b.typeLabel}${b.groupNumber ? ` | Grp ${b.groupNumber}` : ''}`, font: 'Helvetica', size: 7 },
        { text: b.room, font: 'Helvetica', size: 7 },
        { text: `${b.startTime}-${b.endTime}`, font: 'Helvetica', size: 6.5 }
      ];
      let ty = by + 2;
      for (const line of lines) {
        if (ty + line.size > by + bh) break;
        doc.font(line.font).fontSize(line.size).fillColor(INK)
          .text(line.text, tx, ty, { width: tw, height: line.size + 2, ellipsis: true, lineBreak: false });
        ty += line.size + 2;
      }
    }
  });
  doc.restore();
  return y + height;
}

function drawCourses(doc, model, x, y, width, bottom, topAfterBreak) {
  const cols = [
    { key: 'courseCode', header: 'Code', w: 70 },
    { key: 'courseName', header: 'Course', w: 230 },
    { key: 'creditHours', header: 'Credit hrs', w: 55 },
    { key: 'sessions', header: 'Lecture / tutorial / lab - day, time, room', w: width - 355 }
  ];
  const pad = 4;
  const headerRow = (yy) => {
    doc.rect(x, yy, width, 16).fill(HEAD_BG);
    let cx = x;
    for (const c of cols) {
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(8).text(c.header, cx + pad, yy + 4, { width: c.w - 2 * pad, lineBreak: false });
      cx += c.w;
    }
    return yy + 16;
  };

  doc.fillColor(INK).font('Helvetica-Bold').fontSize(12).text(`Registered courses (${model.courseCount})`, x, y, { lineBreak: false });
  y = headerRow(y + 18);

  for (const row of model.courses) {
    const cells = {
      courseCode: String(row.courseCode || ''),
      courseName: row.courseName,
      creditHours: String(row.creditHours),
      sessions: row.sessions.join('\n') || '-'
    };
    doc.font('Helvetica').fontSize(8);
    const h = Math.max(...cols.map((c) => doc.heightOfString(cells[c.key] || ' ', { width: c.w - 2 * pad }))) + 2 * pad;
    if (y + h > bottom) {
      doc.addPage();
      y = headerRow(topAfterBreak);
    }
    let cx = x;
    for (const c of cols) {
      doc.font(c.key === 'courseCode' ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(INK)
        .text(cells[c.key], cx + pad, y + pad, { width: c.w - 2 * pad });
      cx += c.w;
    }
    y += h;
    doc.moveTo(x, y).lineTo(x + width, y).lineWidth(0.4).strokeColor(RULE).stroke();
  }

  if (y + 22 > bottom) { doc.addPage(); y = topAfterBreak; }
  doc.rect(x, y + 4, width, 18).fill(HEAD_BG);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(model.totalLine, x + pad, y + 8, { width: width - 2 * pad, align: 'right', lineBreak: false });
  return y + 22;
}

export function renderSchedulePdf(input) {
  const model = input.model || buildPdfModel(input);
  return new Promise((resolve, reject) => {
    const margin = 32;
    const doc = new PDFDocument({
      size: 'A4', layout: 'landscape', margin, bufferPages: true,
      info: { Title: `${model.title} - ${model.fileName}`, Author: 'Bobos scheduling system' }
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      const x = margin;
      const width = doc.page.width - 2 * margin;
      const bottom = doc.page.height - margin - 14; // room for the footer
      let y = drawHeader(doc, model, x, margin, width);

      doc.fillColor(INK).font('Helvetica-Bold').fontSize(12).text('Weekly timetable', x, y, { lineBreak: false });
      doc.font('Helvetica').fontSize(8.5).fillColor(MUTED)
        .text(`${model.daysOffLine}   |   L = Lecture, T = Tutorial, Lab = Lab`, x + 120, y + 3, { width: width - 120, align: 'right', lineBreak: false });
      y = drawGrid(doc, model, x, y + 18, width, bottom - y - 18);

      doc.addPage();
      drawCourses(doc, model, x, margin, width, bottom, margin);

      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i += 1) {
        doc.switchToPage(i);
        const savedBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0; // writing in the margin must not add a page
        doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
          .text(`${model.header[0].value} (${model.header[1].value}) - ${model.header[5].value}`, x, doc.page.height - margin + 4, { width: width / 2, lineBreak: false })
          .text(`Page ${i + 1} of ${range.count}`, x + width / 2, doc.page.height - margin + 4, { width: width / 2, align: 'right', lineBreak: false });
        doc.page.margins.bottom = savedBottom;
      }
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
