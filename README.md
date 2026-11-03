# Batch Photo Resizer and Watermarker

**Prepare many photos for school or social — in one batch.**

A browser-based tool that resizes, watermarks, and exports a whole folder of photos at once.
No installs, no accounts, and no uploads: every image is processed locally with the Canvas API.

---

## The project in one paragraph

**Batch Photo Resizer and Watermarker** helps students, teachers, and content creators to
prepare many photos for school or social media in minutes every day. Instead of opening each
photo in an editor, resizing it, adding a watermark, and saving it one by one, the user drops a
whole folder of photos, chooses one size and one watermark, and downloads every finished image
together as a ZIP file.

---

## What it does

| Feature | Details |
| --- | --- |
| Batch input | Drag and drop or browse; JPG, PNG, WebP, GIF; unlimited files |
| Resize presets | Instagram post/story, Facebook post, YouTube thumbnail, A4 print, web width |
| Custom resize | Longest side, width, exact width × height (crop to fill), or percent |
| No upscaling | Small photos keep their size instead of becoming blurry |
| Text watermark | Custom text, size, colour, opacity, 9 positions, or a tiled pattern |
| Watermark styles | Plain, with shadow, or on a dark box |
| Export | JPEG, PNG, or WebP with a quality slider |
| Download | One ZIP with every photo, or each file on its own |
| Preview | Live preview with original size, output size, and estimated file size |
| Privacy | Images never leave the device — no server, no tracking |

---

## How it works

| Input | Process | Output |
| --- | --- | --- |
| Photos chosen from the device, plus a size, watermark text, and export format | The browser decodes each photo, scales or crops it on a canvas, draws the watermark, and encodes it | Resized, watermarked files named `name-WxH.jpg`, downloadable one by one or as a ZIP |

1. **Add photos** — the queue lists every photo with its original size.
2. **Choose size and watermark** — one setting applies to the whole batch.
3. **Process and download** — each photo is redrawn on a canvas and exported.

Everything runs in the browser. The only network request is the page itself (plus the optional
JSZip library used to build the ZIP).

---

## Run it locally

Open `index.html` in a modern browser, or serve the folder:

```powershell
cd "batch-photo-resizer"
python -m http.server 8123
```

Then visit <http://127.0.0.1:8123/>.

---

## Files

```
batch-photo-resizer/
├── index.html   structure and content
├── style.css    theme, layout, responsive rules
├── script.js    canvas resizing, watermarking, queue, ZIP export
└── README.md
```

---

## Limits and next steps

- Watermarks are text only; a logo (PNG) upload is the next feature.
- Very large batches (100+ high-resolution photos) need more memory — process them in groups.
- GIFs are exported as a single frame.
- Possible improvements: logo watermark, album-style contact sheet, saved presets, and EXIF
  date sorting.

---

*Multimedia final project — Batch Photo Resizer and Watermarker.*
