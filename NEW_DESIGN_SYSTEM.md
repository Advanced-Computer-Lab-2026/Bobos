# BOBOs — New Design System Specification

## 1. Aesthetic Direction
Claude-inspired editorial design: warm paper surfaces, literary typography, and high-contrast charcoal ink.

---

## 2. Typography

* **Editorial Headings & Brand:** `Tiempos Text`
  * **Weight:** `400` (Regular) only. Large optical size (32px–38px) carries the hierarchy. Never use heavy 700 bold.
  * **Scope:** Brand logo (`bobos.`), hero headlines, section titles, reading notes.
* **Interface & Controls:** `Styrene B`
  * **Weight:** `400` (Regular) and `500` (Medium).
  * **Scope:** Navigation, buttons, calendar day headers, course codes (`CSEN 704`), timestamps, table data.

---

## 3. Color Palette (Original 07 / Cherry, Ice & Clay)

### Neutrals
| Role | Hex | CSS Variable | Usage |
| :--- | :--- | :--- | :--- |
| **Canvas** | `#FAFAFA` | `--canvas` | Page background |
| **Surface** | `#E7E8EB` | `--surface` | Secondary containers, active tabs |
| **Surface Subtle** | `#F3F4F6` | `--surface-subtle` | Alternate table rows, light cards |
| **Ink** | `#28262B` | `--ink` | Primary text, dark buttons, brand mark |
| **Muted** | `#6B6D76` | `--muted` | Subtitles, secondary metadata |
| **Border** | `#DDE0E5` | `--border` | Dividers, card borders |

### Accents
| Color | Base Hex | Dark / Text Hex | CSS Variables | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Cherry Rose** | `#EDA9BA` | `#B84265` | `--cherry`, `--cherry-dark` | Active courses, lecture cards |
| **Ice Blue** | `#ACCAE3` | `#396FAD` | `--ice`, `--ice-dark` | Academic advising, network courses |
| **Clay Orange** | `#D8B097` | `#966246` | `--clay`, `--clay-dark` | Deadlines, registration alerts, AI slots |
| **Teal** | `#88BDB3` | `#287E73` | `--teal`, `--teal-dark` | Labs, tutorials, checklists |

---

## 4. Quick CSS Copy/Paste

```css
:root {
  --font-serif: 'Tiempos Text', Georgia, serif;
  --font-sans: 'Styrene B', -apple-system, sans-serif;

  --canvas: #FAFAFA;
  --surface: #E7E8EB;
  --surface-subtle: #F3F4F6;
  --ink: #28262B;
  --muted: #6B6D76;
  --border: #DDE0E5;

  --cherry: #EDA9BA;
  --cherry-dark: #B84265;
  --ice: #ACCAE3;
  --ice-dark: #396FAD;
  --clay: #D8B097;
  --clay-dark: #966246;
  --teal: #88BDB3;
  --teal-dark: #287E73;
}

h1, h2, h3 {
  font-family: var(--font-serif);
  font-weight: 400;
}

body, button, nav, input {
  font-family: var(--font-sans);
}
```
