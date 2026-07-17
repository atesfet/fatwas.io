# FatWAS Interactive Website

This folder contains an interactive website for the FatWAS manuscript:

**Phenome-wide associations of CT-derived adipose area and radiodensity in 22,779 patients**

## Contents

- `index.html`: main landing page with abstract, per-marker sections, and interactive table
- `plot.html`: reusable page for Manhattan/volcano plots (via URL params)
- `overall.html`: top cross-marker association summary plot
- `significant_associations.csv`: source data for all plots/tables
- `static/`: CSS/JS/font assets

## Local preview

From this directory:

```bash
python3 -m http.server 8000
```

Then open: `http://localhost:8000`

## GitHub Pages deployment

1. Create a new GitHub repository (for example: `fatwas.io`).
2. Push this folder contents to the repository root.
3. In GitHub: `Settings` -> `Pages`.
4. Under `Build and deployment`, choose:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main` (root)
5. Save and wait for deployment.

If your repo is named `fatwas.io` under your account/organization, the site URL will typically be:

`https://<github-username>.github.io/fatwas.io/`

If you use a user/org site repo name like `<github-username>.github.io`, it can deploy at the domain root.
