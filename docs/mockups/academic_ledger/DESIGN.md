---
name: Academic Ledger
colors:
  surface: '#fbfbe5'
  surface-dim: '#dbdbc7'
  surface-bright: '#fbfbe5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f5e0'
  surface-container: '#efefda'
  surface-container-high: '#e9e9d5'
  surface-container-highest: '#e4e4cf'
  on-surface: '#1b1d10'
  on-surface-variant: '#46464d'
  inverse-surface: '#303224'
  inverse-on-surface: '#f2f2dd'
  outline: '#76767e'
  outline-variant: '#c7c6ce'
  surface-tint: '#575d78'
  primary: '#1a2138'
  on-primary: '#ffffff'
  primary-container: '#30364f'
  on-primary-container: '#999fbd'
  inverse-primary: '#c0c5e4'
  secondary: '#536069'
  on-secondary: '#ffffff'
  secondary-container: '#d6e4ef'
  on-secondary-container: '#59666f'
  tertiary: '#25220f'
  on-tertiary: '#ffffff'
  tertiary-container: '#3b3723'
  on-tertiary-container: '#a7a085'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#c0c5e4'
  on-primary-fixed: '#141a32'
  on-primary-fixed-variant: '#40465f'
  secondary-fixed: '#d6e4ef'
  secondary-fixed-dim: '#bac8d3'
  on-secondary-fixed: '#101d25'
  on-secondary-fixed-variant: '#3b4951'
  tertiary-fixed: '#ebe2c5'
  tertiary-fixed-dim: '#cec7aa'
  on-tertiary-fixed: '#1f1c0a'
  on-tertiary-fixed-variant: '#4b4731'
  background: '#fbfbe5'
  on-background: '#1b1d10'
  surface-variant: '#e4e4cf'
typography:
  display:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  tabular-num:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style
The design system reflects an institutional, calm, and highly dependable aesthetic tailored for administrative rigor in education management. The visual tone is utilitarian and editorial, balancing classical ledger book permanence with modern software efficiency. The system avoids visual noise, decorative gradients, expressive micro-interactions, or non-essential illustrations. 

Instead, it evokes order, authority, and financial precision through disciplined grid alignments, generous negative space, high legibility, and architectural borders. The aesthetic draws from high-contrast administrative minimalism and quiet editorial software—designed specifically for administrative staff processing high-volume student accounts, installment schedules, and batch fee ledgers.

## Colors
The palette uses a restrained, archival paper foundation paired with deep slate ink and functional tints:

- **Page Surface**: `#F0F0DB` serves as the primary canvas, providing a soft, non-glare warm ground reminiscent of bond ledger paper.
- **Card & Table Canvas**: `#FFFFFF` provides clean contrast against the warm page background.
- **Primary Ink**: `#30364F` is the dominant tone for the persistent navigation sidebar, primary actions, headings, and high-emphasis body text.
- **Structural Neutral & Secondary Text**: `#ACBAC4` handles secondary labels, metadata, inactive icons, input outlines, and table row dividers.
- **Highlight & Selection**: `#E1D9BC` provides subtle background fills for active navigation states, selected rows, table hover states, and neutral status tags.
- **Semantic Muted Green**: `#3E7B55` denotes completed transactions, paid receipts, and positive reconciliation. For chip backgrounds, use `#3E7B55` at 10% opacity over `#FFFFFF`.
- **Semantic Muted Red**: `#B4432F` represents overdue installments, critical errors, and destructive operations. For chip backgrounds, use `#B4432F` at 10% opacity over `#FFFFFF`.
- **Strict Limitation**: No outside accent hues, saturation boosts, or multi-stop gradients are permitted.

## Typography
The typographic hierarchy relies entirely on `Inter` across all contexts. To support intense data density and auditing tasks:

- **Tabular Figures**: All monetary amounts, dates, roll numbers, fee balances, and phone numbers must strictly apply `font-feature-settings: "tnum" 1, "cv05" 1` to align numbers systematically across columns.
- **Currency Convention**: Indian Rupee denominations must be formatted according to the Indian numbering system using standard comma spacing (e.g., `₹12,34,000`, `₹45,500`), prefixed by the glyph `₹`.
- **Restraint**: Limit weights strictly to `400` (Regular), `500` (Medium), and `600` (Semi-bold). Avoid extra bold or black weights.

## Layout & Spacing
The layout follows an 8px grid designed desktop-first for standard 1440px administrative displays:

