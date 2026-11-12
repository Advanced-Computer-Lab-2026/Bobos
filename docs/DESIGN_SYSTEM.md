# BOBOs Design System

> **Aesthetic Direction:** Claude-inspired editorial design — warm artistic sensibility, literary typography, and calm academic clarity.

---

## 1. Typography Hierarchy

The typography system pairs **Tiempos Text** (editorial serif) with **Styrene B** (interface sans-serif).

| Role | Font Family | Weights Used | Usage Guidelines |
| :--- | :--- | :--- | :--- |
| **Brand Identity** | `Tiempos Text` | `500` / `600` | Logo (`bobos.`), brand mark, and high-level identity marks. |
| **Editorial Headings** | `Tiempos Text` | `400` (Regular) | `h1`, `h2`, hero banners (*"A little clarity for your week."*), module titles. **Never forced to heavy 700 bold** to preserve the airy, sophisticated literary aesthetic. |
| **Section Titles & Subheads** | `Tiempos Text` | `400` / `500` | Card headers, narrative notes (*"Make space for what comes next"*). |
| **Interface & Navigation** | `Styrene B` | `400` (Regular), `500` (Medium) | Sidebar navigation links, topbar breadcrumbs, form controls, tabs. |
| **Course Codes & Metadata** | `Styrene B` | `500` (Medium), `600` | Course identifiers (`CSEN 704`), credit hours, timestamps, badges. |
| **Body & Paragraphs** | `Styrene B` | `400` (Regular) | Descriptive copy, syllabus text, instructions. |

### Font Asset Files
Stored in `apps/web/public/fonts/`:
* `TiemposText-Regular.woff2` (400)
* `TiemposText-Semibold.woff2` (600)
* `TiemposHeadline-Bold.woff2` (700)
* `StyreneB-Regular.otf` (400)
* `StyreneB-Medium.otf` (500)
* `StyreneB-Bold.otf` (700)

---

## 2. Color System — Original 07 / Cherry, Ice & Clay

The color palette balances a clean, near-white neutral canvas with soft cool and warm accents, anchored by deep charcoal ink.

### Core Canvas & Neutral Surfaces
| Token Name | CSS Variable | Hex Value | Purpose / Role |
| :--- | :--- | :--- | :--- |
| **Canvas** | `--canvas` | `#FAFAFA` | Main background base; avoids heavy or muddy grays. |
| **Surface** | `--surface` | `#E7E8EB` | Secondary container backgrounds and active nav items. |
| **Surface Subtle** | `--surface-subtle`| `#F3F4F6` | Table row alternations, light hover states. |
| **Paper** | `--paper` | `#FFFFFF` | Card panels, floating modals, dropdowns. |
| **Line / Border** | `--border`, `--line` | `#DDE0E5` | Structural rules, dividers, card borders. |
| **Ink** | `--ink` | `#28262B` | Primary headings, body copy, solid primary buttons. |
| **Muted Text** | `--muted` | `#6B6D76` | Timestamps, subtitles, secondary course codes. |

### Semantic & Accent Colors
| Accent Role | Light / Surface | Core Accent | Dark / Ink | Primary Application |
| :--- | :--- | :--- | :--- | :--- |
| **Ice Blue** | `--ice-pale`: `#EDF4FA` | `--ice`: `#ACCAE3` | `--ice-dark`: `#396FAD` | Academic advising, appointments, weekly lectures. |
| **Cherry Rose** | `--cherry-pale`: `#FCEEF1` | `--cherry`: `#EDA9BA` | `--cherry-dark`: `#B84265` | Active course highlights, priority assignments. |
| **Clay Orange** | `--clay-pale`: `#FFF8F4` | `--clay`: `#D8B097` | `--clay-dark`: `#966246` | Registration milestones, deadlines, AI slots. |
| **Accent Teal** | `--teal-pale`: `#EEF6F4` | `--teal`: `#88BDB3` | `--teal-dark`: `#287E73` | Database tutorials, checklists, completed states. |
| **Amber** | `--amber-pale`: `#FDF8EE` | `--amber`: `#D9C79E` | `#8C7745` | Secondary warnings, advising reminders. |

---

## 3. Component Design Guidelines

### Sidebar Navigation
* **Logo:** `bobos.` set in `Tiempos Text`, font-weight `500`, with a clay-orange accent dot.
* **Active Indicator:** Nav item background set to `--surface` (`#E7E8EB`) with a 3px cherry border accent (`--cherry-dark`).
* **Text:** `Styrene B`, 13px, font-weight `500`.

### Welcome / Hero Banners
* **Gradient Background:** Soft transition from Ice Blue (`#ACCAE3`) to muted Clay (`#EAD6CE`).
* **Typography:** Hero heading in `Tiempos Text` (Regular 400 at 26px–36px) with high-contrast `--ink` charcoal text.

### Schedule & Timetable Slots
* **Slot Cards:** Color-coded border-left accent (4px) with matching tinted surface:
  * Software Engineering: Cherry Rose (`#EDA9BA` / `#B84265`)
  * Networks & Compilers: Ice Blue (`#ACCAE3` / `#396FAD`)
  * Databases & Labs: Accent Teal (`#88BDB3` / `#287E73`)
  * Artificial Intelligence: Clay Orange (`#D8B097` / `#966246`)

### Action Cards & Advising Module
* **Advising Notice:** Soft Ice Blue background (`#ACCAE3`) with asymmetric rounded corner (`border-radius: 0 36px 0 0`).
* **Buttons:** High-contrast `--ink` charcoal background with white typography in `Styrene B`.
* **Deadlines:** Clay Orange callout pill with dark terracotta boundary.

---

## 4. Interactive Specimen & Live Previews

A complete interactive preview of all 4 screens (*Overview, Schedule, Courses, Advising*) is bundled directly with the application:
* Run Vite: `npm run dev`
* Open: `http://localhost:5173/design-preview/index.html` (or `http://localhost:5180/locked-design.html`)
