---
name: Seali Meal Planner
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3f4850'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#707881'
  outline-variant: '#bfc7d2'
  surface-tint: '#006398'
  primary: '#006194'
  on-primary: '#ffffff'
  primary-container: '#007bb9'
  on-primary-container: '#fdfcff'
  inverse-primary: '#93ccff'
  secondary: '#00668a'
  on-secondary: '#ffffff'
  secondary-container: '#40c2fd'
  on-secondary-container: '#004d6a'
  tertiary: '#366175'
  on-tertiary: '#ffffff'
  tertiary-container: '#4f7a8e'
  on-tertiary-container: '#fbfdff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cce5ff'
  primary-fixed-dim: '#93ccff'
  on-primary-fixed: '#001d31'
  on-primary-fixed-variant: '#004b73'
  secondary-fixed: '#c4e7ff'
  secondary-fixed-dim: '#7bd0ff'
  on-secondary-fixed: '#001e2c'
  on-secondary-fixed-variant: '#004c69'
  tertiary-fixed: '#bee9ff'
  tertiary-fixed-dim: '#a1cde3'
  on-tertiary-fixed: '#001f2a'
  on-tertiary-fixed-variant: '#1e4c5f'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.025em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: -0.005em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
  label-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: -0.01em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.03em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.25rem
---

## Brand & Style

This design system embodies a serene, high-end nutritional lifestyle. Guided by calm discipline and mindful eating rather than aggressive calorie-counting or aggressive gym metrics, the experience merges Apple Health’s clean clinical precision with YAZIO’s airy approachability. 

### Philosophy & Visual Language
- **Soft Editorial Modernism:** Ample breathing room, generous negative space, and large, tactile surfaces cultivate an organized, low-stress mental model.
- **Friendly Restraint:** The aesthetic is quiet and welcoming. Micro-moments feature "Seali"—a minimalist, single-weight line mascot (a calm baby seal)—who provides gentle, judgment-free encouragement across zero-states, goal milestones, and hydration check-ins.
- **Elevated Wellness:** Replaces aggressive hyper-saturated neon accents and high-stress trackers with airy sky tones, deep midnight legibility, and whisper-quiet structural borders.

## Colors

The palette establishes an airy, light-drenched canvas anchored by deep slate-navy for authoritative typographic clarity.

- **Primary (`#0284C7`):** Refined deep sky blue. Applied to key interactive triggers, active navigation tabs, progress rings, and primary action buttons.
- **Secondary (`#38BDF8`):** Pastel baby blue. Used for secondary graphs, macro-nutrient balance indicators, and supportive interactive chips.
- **Tertiary (`#BAE6FD`):** Soft mist blue. Serves as tinted surface fills behind active cards, pill highlights, and subtle banner backgrounds.
- **Neutral (`#0F172A`):** Deep navy midnight. Replaces pure black to deliver soft, high-contrast readability across headlines and core structural elements without harshness.
- **Canvas & Surfaces:**
  - Pure White (`#FFFFFF`): Elevated cards, interactive sheets, and navigation bars.
  - Surface Tint (`#F8FAFC` to `#F1F5F9`): Main canvas backdrop and inset well components.
  - Border Subtlety (`#E2E8F0`): Hairline dividers and quiet component perimeters (alpha 0.6–1.0).

## Typography

The typography leverages Inter configured to evoke Apple's native SF Pro aesthetic: tight tracking on display headings, open aperture metrics, and structured tabular figures for calorie and macro tracking.

- **Display & Headings:** Crisp, negative-tracked headers bring editorial polish to daily summaries and dashboard greetings.
- **Metrics & Numbers:** Tabular figures (`tnum`) must be enforced on all caloric counts, gram markers, and clock times to prevent UI jitter during daily tracking and logging animations.
- **Labels & Microcopy:** Clean medium and semi-bold weights ensure legibility across dense nutritional ingredient tables and micro dietary tags.

## Layout & Spacing

A mobile-first fluid layout centered on comfortable one-handed reach zones and horizontal carousel gestures.

