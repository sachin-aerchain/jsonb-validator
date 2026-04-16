# jsonbguard

A lightweight tool for validating PostgreSQL queries that touch JSONB `schema` columns in `QuoteRequests` and `TrTemplates` tables. Catches null propagation bugs, missing COALESCE guards, absent WHERE filters, and more — before they reach production.

## Features

- **8 automated checks** targeting JSONB-specific failure patterns
- **Pre-flight checklist** for production query review
- **Safe copy-paste patterns** for common schema update operations
- **Explainer** documenting the null propagation root cause
- Zero dependencies — pure HTML/CSS/JS

## Live Demo

After deploying, your app will be at:
```
https://<your-github-username>.github.io/jsonb-validator/
```

## Deploy to GitHub Pages

### 1. Create the repository

```bash
# On your machine, inside the project folder:
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/jsonb-validator.git
git push -u origin main
```

### 2. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages** (left sidebar)
3. Under **Source**, select **GitHub Actions**
4. Click **Save**

The workflow at `.github/workflows/deploy.yml` will automatically trigger on every push to `main` and deploy the app.

### 3. Access your app

After the first workflow run completes (usually ~1 minute), visit:
```
https://<your-username>.github.io/jsonb-validator/
```

## Project structure

```
jsonb-validator/
├── index.html                  # App entry point
├── src/
│   ├── style.css               # All styles
│   ├── checks.js               # Validation rules, examples, patterns, checklist
│   └── app.js                  # UI logic
└── .github/
    └── workflows/
        └── deploy.yml          # GitHub Actions Pages deployment
```

## Adding new checks

Open `src/checks.js` and add an entry to the `CHECKS` array:

```js
{
  id: 'my_check',
  level: 'error',          // 'error' | 'warning' | 'info'
  title: 'Short title',
  detect: sql => {
    // Return true if the issue is present in `sql`
    return /some_pattern/i.test(sql);
  },
  desc: 'Explanation of why this is dangerous.',
  fix: `-- Example of the correct pattern`
}
```

## Local development

No build step needed. Just open `index.html` in a browser:

```bash
# Using Python:
python3 -m http.server 8080

# Using Node:
npx serve .
```

Then visit `http://localhost:8080`.