- **Canvas Architecture**: A fixed persistent left sidebar of `260px` in `#30364F` with a fluid main workspace bounded by a max-width container of `1180px` centered within the remaining space.
- **Card Padding**: All structural cards adhere to generous interior breathing room between `24px` (`1.5rem`) and `32px` (`2rem`).
- **Data Densities**: Table rows maintain a uniform height of `48px` with horizontal cell padding of `16px`. Compact summary lists use `12px` vertical padding.
- **Breakpoints**: 
  - `Desktop (>= 1280px)`: 12-column grid, 24px gutter, 32px canvas margins.
  - `Tablet (768px - 1279px)`: Sidebar collapses to an 80px icon navigation strip, 16px gutter, 24px canvas margins.
  - `Mobile (< 768px)`: Single-column stacked layout, off-canvas navigation drawer, 16px margins, minimum 16px card padding.

## Elevation & Depth
This design system avoids dropped shadows, blurred layered elevations, and skeuomorphic bevels. Visual hierarchy is achieved strictly via low-contrast structural containment:

- **Borders & Dividers**: Flat containment defined by `1px solid #ACBAC4` borders encasing cards, modals, table headers, and inputs.
- **Background Contrast**: Depth is created solely by placing `#FFFFFF` structural surfaces directly over the `#F0F0DB` canvas.
- **Layering Overlays**: Modals and slide-out transaction drawers sit on top of an overlay wash of `#30364F` at 40% opacity, bordered completely by `1px solid #ACBAC4` with no drop shadows applied.

## Shapes
Geometry is disciplined, utilitarian, and subtle:

- **Cards, Panels, and Modals**: Uniform `8px` corner radius.
- **Form Inputs and Dropdowns**: Uniform `8px` corner radius.
- **Buttons and Status Chips**: Uniform `6px` corner radius.
- **Dividers**: Clean square ends, hairline `1px` stroke. No rounded pills or circular action buttons.

## Components

### Buttons
- **Primary Button**: Solid `#30364F` background with `#F0F0DB` text. 6px border radius, 10px vertical and 16px horizontal padding. Hover state: `#232738`. Active state: `#1A1D2B`.
- **Secondary Button**: White `#FFFFFF` background with `#30364F` text and `1px solid #ACBAC4` border. Hover state: `#F0F0DB` background.
- **Destructive Button**: White `#FFFFFF` background with `#B4432F` text and `1px solid #B4432F` border. Hover state: `#B4432F` at 8% opacity.

### Status Chips
All chips use a 6px radius, 4px vertical / 8px horizontal padding, and 12px Medium typography:
- **Paid**: `#3E7B55` text on `#3E7B551A` (10% tint).
- **Part Paid**: `#30364F` text on `#E1D9BC` background.
- **Overdue**: `#B4432F` text on `#B4432F1A` (10% tint).
- **Due Soon**: `#30364F` text on `#E1D9BC` background.
- **Upcoming**: `#30364F` text, `#FFFFFF` background, `1px solid #ACBAC4`.

### Tables & Data Grids
- **Container**: White `#FFFFFF` background encased in `1px solid #ACBAC4`.
- **Header Row**: `#F0F0DB` fill, 12px uppercase semi-bold text in `#30364F`, bottom border `1px solid #ACBAC4`.
- **Body Rows**: `#FFFFFF` fill with bottom border `1px solid #ACBAC4`. Hover state: `#E1D9BC` at 40% fill.
- **Numerical Alignment**: All student enrollment numbers, dates, and amounts (`₹`) align right using tabular figures.

### Form Inputs & Selects
- Height: 40px with 12px horizontal padding.
- Surface: `#FFFFFF` with `1px solid #ACBAC4` border, 8px radius.
- Text: 14px `#30364F`. Placeholder: `#ACBAC4`.
- Focus State: Border color transitions to `#30364F` with no exterior glow ring.
- Error State: Border color `#B4432F`.

### Checkboxes & Radio Controls
- Base: 16px square (checkbox) or circle (radio), `1px solid #ACBAC4` border on `#FFFFFF`.
- Checked State: Solid `#30364F` background with `#F0F0DB` check mark or inner dot.

### Cards
- Surface: `#FFFFFF` fill, `1px solid #ACBAC4` perimeter border, 8px radius.
- Padding: 24px default, 32px for master ledger overview cards.
- Header separator: Optional `1px solid #ACBAC4` line between card title block and body.

### Iconography
- Restrict to unshaded, single-path line icons (1.5px stroke width).
- Icon color matches adjacent text (`#30364F` or `#ACBAC4`).