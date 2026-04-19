---
name: human-ui-design
description: Human-crafted modern mobile UI design — purposeful animation, real typography scale, spacing hierarchy, and micro-interactions. NOT AI slop patterns. Use when building or reviewing UI: layout, motion, typography, color, or micro-interactions.
version: 1.0.0
license: MIT
---

# Human-Crafted Mobile UI Design

This skill provides real, human-designed mobile UI principles — not generic AI-generated patterns. Every design decision has reasoning behind it.

---

## Core Philosophy

**AI slop is recognizable**: Random gradients, decorative animations that serve no purpose, oversized padding that wastes space, generic rounded corners on everything, gratuitous shadows, "modern" buzzword aesthetics without function.

**Good design is invisible**: The user doesn't notice it — they just feel that things work intuitively, transitions are smooth, text is readable, and nothing feels accidental.

---

## Typography Scale

### Use a Purposeful Scale

Never pick font sizes arbitrarily. Use a **purposeful scale** with clear function for each size:

| Role | Size | Weight | Usage |
|------|------|--------|-------|
| Display | 34–40pt | Bold | Hero numbers, large stats |
| Title | 24–28pt | Bold | Screen titles, section headers |
| Headline | 20pt | Semibold | Card titles, list item titles |
| Body | 17pt | Regular | Main content, descriptions |
| Subhead | 15pt | Regular | Secondary info, metadata |
| Caption | 13pt | Regular | Timestamps, labels |
| Micro | 11pt | Medium | Badges, tabs |

### Typography Rules

- **Line height**: 1.2–1.4× font size. Body text needs breathing room.
- **Line length**: 60–80 characters max (~320px on mobile). Long lines hurt readability.
- **Letter spacing**: Use default. Never manually tracking unless for all-caps labels.
- **Never use system fonts as both heading and body in the same size** — size difference creates hierarchy.
- **Use tabular figures for numbers** (`fontVariant: 'tabular-nums'`) in counters, stats, prices.
- **Selectable text** on any content a user might want to copy (error messages, codes, addresses).

---

## Spacing System

### The 4pt or 8pt Grid

Everything aligns to a **4pt or 8pt base grid**. Mixing grid sizes creates visual noise.

**Common spacing values** (in points, from 8pt grid):

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4pt | Icon-to-text gap, tight lists |
| `sm` | 8pt | Related element groups |
| `md` | 16pt | Card padding, section gaps |
| `lg` | 24pt | Between sections |
| `xl` | 32pt | Screen edge padding, large gaps |
| `xxl` | 48pt | Hero section spacing |

### Layout Principles

