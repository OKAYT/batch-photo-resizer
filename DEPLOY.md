# Deploying on GitHub Pages

This is a static site: `index.html`, `style.css`, and `script.js`. There is no build step,
so GitHub Pages can serve the folder exactly as it is.

## 1. Open the project in VS Code

Open VS Code → **File → Open Folder…** → choose:

```
C:\Users\Asus\OneDrive\Documents\Default Project\batch-photo-resizer
```

## 2. Publish to GitHub (easiest way, inside VS Code)

1. Click the **Source Control** icon on the left (the branch symbol).
2. Click **Publish to GitHub**.
3. Sign in if VS Code asks.
4. Choose **public** repository (GitHub Pages is free for public repos).
5. Name it `batch-photo-resizer` and press Enter.
6. VS Code uploads the files and creates the repository.

## 2b. Or use the terminal

1. Open <https://github.com/new>
2. Repository name: **batch-photo-resizer** · **Public** · do **not** add a README, .gitignore, or licence
3. Click **Create repository**
4. In the VS Code terminal run:

```powershell
cd "C:\Users\Asus\OneDrive\Documents\Default Project\batch-photo-resizer"
git push -u origin main
```

The remote is already set to <https://github.com/OKAYT/batch-photo-resizer.git>.
If Git asks you to sign in, choose **Sign in with your browser**.

> If you start from scratch on another computer, replace `OKAYT` with your own GitHub username.

## 3. Turn on GitHub Pages

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Branch: **main**, folder: **/ (root)** → **Save**.
5. Wait 1–2 minutes, then open:

```
https://okayt.github.io/batch-photo-resizer/
```

## 4. When you change the code later

```powershell
git add .
git commit -m "Describe your change"
git push
```

GitHub Pages redeploys automatically in about a minute.

## Notes

- The site also works by double-clicking `index.html` (no server needed).
- The only online resources are Google Fonts and the JSZip library used for the ZIP download.
  Everything else runs locally in the browser.
- Do not add a token, password, or personal data to the files — the repository is public.
