---
trigger: always_on
---

## 2. Design Token System (Mandatory)

All visual styling must be driven by **design tokens via CSS variables**.

- Define tokens in `:root` (or theme scopes).
- Required token categories:
  - `--color-*`
  - `--space-*`
  - `--radius-*`
  - `--font-*`
  - `--font-size-*`
  - `--line-height-*`
  - `--shadow-*`
  - `--transition-*`
- No hardcoded hex values, pixel spacing, or font sizes outside tokens.
- Support theming (light/dark) through token overrides.

Example:

```css
:root {
  --color-primary: #0a84ff;
  --space-md: 1rem;
  --font-sans: "Inter", sans-serif;
}
```
