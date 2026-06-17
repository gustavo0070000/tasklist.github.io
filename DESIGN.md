---
name: Shared Harmony
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#464554'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#767586'
  outline-variant: '#c7c4d7'
  surface-tint: '#494bd6'
  primary: '#4648d4'
  on-primary: '#ffffff'
  primary-container: '#6063ee'
  on-primary-container: '#fffbff'
  inverse-primary: '#c0c1ff'
  secondary: '#006b5f'
  on-secondary: '#ffffff'
  secondary-container: '#62fae3'
  on-secondary-container: '#007165'
  tertiary: '#a63047'
  on-tertiary: '#ffffff'
  tertiary-container: '#c6495e'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#62fae3'
  secondary-fixed-dim: '#3cddc7'
  on-secondary-fixed: '#00201c'
  on-secondary-fixed-variant: '#005047'
  tertiary-fixed: '#ffdadc'
  tertiary-fixed-dim: '#ffb2b9'
  on-tertiary-fixed: '#400010'
  on-tertiary-fixed-variant: '#891933'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-padding: 1.5rem
  stack-gap: 1rem
  section-gap: 2rem
  card-padding: 1.25rem
  gutter: 1rem
---

## Brand & Style

The design system is centered on the concept of "Shared Harmony"—a collaborative, stress-free environment for couples to manage their daily lives. The personality is friendly, organized, and minimalist, aiming to evoke a sense of calm and "zen" productivity.

The visual style blends **Minimalism** with **Modern Corporate** sensibilities. It prioritizes clarity and breathability, using generous whitespace to prevent the feeling of a cluttered "chore list." The interface relies on soft elevation and a card-based architecture to make tasks feel tangible and manageable. To differentiate ownership without visual noise, the system utilizes subtle color-coded indicators for each partner, ensuring the experience feels personal yet unified.

## Colors

The palette is designed to balance shared responsibility with individual identity.

- **Primary (Indigo):** Used for shared actions, global navigation, and primary buttons. It represents the "union" and shared goals.
- **Gus Brand (Teal):** A calm, grounded accent used specifically for tasks, avatars, and badges associated with Gus.
- **Isa Brand (Rose):** A warm, energetic accent used for tasks, avatars, and badges associated with Isa.
- **Functional Colors:** Success (Green) is reserved for completed states, while Warning (Amber) is used exclusively for approaching or overdue deadlines.
- **Neutral/Background:** The high-luminance Slate background provides a "paper-like" canvas that keeps the UI feeling light and airy.

## Typography

This design system utilizes **Inter** for its exceptional readability and neutral, modern tone. The typographic scale is optimized for a PWA experience, ensuring that task titles are prominent while supporting metadata (dates, owners) remains legible but secondary.

- **Headlines:** Use tight letter-spacing and bold weights to provide strong page hierarchy.
- **Body:** Generous line-heights are maintained to ensure that long task descriptions remain readable and don't feel cramped.
- **Labels:** Used for tags, owner badges, and status indicators. They often use a slightly heavier weight to stand out against card backgrounds.

## Layout & Spacing

The layout philosophy follows a **Fluid Grid** approach with a mobile-first priority, as a PWA is frequently accessed on the go. 

- **Mobile:** Single column with 24px (1.5rem) side margins. Lists take up the full available width to maximize readability.
- **Tablet/Desktop:** A centered max-width container (max 800px) is used to keep list items from becoming excessively wide, maintaining a "journal" feel.
- **Spacing Rhythm:** An 8px base unit is used. Generous vertical spacing between cards (16px) ensures each task feels like a distinct, achievable item rather than a crowded list.

## Elevation & Depth

To maintain the minimalist and "zen" aesthetic, the design system avoids heavy shadows in favor of **Tonal Layers** and **Ambient Shadows**.

- **Level 0 (Background):** Slate 50 (#f8fafc).
- **Level 1 (Cards/Surface):** Pure White (#ffffff) with a very soft, diffused shadow (0px 4px 20px rgba(0, 0, 0, 0.04)). This makes cards appear to "float" gently on the background.
- **Level 2 (Active/Hover):** A slightly more pronounced shadow (0px 8px 30px rgba(0, 0, 0, 0.08)) is used when a card is being dragged or interacted with.
- **Dividers:** Used sparingly. Prefer using whitespace and slight background shifts over hard lines to separate content.

## Shapes

The shape language is exceptionally soft and approachable, utilizing `2xl` rounded corners for primary containers.

- **Standard Elements (Inputs, Small Buttons):** 0.5rem (8px) radius.
- **Primary Cards & Modals:** 1rem (16px) radius to emphasize the "friendly" and "modern" persona.
- **Status Badges & Avatars:** Fully rounded (pill-shaped) to distinguish them from structural task cards.

## Components

### Buttons & Interaction
- **Primary Button:** Indigo background, white text, 1rem roundedness. High-contrast and clear.
- **Owner Chips:** Small, pill-shaped badges. Gus's chip uses a Teal background with white text; Isa's uses Rose. 
- **Checkboxes:** Large, custom-styled circles. When checked, they fill with the Primary Indigo color and trigger a subtle strike-through on the task title.

### Task Cards
- Cards are the core component. Each card includes the task title, an optional deadline badge (Warning Amber if close), and the owner chip.
- Cards feature a subtle 1px border (#e2e8f0) to define edges on high-brightness screens.

### Inputs & Forms
- Floating labels or clear top-aligned labels in `label-md` style. 
- Focus states use a 2px Indigo ring with a soft glow to guide the user's attention during data entry.

### Lists & Progress
- Progress bars use a soft version of the Primary Indigo (Indigo 100) as the track and the solid Primary Indigo as the indicator.
- Empty states should use minimalist illustrations and "zen" copy to encourage a positive feeling even when the list is empty.