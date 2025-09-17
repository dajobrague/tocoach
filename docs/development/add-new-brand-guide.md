# Add a New Brand in ≤15 Minutes

This guide walks you through creating a new brand theme for the TopCoach platform. The entire process should take no more than 15 minutes.

## Prerequisites

- Basic understanding of colors (hex codes)
- Image editing software (optional, for custom logos/banners)
- Access to the project repository

## Step 1: Create Brand Directory (2 minutes)

1. Navigate to `/public/brands/`
2. Create a new folder with your brand slug (lowercase, use hyphens for spaces)
   ```bash
   mkdir public/brands/my-fitness-brand
   ```

## Step 2: Create theme.json (5 minutes)

Copy the default theme and customize it:

```bash
cp public/brands/default/theme.json public/brands/my-fitness-brand/theme.json
```

Edit the `theme.json` file with your brand values:

```json
{
  "meta": {
    "name": "My Fitness Brand",
    "version": "1.0.0",
    "description": "Custom fitness brand theme"
  },
  "fonts": {
    "heading": {
      "family": "Inter, system-ui, sans-serif",
      "weight": 600
    },
    "body": {
      "family": "Inter, system-ui, sans-serif",
      "weight": 400
    }
  },
  "colors": {
    "brand": "#your-primary-color",
    "accent": "#your-accent-color",
    "text": {
      "primary": "#your-text-color",
      "secondary": "#your-secondary-text"
    },
    "surface": {
      "1": "#your-background",
      "2": "#your-secondary-background"
    },
    "border": "#your-border-color",
    "fill": "#your-fill-color"
  },
  "radius": {
    "sm": 8,
    "md": 12,
    "lg": 16,
    "xl": 20
  },
  "shadow": {
    "e1": "0 2px 4px rgba(0, 0, 0, 0.06)",
    "e2": "0 8px 16px rgba(0, 0, 0, 0.10)"
  },
  "semantic": {
    "success": "#22c55e",
    "warning": "#f59e0b",
    "error": "#ef4444"
  },
  "assets": {
    "logo": "/brands/my-fitness-brand/logo.svg",
    "banner": "/brands/my-fitness-brand/banner.svg"
  }
}
```

### Color Guidelines

**Required Colors:**

- `brand`: Your primary brand color (used for buttons, links)
- `accent`: Secondary brand color (used for highlights)
- `text.primary`: Main text color (must have 4.5:1 contrast with surfaces)
- `text.secondary`: Secondary text color (must have 4.5:1 contrast with surface.1)
- `surface.1`: Primary background color
- `surface.2`: Secondary background color (cards, panels)
- `border`: Border color for UI elements
- `fill`: Fill color for form elements

**Color Format:**

- Use 6-digit hex codes: `#ff0000` ✅
- Avoid 3-digit codes: `#f00` ❌
- Include the # symbol

**Contrast Requirements:**

- Text on surfaces must meet WCAG AA (4.5:1 ratio)
- If contrast fails, the system will auto-correct and log warnings

### Radius Guidelines

- Values must be between 6-28 pixels
- `sm`: Small elements (chips, badges)
- `md`: Standard elements (buttons, inputs)
- `lg`: Cards and panels
- `xl`: Large containers

## Step 3: Create Logo (4 minutes)

Create a logo SVG file at `/public/brands/my-fitness-brand/logo.svg`:

**Size Requirements:**

- Maximum file size: 50KB
- Recommended dimensions: 200x60px
- Must be scalable (SVG format)
- Should look good at 24-32px height

**Quick Logo Template:**

```svg
<svg width="200" height="60" viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Background (optional) -->
  <rect width="200" height="60" rx="8" fill="currentColor" fill-opacity="0.05"/>

  <!-- Your logo icon here -->
  <circle cx="30" cy="30" r="15" fill="currentColor"/>

  <!-- Brand text -->
  <text x="55" y="25" fill="currentColor" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="600">
    My Fitness Brand
  </text>
  <text x="55" y="42" fill="currentColor" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="400" opacity="0.7">
    Tagline Here
  </text>
</svg>
```

**Tips:**

- Use `currentColor` for fills to inherit theme colors
- Keep design simple and recognizable at small sizes
- Ensure text is readable on both light and dark backgrounds

## Step 4: Create Banner (3 minutes)

Create a banner at `/public/brands/my-fitness-brand/banner.svg`:

**Size Requirements:**

- Maximum file size: 350KB
- Recommended dimensions: 1200x400px
- SVG format preferred, WebP acceptable

**Quick Banner Template:**

