# Scope: M1_Design_Overhaul (R1-R3)

## Architecture
- Define global styles in `frontend/src/app/globals.css` with Teal/Cyan accents and dark backgrounds.
- Pure RTL CSS structure and layout.
- Zero purple colors (`purple`, `violet`, hue `275-310`) in all user-facing files.
- Custom Toast and Custom Confirmation Dialog components in frontend.
- Custom z-index fixes for Dropdown/Select/Dialog layering (handling portal stacking context).

## Tasks
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Purge Purple | Search and replace all purple/violet colors with Teal/Cyan or dark grays | None | DONE |
| 2 | Globals & Layouts | Update globals.css and layout.tsx with dark background, gradients, Tajawal font, and glow effects | 1 | DONE |
| 3 | custom Dialogs/Alerts | Create custom Toast/Notification component and Custom Confirmation Dialog component | None | DONE |
| 4 | Stacking & Overflow | Fix z-index stacking in dialogs/selects/dropdowns and make admin tabs scrollable on mobile | 2 | DONE |
| 5 | Replace Natives | Replace all window.alert(), window.confirm(), window.location.reload() in settings, rules, team, admin | 3 | DONE |
| 6 | E2E Testing | Verify that frontend compilation passes and all page buttons have working click handlers | 4, 5 | DONE |
