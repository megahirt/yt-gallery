# Megahirt Design System

**Project:** Private Family Video Archive  
**Tagline:** Memories in Motion  
**Design Direction:** Warm, personal, signal-based identity with subtle cycling motif

---

## 1. Core Principles

### 1.1 Purpose

This system supports a private, family-focused video archive. It must feel:

- Warm
- Personal
- Calm
- Browseable (not addictive or high-stimulation)

### 1.2 Design Philosophy

- Prioritize clarity over decoration
- Prefer subtlety over boldness, except for the app icon
- Avoid anything that feels like:
  - SaaS dashboards
  - Social media feeds
  - Tech startup branding

### 1.3 Visual Metaphor

- **Primary:** Signal / frequency / memory transmission
- **Secondary:** Motion (cycling, life journey)
- **Avoid:** Literal camera/photo metaphors as primary elements

---

## 2. Color System

### 2.1 Base Palette

```css
--color-bg:          #F5F3EF;  /* warm off-white */
--color-surface:     #EAE6DF;  /* card background */
--color-text:        #2F2A26;  /* primary text */
--color-text-soft:   #6B645E;  /* secondary text */
--color-accent:      #A67C52;  /* muted brown */
--color-accent-soft: #BFAFA0;  /* optional highlight */
```

### 2.2 Usage Rules

- Background is **always** `--color-bg`
- Cards use `--color-surface`
- Text should never be pure black
- Accent color is used sparingly:
  - Links
  - Active states
  - Small highlights only

### 2.3 Prohibited

- No bright saturated colors
- No gradients (except possibly subtle icon shading)
- No pure white (`#FFFFFF`) backgrounds

---

## 3. Typography

### 3.1 Font Stack

```css
--font-heading: "Playfair Display", serif;
--font-body:    "Inter", system-ui, sans-serif;
```

### 3.2 Type Scale

```css
--text-h1:    36px;
--text-h2:    28px;
--text-h3:    22px;
--text-body:  16px;
--text-small: 13px;
```

### 3.3 Usage

- **Headings:** serif only
- **Body / UI:** sans-serif only
- **Metadata** (dates, durations): small + muted color

### 3.4 Rules

- Avoid ALL CAPS
- Use slight letter-spacing for headings only
- Keep line-height generous (1.4–1.6)

---

## 4. Spacing & Layout

### 4.1 Spacing Scale

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 16px;
--space-4: 24px;
--space-5: 32px;
--space-6: 48px;
```

### 4.2 Layout Rules

- Use consistent spacing scale only
- Avoid arbitrary spacing values
- Prefer vertical rhythm over dense layouts

---

## 5. Surfaces & Elevation

### 5.1 Card Style

```css
--radius:      12px;
--shadow-soft: 0 2px 6px rgba(0, 0, 0, 0.05);
```

### 5.2 Rules

- All cards use the same radius
- Shadows must be subtle (barely visible)
- No harsh drop shadows

---

## 6. Components

### 6.1 Video Card (Primary Component)

**Structure**

- Thumbnail (top)
- Title (serif)
- Metadata (date, optional duration)

**Behavior**

- Hover: slight lift (`translateY -2px`)
- No scaling or aggressive animation

**Example CSS**

```css
.video-card {
  background: var(--color-surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-soft);
  padding: var(--space-3);
}
```

### 6.2 Navigation

**Structure**

- Minimal top nav
- Left: logo
- Right: simple links

**Rules**

- No dropdown-heavy menus
- Keep navigation shallow

### 6.3 Buttons

**Style**

```css
.button {
  background: var(--color-accent);
  color: var(--color-bg);
  border-radius: 8px;
  padding: 8px 16px;
}
```

**Rules**

- Use sparingly
- Prefer text links where possible

---

## 7. Iconography & Branding

### 7.1 Core Concept

The icon represents:

- **Signal waveform** (primary)
- **Cycling** (secondary, subtle)

### 7.2 App Icon (Critical)

**Requirements** — must work at:

- 512×512
- 192×192
- 48×48
- 16×16 (favicon)

**Design Rules**

- Single continuous waveform line
- Line weight: thick and bold
- Rounded corners
- Simplified shape at small sizes

**Shape Behavior**

| Size | Detail level |
|------|-------------|
| Large | Wave includes subtle bicycle reference |
| Small | Reduce to simple waveform only |

### 7.3 Icon Colors

**Primary**

```
Background: #F5F3EF
Line:       #2F2A26
```

**Alternate**

```
Background: #2F2A26
Line:       #F5F3EF
```

---

## 8. Motion & Interaction

### 8.1 Principles

- Subtle
- Slow
- Non-distracting

### 8.2 Allowed Animations

- Fade in (200–300ms)
- Slight hover lift
- Soft transitions

### 8.3 Avoid

- Bounce animations
- Fast transitions
- Attention-grabbing motion

---

## 9. Imagery

### 9.1 Style

- Natural lighting
- Slight warmth
- No heavy filters

### 9.2 Rules

- Avoid over-processing
- Maintain consistency across thumbnails

---

## 10. Accessibility

### 10.1 Contrast

- Ensure text contrast meets WCAG AA minimum
- Use darker text if needed for readability

### 10.2 Font Size

- Body text minimum: 16px
- Avoid small, low-contrast text

---

## 11. Implementation Notes

### 11.1 Priorities

1. Build reusable components
2. Use CSS variables for all tokens
3. Maintain consistency across pages

### 11.2 File Structure

Create the following files:

- `tokens.css` — colors, spacing, typography
- `components.css`
- `layout.css`

### 11.3 Do Not

- Introduce new colors
- Add new fonts
- Change the spacing scale
- Add unnecessary UI complexity

---

## 12. Summary

This system should feel like:

- A personal archive
- A quiet, meaningful space
- A signal of memories over time

**Not:**

- A product
- A platform
- A social network