- **Grid & Safe Margins:** Base canvas uses a fluid 4-column structure on mobile devices with `1.25rem` (`20px`) outer safe margins and `1rem` (`16px`) gutters. On tablet views, layout transitions to an 8-column presentation capped at a max-width of `640px` for optimal single-column meal timelines.
- **Vertical Rhythm:** Macro groupings (e.g., Breakfast, Lunch, Dinner, Snacks) are partitioned with `space-xl` (`36px`) gaps, preserving distinct mental milestones throughout the culinary day.
- **Nested Card Densities:** Content inside meal containers maintains internal padding of `space-md` to `space-lg`, ensuring clean separation between recipe thumbnails, macro bars, and ingredient checklists.

## Elevation & Depth

Visual hierarchy relies on quiet ambient shadows paired with tone-on-tone surface transitions to maintain a cloud-like lightness.

- **Base Ambient Shadow:** Surface cards use a soft, multi-stop diffusion tinted with slate:  
  `0 4px 20px -2px rgba(15, 23, 42, 0.04), 0 2px 6px -1px rgba(15, 23, 42, 0.02)`.
- **Floating Modals & Sheets:** Meal logging popups and bottom sheets use an expanded ambient elevation:  
  `0 20px 40px -8px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04)`.
- **Low-Contrast Hairlines:** All cards layer an inset `1px` border of `#E2E8F0` at 60% opacity to prevent edge bleeding on retina screens without creating heavy containment lines.
- **Backdrop Frosting:** Bottom navigation bars and floating daily progress indicators utilize ultra-subtle frosted glass (`backdrop-filter: blur(20px); background: rgba(255, 255, 255, 0.85)`).

## Shapes

The design system embraces an ultra-soft, organic contour language inspired by modern iOS containers and smooth pebble geometries.

- **Primary Cards (`rounded-2xl` to `rounded-3xl`):** Major content modules, recipe panels, and daily timeline cards use a `24px` to `28px` corner radius.
- **Interactive Controls (Pill):** All buttons, search bars, tag chips, and intake inputs feature fully circular pill profiles (`rounded-full` / 9999px).
- **Nested Inner Items:** Sub-elements inside cards (such as ingredient icons or thumbnail image wrappers) carry a proportional radius of `12px` to `16px` to maintain concentric geometry.

## Components

### Buttons & CTAs
- **Primary Button:** Pill-shaped, solid `#0284C7` background with pure white typography (`label-lg`). Height is 52px for mobile ergonomics. Active states apply a subtle scale-down (`transform: scale(0.98)`).
- **Secondary Button:** Pure white pill surface with `#E2E8F0` border and `#0F172A` text.
- **Ghost/Tertiary:** Pure translucent pill with `#0284C7` text; tints to `#BAE6FD` at 20% opacity on press.

### Cards
- **Meal Schedule Card:** `#FFFFFF` background, `24px` rounded corners, hairline stroke (`#E2E8F0`), and soft ambient shadow. Contains a header with meal type (e.g., "Breakfast"), targeted calories, an expandable item checklist, and an inline '+' quick-add pill.
- **Macro Tracker Ring Card:** Highlights Protein, Carbs, and Fats using smooth concentric rings tinted in `#0284C7`, `#38BDF8`, and `#BAE6FD` against `#F8FAFC`.

### Chips & Filters
- **Dietary Filter Chips:** 36px height, rounded-full pills. Unselected state is `#F1F5F9` with `#1E293B` text. Selected state transitions to `#BAE6FD` fill with `#0284C7` text and subtle semi-bold weighting.

### Inputs & Search
- **Search & Calorie Field:** Pill-shaped, 48px height, `#F8FAFC` background with a hairline border that smoothly animates to `#38BDF8` upon focus. Placeholder text uses muted slate (`#94A3B8`). Left-aligned with clean 1.5px stroke icons.

### Checkboxes & Segmented Controls
- **Ingredient Checklist:** Custom circular check circles (22px diameter). Unchecked: 1.5px `#CBD5E1` border. Checked: Filled `#0284C7` with a crisp white tick mark.
- **Segmented Time Selector (Day/Week/Month):** Fully rounded pill track in `#F1F5F9` holding an animated sliding white pill thumb with subtle elevation.

### Mascot States ('Seali')
- Simple, warm line illustrations of Seali appear within empty meal logs (e.g., Seali holding an empty plate for "No lunch logged yet"), resting peacefully on water when daily targets are achieved, and gently offering a glass of water on hydration trackers.