```svg
<svg width="1200" height="400" viewBox="0 0 1200 400" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Background gradient -->
  <defs>
    <linearGradient id="brand-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#your-brand-color"/>
      <stop offset="100%" style="stop-color:#your-accent-color"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="400" fill="url(#brand-gradient)"/>

  <!-- Main content centered -->
  <g transform="translate(600, 200)">
    <!-- Your logo/icon -->
    <circle cx="-100" cy="0" r="30" fill="white"/>

    <!-- Title -->
    <text x="-50" y="10" fill="white" font-family="Inter, system-ui, sans-serif" font-size="48" font-weight="600" text-anchor="start">
      My Fitness Brand
    </text>

    <!-- Subtitle -->
    <text x="-50" y="45" fill="white" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="400" text-anchor="start" opacity="0.9">
      Your Fitness Journey Starts Here
    </text>
  </g>

  <!-- Decorative bottom wave -->
  <path d="M0 350 Q300 310 600 350 T1200 350 V400 H0 Z" fill="white" fill-opacity="0.1"/>
</svg>
```

## Step 5: Add Brand to System (1 minute)

Update the available brands list in `/lib/theme/loader.ts`:

```typescript
export const AVAILABLE_BRANDS = [
  "default",
  "ironfit",
  "zen-coach",
  "my-fitness-brand",
] as const;
```

## Step 6: Test Your Brand

1. **Start the development server:**

   ```bash
   npm run dev
   ```

2. **Test the brand URL:**

   - Visit: `http://localhost:3000?brand=my-fitness-brand`
   - Or use the brand switcher in the navbar

3. **Verify everything works:**
   - ✅ Logo appears in navbar
   - ✅ Colors apply throughout the interface
   - ✅ No console errors
   - ✅ Contrast is readable
   - ✅ Mobile frame displays correctly

## Troubleshooting

### Common Issues

**"Brand not found" error:**

- Check that your folder name matches the URL parameter exactly
- Ensure `theme.json` is valid JSON (use a validator)

**Colors not applying:**

- Verify hex codes are 6 digits with # symbol
- Check browser developer tools for CSS variable values

**Logo not showing:**

- Confirm file path in `theme.json` matches actual file location
- Check that SVG is valid and not corrupted

**Contrast warnings in console:**

- Use a contrast checker tool (WebAIM, Colour Contrast Analyser)
- Adjust text colors to meet WCAG AA standards (4.5:1 ratio)

### Validation Errors

The system will automatically validate your theme and log specific errors:

```
[Theme] Validation failed for brand "my-fitness-brand":
  colors.brand: Must be a valid 6-digit hex color
  radius.sm: Radius must be at least 6px
```

Fix these errors in your `theme.json` file.

### Performance Issues

If theme switching is slow (>100ms):

- Optimize SVG files (remove unnecessary elements)
- Check file sizes are within limits
- Ensure no network issues loading assets

## Brand Checklist

Before launching your brand:

- [ ] **Files Created:**

  - [ ] `/public/brands/{slug}/theme.json`
  - [ ] `/public/brands/{slug}/logo.svg`
  - [ ] `/public/brands/{slug}/banner.svg`

- [ ] **Theme Validation:**

  - [ ] All colors are valid hex codes
  - [ ] Radius values are 6-28px
  - [ ] Contrast ratios meet WCAG AA
  - [ ] No validation errors in console

- [ ] **Assets:**

  - [ ] Logo is under 50KB and scales well
  - [ ] Banner is under 350KB
  - [ ] Both files load without errors

- [ ] **Testing:**

  - [ ] Brand switches correctly via URL
  - [ ] Brand switches correctly via navbar
  - [ ] Mobile frame displays properly
  - [ ] All UI elements use theme colors
  - [ ] Typography renders correctly

- [ ] **Performance:**
  - [ ] Theme applies in <100ms
  - [ ] No console errors or warnings
  - [ ] Smooth switching between brands

## Advanced Customization

### Custom Shadows

Create depth-appropriate shadows:

```json
{
  "shadow": {
    "e1": "0 1px 3px rgba(your-brand-r, your-brand-g, your-brand-b, 0.12)",
    "e2": "0 8px 30px rgba(your-brand-r, your-brand-g, your-brand-b, 0.15)"
  }
}
```

### Brand-Specific Radius

Match your brand personality:

- **Modern/Tech:** Smaller radius (6-10px)
- **Friendly/Approachable:** Medium radius (10-16px)
- **Playful/Creative:** Larger radius (16-24px)

### Color Psychology

Choose colors that match your brand:

- **Energy/Fitness:** Orange, red, yellow
- **Wellness/Calm:** Green, blue, purple
- **Professional:** Navy, gray, black
- **Luxury:** Black, gold, deep colors

## Next Steps

Once your brand is working:

1. **Share with stakeholders** using the `?brand=your-slug` URL
2. **Gather feedback** on colors, typography, and overall feel
3. **Iterate** based on user testing
4. **Document** any brand-specific guidelines
5. **Prepare for production** deployment

## Support

If you encounter issues:

1. Check the browser console for specific error messages
2. Validate your JSON using an online validator
3. Test contrast ratios using accessibility tools
4. Review this guide for common mistakes

The system is designed to be forgiving - if something breaks, it will fallback to the default theme and log helpful error messages.

---

**Estimated Time:** 15 minutes
**Difficulty:** Beginner
**Requirements:** Basic color knowledge, text editor