- **Screen edge padding**: 16pt horizontal minimum. Content should never touch the edges.
- **Card padding**: 16pt internal minimum. 12pt for compact cards.
- **List item height**: 44pt minimum (Apple's touch target). 56pt for rich list items.
- **Section spacing**: 24–32pt between unrelated sections.
- **Related elements** (icon + label): 8pt gap, not 16pt.

---

## Color

### Semantic Color Over Decorative

Colors communicate **meaning**, not aesthetics:

| Purpose | Usage |
|---------|-------|
| Primary | Main action (1 per screen max) |
| Secondary | Alternative actions |
| Destructive | Delete, remove, warnings |
| Success | Completed, positive |
| Text primary | Body copy, titles |
| Text secondary | Metadata, hints |
| Background | Screen background |
| Surface | Cards, elevated surfaces |
| Border | Dividers, input outlines |

### Dark Mode / Light Mode

- **Never hardcode colors**. Use semantic tokens that adapt.
- Background: `#FFFFFF` (light) / `#000000` (dark) — not gray.
- Surface: `#F5F5F7` (light) / `#1C1C1E` (dark).
- Text: Pure black/white in dark/light mode — not gray-on-gray.
- **Semantic tokens** (`--color-surface`, `--color-text-primary`) work in both modes.

### What NOT to Do

- No random purple/blue gradients on headers (AI slop signature)
- No multi-stop gradients unless for a specific brand treatment
- No colored backgrounds on entire screens — reserve color for surfaces/cards
- No pastel backgrounds with dark text — low contrast, hard to read

---

## Animation Principles

### The Three Rules of Motion

1. **Purpose** — Every animation communicates something: hierarchy, relationship, state change. If it doesn't, remove it.
2. **Continuity** — Transitions show users where they came from and where they're going. Never teleport.
3. **Speed** — Fast enough to feel responsive, slow enough to perceive. ~300ms for transitions, ~150ms for feedback.

### Duration Guidelines

| Type | Duration | Example |
|------|---------|---------|
| Micro-interaction | 100–150ms | Button press, toggle |
| Feedback | 150–200ms | Toast, checkmark |
| Transition | 250–350ms | Screen push, modal |
| Emphasis | 350–500ms | Revealing hidden content |
| Never | — | Decorative looping animations |

### Spring vs Easing

**Use springs for interactive elements** (draggable, dismissible):

```ts
// Good spring — feels physical
withSpring(value, {
  damping: 15,      // Less = more bounce (10–20 range)
  stiffness: 150,   // Higher = faster settle (100–200)
  mass: 1,
})
```

**Use easing curves for transitions** (navigation, reveals):

```ts
// Standard iOS curve — slow start and end
withTiming(value, {
  duration: 300,
  easing: Easing.bezier(0.33, 1, 0.68, 1), // iOS curve
})
```

**Never use `ease-in-out` for everything** — it's generic.

### What Animations Should Do

- **Entrance**: Fade + translate up (not zoom in from nowhere)
- **Exit**: Fade out (not slide away weirdly)
- **State change**: Scale briefly on press (0.97×), snap back
- **Loading**: Skeleton shimmer (left-to-right), not a spinning circle
- **Success**: Checkmark draws in, not bounces randomly
- **List items**: Stagger entrance (50ms delay per item), NOT all at once

### What Animations Should NOT Do

- Bounce continuously without user interaction
- Play on mount for no reason
- Use different easing per element in the same transition
- Take longer than 500ms for any single animation
- Move elements more than 50% of screen height

---

## Cards & Surfaces

### Card Design

A card groups related information. Rules:

- **Padding**: 16pt internal minimum
- **Corner radius**: 12pt standard. NOT 20pt. NOT full circle.
- **Shadow**: Use `boxShadow` with low opacity (0.05–0.1), large blur (10–20), small Y offset (2–4). NOT dramatic drop shadows.
- **No border** unless for input cards. Cards separate via shadow/background, not outlines.

### When NOT to Use a Card

- Single item tap action — use a list row instead
- Tightly related items — a section header is enough
- Every single list item — consider using dividers

---

## List Design

### Row Patterns

**Two-line row** (title + subtitle):
- Title: Headline size (17pt semibold), single line, truncate
- Subtitle: Subhead size (15pt regular), text secondary color, single line
- Vertical centering, 44pt minimum height
- 16pt horizontal padding
- Chevron or disclosure indicator if tappable

**Detail row** (label + value):
- Label: Subhead, text secondary
- Value: Body, text primary
- Use a divider (1pt, 16pt left inset) between rows

### What NOT to Do in Lists

- No card wrapper around every row
- No 24pt corner radius on list items
- No colored backgrounds on individual rows (unless selected)
- No extra padding between rows — 0pt, use divider

---

## Navigation & Transitions

### Screen Transitions

**Stack push**: New screen slides in from right (RTL on Android). 300ms.

**Stack pop**: Screen slides back to right. 250ms.

**Modal present**: Screen slides up from bottom. 350ms with spring.

**Sheet present**: Drag handle visible, 3 detents minimum, transparent background on iOS 26+.

### Tab Transitions

- No cross-fade between tabs — instant switch
- Tab bar stays fixed
- Active tab indicator animates (not fades)

### Link and Button Feedback

- **Press state**: Scale to 0.97×, 100ms. This is the single most impactful micro-interaction.
- **Disabled state**: 40% opacity, no pointer events
- **Loading state**: Replace text with spinner, maintain button width

---

## Shadows (Real Formulas)

AI slop loves dramatic shadows. Real design uses subtle elevation:

| Level | Use case | Shadow |
|-------|-----------|--------|
| 0 | Flat, no shadow | — |
| 1 | Cards at rest | `0 1px 2px rgba(0,0,0,0.05)` |
| 2 | Elevated cards | `0 2px 8px rgba(0,0,0,0.08)` |
| 3 | Modals, drawers | `0 8px 24px rgba(0,0,0,0.12)` |
| 4 | Popovers | `0 12px 32px rgba(0,0,0,0.16)` |

Never use `elevation` property (Android legacy) — always `boxShadow`.

---

## Micro-interactions (The Details That Matter)

These small details separate human-crafted UI from AI slop:

- **Pull to refresh**: Custom spinner that matches your brand, not a generic spinner
- **Toggle**: Thumb moves with spring physics, not linear
- **Checkbox**: Scale pulse on check (1.0 → 1.2 → 1.0), 150ms
- **Swipe to delete**: Snap back with spring if insufficient swipe, rubber-band at edge
- **Long press**: Scale to 0.96× after 500ms hold, haptic feedback
- **Page dots**: Current dot is wider pill, not bigger circle
- **Segmented control**: Sliding indicator that moves with timing curve, not instant
- **Search bar**: Expands from icon, doesn't teleport

---

## Icon Guidelines

- Use **SF Symbols** on iOS (`expo-image` with `source="sf:name"`)
- Use **Material Symbols** on Android
- **Never mix icon libraries** — pick one system
- Icon size: 20pt for inline, 24pt for standalone, 44pt for touch targets
- Stroke weight: 1.5pt–2pt. Never 3pt (too heavy).
- Never use emoji as icons

---

## Forms & Inputs

### Input Fields

- Height: 44pt minimum (touch target)
- Corner radius: 10pt
- Border: 1pt, `--color-border` default, `--color-primary` on focus
- Padding: 12pt horizontal, 14pt vertical
- Label: Above input, Subhead size, text secondary
- Placeholder: text secondary, 17pt
- Error: Below input, Caption size, destructive color, 4pt gap from input

### Never Do These

- Floating labels that animate up on focus (they move and distract)
- Underline-only inputs (no visible border until focus)
- Labels inside inputs as placeholders (disappear when typing)
- Red borders on error before user has interacted

---

## Empty States

Empty states should be **friendly, not cute**:

- **Icon**: Simple, muted (40% opacity), 64pt size
- **Headline**: What's empty, 20pt semibold
- **Body**: Why it's empty + what to do, 15pt regular, text secondary
- **CTA**: One primary action button

No floating characters, no sad illustrations, no "Oops!" text.

---

## Loading States

- **Skeleton screens** for content (not spinners). Shimmer left-to-right.
- **Spinner** only for actions in progress (send, save, submit)
- **Progress bar** for determinate operations (upload %)
- **Never block the whole screen** with a spinner — show it inline or as a banner

---

## Checklist: Is This AI Slop?

Before shipping, check:

- [ ] Gradient headers? → Remove
- [ ] Bouncing/lopping animations? → Remove
- [ ] Every card has a different random shadow? → Unify
- [ ] Border radius is 16pt+ everywhere? → Cap at 12pt
- [ ] Colors are arbitrary pastels? → Use semantic system
- [ ] Animations > 500ms? → Speed up
- [ ] No clear typographic hierarchy (everything 17pt)? → Establish scale
- [ ] Generous padding everywhere (24pt+) that wastes space? → Reduce to 16pt standard
- [ ] Decorative elements with no function? → Remove
- [ ] Spinner instead of skeleton for content? → Replace with skeleton
