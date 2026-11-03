/* =========================================================
   Batch Photo Resizer & Watermarker
   All processing happens locally with the Canvas API.
   ========================================================= */
(() => {
  "use strict";

  /* ---------------- Elements ---------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const dropzone = $("#dropzone");
  const fileInput = $("#fileInput");
  const fileSummary = $("#fileSummary");
  const preset = $("#preset");
  const mode = $("#mode");
  const sizeA = $("#sizeA");
  const sizeB = $("#sizeB");
  const sizeAUnit = $("#sizeAUnit");
  const heightField = $("#heightField");
  const noUpscale = $("#noUpscale");

  const wmText = $("#wmText");
  const wmSize = $("#wmSize");
  const wmSizeOut = $("#wmSizeOut");
  const wmOpacity = $("#wmOpacity");
  const wmOpacityOut = $("#wmOpacityOut");
  const wmColor = $("#wmColor");
  const wmColorText = $("#wmColorText");
  const wmStyle = $("#wmStyle");
  const wmTile = $("#wmTile");
  const posGrid = $("#posGrid");

  const format = $("#format");
  const quality = $("#quality");
  const qualityOut = $("#qualityOut");
  const qualityField = $("#qualityField");

  const processBtn = $("#processBtn");
  const downloadBtn = $("#downloadBtn");
  const clearBtn = $("#clearBtn");
  const statusEl = $("#status");

  const previewCanvas = $("#previewCanvas");
  const previewEmpty = $("#previewEmpty");
  const previewMeta = $("#previewMeta");
  const factOriginal = $("#factOriginal");
  const factOutput = $("#factOutput");
  const factSize = $("#factSize");

  const queueList = $("#queueList");
  const queueEmpty = $("#queueEmpty");
  const queueCount = $("#queueCount");
  const addMoreBtn = $("#addMoreBtn");
  const removeAllBtn = $("#removeAllBtn");

  const toastEl = $("#toast");
  const toastTitle = $("#toastTitle");
  const toastMessage = $("#toastMessage");

  /* ---------------- State ---------------- */
  const state = {
    photos: [],
    selectedId: null,
    processed: false,
    busy: false,
    position: "se",
    watermarkColor: "#ffffff",
  };

  let toastTimer = null;
  let previewTimer = null;

  /* ---------------- Helpers ---------------- */
  const uid = () => Math.random().toString(36).slice(2, 10);

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function showToast(title, message, type = "ok") {
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    toastEl.classList.remove("is-ok", "is-error");
    toastEl.classList.add(type === "error" ? "is-error" : "is-ok");
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 4200);
  }

  function setStatus(text, tone = "") {
    statusEl.textContent = text;
    statusEl.classList.remove("is-ok", "is-error");
    if (tone) statusEl.classList.add(tone);
  }

  function readSettings() {
    const isPercent = mode.value === "percent";
    const fallback = isPercent ? 100 : 1600;

    return {
      mode: mode.value,
      sizeA: isPercent
        ? clamp(Number(sizeA.value) || fallback, 5, 300)
        : clamp(Number(sizeA.value) || fallback, 16, 8000),
      sizeB: clamp(Number(sizeB.value) || 1600, 16, 8000),
      noUpscale: noUpscale.checked,
      wm: {
        text: wmText.value.trim(),
        sizePct: Number(wmSize.value),
        opacity: Number(wmOpacity.value),
        color: state.watermarkColor,
        style: wmStyle.value,
        position: state.position,
        tile: wmTile.checked,
      },
      format: format.value,
      quality: Number(quality.value) / 100,
    };
  }

  /* ---------------- Target size ---------------- */
  function targetSize(photo, s) {
    const w = photo.width;
    const h = photo.height;

    if (s.mode === "percent") {
      let pct = s.sizeA;
      if (s.noUpscale) pct = Math.min(pct, 100);
      return {
        w: Math.max(1, Math.round((w * pct) / 100)),
        h: Math.max(1, Math.round((h * pct) / 100)),
        crop: false,
      };
    }

    if (s.mode === "exact") {
      if (s.noUpscale && w <= s.sizeA && h <= s.sizeB) {
        return { w, h, crop: false };
      }
      return { w: s.sizeA, h: s.sizeB, crop: true };
    }

    if (s.mode === "width") {
      let width = s.sizeA;
      if (s.noUpscale) width = Math.min(width, w);
      const scale = width / w;
      return { w: Math.round(width), h: Math.max(1, Math.round(h * scale)), crop: false };
    }

    // Longest side (default)
    const longest = Math.max(w, h);
    let size = s.sizeA;
    if (s.noUpscale) size = Math.min(size, longest);
    const scale = size / longest;
    return {
      w: Math.max(1, Math.round(w * scale)),
      h: Math.max(1, Math.round(h * scale)),
      crop: false,
    };
  }

  /* ---------------- Drawing ---------------- */
  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function drawPhoto(ctx, img, outW, outH, crop) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (crop) {
      const scale = Math.max(outW / img.width, outH / img.height);
      const sw = outW / scale;
      const sh = outH / scale;
      const sx = (img.width - sw) / 2;
      const sy = (img.height - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    } else {
      ctx.drawImage(img, 0, 0, outW, outH);
    }
  }

  function drawWatermark(ctx, outW, outH, wm) {
    const text = wm.text;
    if (!text) return;

    const base = Math.min(outW, outH);
    const fontSize = Math.max(9, Math.round((base * wm.sizePct) / 100));
    const pad = Math.max(10, Math.round(base * 0.028));

    ctx.save();
    ctx.font = `600 ${fontSize}px Inter, Arial, sans-serif`;
    ctx.globalAlpha = clamp(wm.opacity / 100, 0.05, 1);
    ctx.fillStyle = wm.color;

    const metrics = ctx.measureText(text);
    const textW = metrics.width;
    const textH = fontSize;

    if (wm.tile) {
      const stepX = textW + fontSize * 2.6;
      const stepY = fontSize * 3.4;
      const diagonal = Math.hypot(outW, outH);

      ctx.translate(outW / 2, outH / 2);
      ctx.rotate((-28 * Math.PI) / 180);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let y = -diagonal / 2; y <= diagonal / 2; y += stepY) {
        for (let x = -diagonal / 2; x <= diagonal / 2; x += stepX) {
          if (wm.style === "shadow") {
            ctx.shadowColor = "rgba(0,0,0,0.45)";
            ctx.shadowBlur = fontSize * 0.4;
            ctx.shadowOffsetY = fontSize * 0.08;
          }
          ctx.fillText(text, x, y);
        }
      }
      ctx.restore();
      return;
    }

    let x;
    let y;
    const p = wm.position;

    if (p.includes("w")) { x = pad; ctx.textAlign = "left"; }
    else if (p.includes("e")) { x = outW - pad; ctx.textAlign = "right"; }
    else { x = outW / 2; ctx.textAlign = "center"; }

    if (p === "nw" || p === "n" || p === "ne") y = pad + textH * 0.55;
    else if (p === "sw" || p === "s" || p === "se") y = outH - pad - textH * 0.55;
    else y = outH / 2;

    ctx.textBaseline = "middle";

    if (wm.style === "shadow") {
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = Math.max(4, fontSize * 0.45);
      ctx.shadowOffsetY = Math.max(1, fontSize * 0.07);
    }

    if (wm.style === "box") {
      const boxPadX = fontSize * 0.55;
      const boxPadY = fontSize * 0.42;
      const boxW = textW + boxPadX * 2;
      const boxH = textH + boxPadY * 2;
      let boxX;

      if (ctx.textAlign === "left") boxX = x - boxPadX;
      else if (ctx.textAlign === "right") boxX = x - boxW + boxPadX;
      else boxX = x - boxW / 2;

      ctx.save();
      ctx.globalAlpha = clamp(wm.opacity / 100, 0.05, 1);
      ctx.fillStyle = "rgba(10, 12, 16, 0.55)";
      roundRect(ctx, boxX, y - boxH / 2, boxW, boxH, fontSize * 0.28);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = wm.color;
    }

    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function paint(canvas, photo, settings, outW, outH, crop) {
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, outW, outH);

    if (settings.format === "jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, outW, outH);
    }

    drawPhoto(ctx, photo.img, outW, outH, crop);
    drawWatermark(ctx, outW, outH, settings.wm);
    return ctx;
  }

  /* ---------------- Preview ---------------- */
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 120);
  }

  function renderPreview() {
    const photo = state.photos.find((p) => p.id === state.selectedId);

    if (!photo) {
      previewCanvas.hidden = true;
      previewEmpty.hidden = false;
      previewMeta.textContent = "Nothing selected";
      factOriginal.textContent = "—";
      factOutput.textContent = "—";
      factSize.textContent = "—";
      return;
    }

    const settings = readSettings();
    const target = targetSize(photo, settings);
    paint(previewCanvas, photo, settings, target.w, target.h, target.crop);

    previewCanvas.hidden = false;
    previewEmpty.hidden = true;
    previewMeta.textContent = photo.name;
    factOriginal.textContent = `${photo.width} × ${photo.height}`;
    factOutput.textContent = `${target.w} × ${target.h}`;

    // Estimate the exported file size from the preview.
    previewCanvas.toBlob(
      (blob) => {
        if (blob) factSize.textContent = `≈ ${formatBytes(blob.size)}`;
      },
      mimeFor(settings.format),
      settings.format === "png" ? undefined : settings.quality
    );
  }

  /* ---------------- Queue ---------------- */
  function renderQueue() {
    queueList.querySelectorAll(".photo").forEach((el) => el.remove());

    const hasPhotos = state.photos.length > 0;
    queueEmpty.hidden = hasPhotos;
    queueCount.textContent = String(state.photos.length);
    removeAllBtn.disabled = !hasPhotos;
    clearBtn.disabled = !hasPhotos;

    const settings = readSettings();

    state.photos.forEach((photo) => {
      const li = document.createElement("li");
      li.className = "photo" + (photo.id === state.selectedId ? " is-active" : "");
      li.dataset.id = photo.id;

      const img = document.createElement("img");
      img.className = "photo__thumb";
      img.src = photo.thumb;
      img.alt = "";
      img.loading = "lazy";

      const body = document.createElement("div");
      body.className = "photo__body";

      const name = document.createElement("span");
      name.className = "photo__name";
      name.textContent = photo.name;
      name.title = photo.name;

      const meta = document.createElement("div");
      meta.className = "photo__meta";

      const target = targetSize(photo, settings);
      const dims = document.createElement("span");
      dims.textContent = `${photo.width}×${photo.height} → ${target.w}×${target.h}`;

      meta.append(dims);

      if (photo.result) {
        const done = document.createElement("span");
        done.className = "ok";
        done.textContent = `✓ ${formatBytes(photo.result.blob.size)}`;
        meta.append(done);
      }

      body.append(name, meta);

      const actions = document.createElement("div");
      actions.className = "photo__actions";

      const downloadOne = document.createElement("button");
      downloadOne.type = "button";
      downloadOne.className = "icon-btn";
      downloadOne.dataset.action = "download";
      downloadOne.title = "Download this photo";
      downloadOne.setAttribute("aria-label", `Download ${photo.name}`);
      downloadOne.hidden = !photo.result;
      downloadOne.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0l-4-4m4 4l4-4"/><path d="M5 20h14"/></svg>';

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "icon-btn";
      remove.dataset.action = "remove";
      remove.title = "Remove photo";
      remove.setAttribute("aria-label", `Remove ${photo.name}`);
      remove.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

      actions.append(downloadOne, remove);
      li.append(img, body, actions);
      queueList.append(li);
    });

    updateSummary();
    updateActions();
  }

  function updateSummary() {
    if (!state.photos.length) {
      fileSummary.textContent = "No photos added yet.";
      return;
    }
    const total = state.photos.reduce((sum, p) => sum + p.file.size, 0);
    fileSummary.textContent = `${state.photos.length} photo${state.photos.length === 1 ? "" : "s"} · ${formatBytes(total)}`;
  }

  function updateActions() {
    const hasPhotos = state.photos.length > 0;
    const allDone = hasPhotos && state.photos.every((p) => p.result);
    downloadBtn.disabled = !allDone || state.busy;
    processBtn.disabled = !hasPhotos || state.busy;

    if (!hasPhotos) {
      setStatus("Add photos to get started.");
    } else if (!allDone && !state.busy) {
      setStatus(`${state.photos.length} photo${state.photos.length === 1 ? "" : "s"} ready to process.`);
    }
  }

  /* ---------------- Add / remove ---------------- */
  async function addFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith("image/"));
    const rejected = [...fileList].length - files.length;

    if (!files.length) {
      showToast(
        "No photos added",
        state.photos.length
          ? "Only image files such as JPG, PNG, or WebP can be added."
          : "Choose image files such as JPG, PNG, or WebP.",
        "error"
      );
      return;
    }

    setStatus("Reading photos…");

    for (const file of files) {
      const url = URL.createObjectURL(file);
      const img = new Image();

      try {
        img.src = url;
        await img.decode();
      } catch {
        URL.revokeObjectURL(url);
        showToast("Could not open a photo", `${file.name} is not a supported image.`, "error");
        continue;
      }

      const photo = {
        id: uid(),
        file,
        name: file.name,
        img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        thumb: url,
        result: null,
      };

      state.photos.push(photo);
      if (!state.selectedId) state.selectedId = photo.id;
    }

    if (rejected > 0) {
      showToast("Some files were skipped", `${rejected} file${rejected === 1 ? " was" : "s were"} not an image.`, "error");
    }

    renderQueue();
    schedulePreview();
    updateActions();

    if (state.photos.length) {
      setStatus(`${state.photos.length} photo${state.photos.length === 1 ? "" : "s"} ready to process.`);
    }
  }

  function removePhoto(id) {
    const index = state.photos.findIndex((p) => p.id === id);
    if (index === -1) return;

    const [photo] = state.photos.splice(index, 1);
    URL.revokeObjectURL(photo.thumb);

    if (state.selectedId === id) {
      state.selectedId = state.photos[0]?.id ?? null;
    }

    renderQueue();
    schedulePreview();
    updateActions();
  }

  function clearAll() {
    state.photos.forEach((p) => {
      URL.revokeObjectURL(p.thumb);
      if (p.result?.url) URL.revokeObjectURL(p.result.url);
    });
    state.photos = [];
    state.selectedId = null;
    state.processed = false;
    renderQueue();
    renderPreview();
    updateActions();
    setStatus("Add photos to get started.");
  }

  /* ---------------- Processing ---------------- */
  function mimeFor(fmt) {
    if (fmt === "png") return "image/png";
    if (fmt === "webp") return "image/webp";
    return "image/jpeg";
  }

  function extFor(fmt) {
    if (fmt === "png") return "png";
    if (fmt === "webp") return "webp";
    return "jpg";
  }

  function baseName(name) {
    const base = name.replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]+/g, "-").trim();
    return base || "photo";
  }

  function canvasToBlob(canvas, mime, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the image."))),
        mime,
        quality
      );
    });
  }

  async function processBatch() {
    if (!state.photos.length || state.busy) return;

    state.busy = true;
    state.processed = false;
    processBtn.classList.add("is-busy");
    processBtn.querySelector(".btn__label").textContent = "Processing…";
    downloadBtn.disabled = true;

    const settings = readSettings();
    const mime = mimeFor(settings.format);
    const ext = extFor(settings.format);
    const canvas = document.createElement("canvas");

    try {
      for (let i = 0; i < state.photos.length; i += 1) {
        const photo = state.photos[i];
        setStatus(`Processing ${i + 1} of ${state.photos.length} — ${photo.name}`);

        const target = targetSize(photo, settings);
        paint(canvas, photo, settings, target.w, target.h, target.crop);
        const blob = await canvasToBlob(canvas, mime, settings.format === "png" ? undefined : settings.quality);

        if (photo.result?.url) URL.revokeObjectURL(photo.result.url);

        photo.result = {
          blob,
          url: URL.createObjectURL(blob),
          width: target.w,
          height: target.h,
          filename: `${baseName(photo.name)}-${target.w}x${target.h}.${ext}`,
        };

        // Let the interface update between photos.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      state.processed = true;
      renderQueue();
      renderPreview();
      updateActions();
      setStatus(`Done — ${state.photos.length} photo${state.photos.length === 1 ? "" : "s"} processed. Download the ZIP below.`, "is-ok");
      showToast("Batch ready", "Every photo is resized and watermarked. Download the ZIP.");
    } catch (error) {
      console.error(error);
      setStatus("Something went wrong while processing. Try fewer photos at once.", "is-error");
      showToast("Processing failed", "Try a smaller batch or a different format.", "error");
    } finally {
      state.busy = false;
      processBtn.classList.remove("is-busy");
      processBtn.querySelector(".btn__label").textContent = "Process batch";
      updateActions();
    }
  }

  /* ---------------- Downloads ---------------- */
  function triggerDownload(url, filename) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
  }

  function downloadOne(id) {
    const photo = state.photos.find((p) => p.id === id);
    if (!photo?.result) return;
    triggerDownload(photo.result.url, photo.result.filename);
    showToast("Saved", photo.result.filename);
  }

  async function downloadZip() {
    const done = state.photos.filter((p) => p.result);
    if (!done.length) return;

    const stamp = new Date().toISOString().slice(0, 10);

    if (typeof window.JSZip === "undefined") {
      // Fallback: download the files one by one.
      showToast("ZIP library unavailable", "Saving the photos one by one instead.");
      done.forEach((photo, index) => {
        setTimeout(() => triggerDownload(photo.result.url, photo.result.filename), index * 350);
      });
      return;
    }

    downloadBtn.disabled = true;
    const originalLabel = downloadBtn.textContent;
    downloadBtn.textContent = "Zipping…";

    try {
      const zip = new window.JSZip();
      const used = new Set();

      done.forEach((photo) => {
        let name = photo.result.filename;
        let counter = 2;
        while (used.has(name)) {
          name = photo.result.filename.replace(/(\.[^.]+)$/, `-${counter}$1`);
          counter += 1;
        }
        used.add(name);
        zip.file(name, photo.result.blob);
      });

      const blob = await zip.generateAsync(
        { type: "blob", compression: "STORE" },
        (meta) => {
          downloadBtn.textContent = `Zipping… ${Math.round(meta.percent)}%`;
        }
      );

      triggerDownload(URL.createObjectURL(blob), `batch-photos-${stamp}.zip`);
      showToast("ZIP saved", `${done.length} photo${done.length === 1 ? "" : "s"} in one file.`);
    } catch (error) {
      console.error(error);
      showToast("Could not build the ZIP", "Try downloading the photos one by one.", "error");
    } finally {
      downloadBtn.textContent = originalLabel;
      downloadBtn.disabled = false;
    }
  }

  /* ---------------- Settings UI ---------------- */
  const PRESETS = {
    original: { mode: "percent", a: 100, b: 100 },
    "ig-post": { mode: "exact", a: 1080, b: 1080 },
    "ig-story": { mode: "exact", a: 1080, b: 1920 },
    "fb-post": { mode: "exact", a: 1200, b: 630 },
    "yt-thumb": { mode: "exact", a: 1280, b: 720 },
    a4: { mode: "exact", a: 2480, b: 3508 },
    web: { mode: "width", a: 1600, b: 1600 },
  };

  function syncModeUi() {
    const isExact = mode.value === "exact";
    heightField.classList.toggle("is-hidden", !isExact);
    sizeAUnit.textContent = mode.value === "percent" ? "%" : "px";

    if (mode.value === "percent") {
      sizeA.min = 5;
      sizeA.max = 300;
      if (Number(sizeA.value) > 300) sizeA.value = 100;
    } else {
      sizeA.min = 16;
      sizeA.max = 8000;
    }

    if (isExact) {
      sizeB.min = 16;
      sizeB.max = 8000;
    }
  }

  function applyPreset(value) {
    const p = PRESETS[value];
    if (!p) return;
    mode.value = p.mode;
    sizeA.value = String(p.a);
    sizeB.value = String(p.b);
    syncModeUi();
    markBatchStale();
  }

  function markBatchStale() {
    if (state.photos.some((p) => p.result)) {
      state.photos.forEach((p) => {
        if (p.result?.url) URL.revokeObjectURL(p.result.url);
        p.result = null;
      });
      state.processed = false;
      renderQueue();
      updateActions();
    }
    schedulePreview();
  }

  function setPosition(pos) {
    state.position = pos;
    $$(".posgrid__cell", posGrid).forEach((cell) => {
      const active = cell.dataset.pos === pos;
      cell.classList.toggle("is-active", active);
      cell.setAttribute("aria-pressed", String(active));
    });
    markBatchStale();
  }

  function syncColor(value) {
    const hex = value.startsWith("#") ? value : `#${value}`;
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
    state.watermarkColor = hex.toLowerCase();
    wmColor.value = state.watermarkColor;
    wmColorText.value = state.watermarkColor.toUpperCase();
    markBatchStale();
  }

  /* ---------------- Events ---------------- */
  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files?.length) addFiles(fileInput.files);
    fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach((type) => {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      event.stopPropagation();
      dropzone.classList.add("is-drag");
    });
  });

  ["dragleave", "dragend"].forEach((type) => {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      if (type === "dragleave" && dropzone.contains(event.relatedTarget)) return;
      dropzone.classList.remove("is-drag");
    });
  });

  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropzone.classList.remove("is-drag");
    if (event.dataTransfer?.files?.length) addFiles(event.dataTransfer.files);
  });

  // Stop the browser from opening files dropped outside the dropzone.
  ["dragover", "drop"].forEach((type) => {
    window.addEventListener(type, (event) => {
      if (!dropzone.contains(event.target)) event.preventDefault();
    });
  });

  queueList.addEventListener("click", (event) => {
    const row = event.target.closest(".photo");
    if (!row) return;

    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "remove") {
      removePhoto(row.dataset.id);
      return;
    }
    if (action === "download") {
      downloadOne(row.dataset.id);
      return;
    }

    state.selectedId = row.dataset.id;
    $$(".photo", queueList).forEach((el) => el.classList.toggle("is-active", el.dataset.id === state.selectedId));
    schedulePreview();
  });

  addMoreBtn.addEventListener("click", () => fileInput.click());
  removeAllBtn.addEventListener("click", clearAll);
  clearBtn.addEventListener("click", clearAll);

  preset.addEventListener("change", () => {
    applyPreset(preset.value);
    if (preset.value === "custom") sizeA.focus();
  });

  [mode, sizeA, sizeB].forEach((el) => {
    el.addEventListener("change", () => {
      if (el === mode) syncModeUi();
      if (preset.value !== "custom") preset.value = "custom";
      markBatchStale();
    });
  });

  noUpscale.addEventListener("change", markBatchStale);

  [wmText, wmStyle].forEach((el) => el.addEventListener("input", markBatchStale));
  wmTile.addEventListener("change", markBatchStale);

  wmSize.addEventListener("input", () => {
    wmSizeOut.textContent = `${Number(wmSize.value).toFixed(1).replace(/\.0$/, "")}%`;
    schedulePreview();
    markBatchStale();
  });

  wmOpacity.addEventListener("input", () => {
    wmOpacityOut.textContent = `${wmOpacity.value}%`;
    schedulePreview();
    markBatchStale();
  });

  wmColor.addEventListener("input", () => syncColor(wmColor.value));
  wmColorText.addEventListener("change", () => syncColor(wmColorText.value.trim()));
  wmColorText.addEventListener("input", () => {
    if (/^#[0-9a-f]{6}$/i.test(wmColorText.value.trim())) syncColor(wmColorText.value.trim());
  });

  $$(".posgrid__cell", posGrid).forEach((cell) => {
    cell.addEventListener("click", () => setPosition(cell.dataset.pos));
  });

  format.addEventListener("change", () => {
    qualityField.classList.toggle("is-hidden", format.value === "png");
    markBatchStale();
  });

  quality.addEventListener("input", () => {
    qualityOut.textContent = `${quality.value}%`;
    schedulePreview();
    markBatchStale();
  });

  processBtn.addEventListener("click", (event) => {
    event.preventDefault();
    processBatch();
  });

  downloadBtn.addEventListener("click", (event) => {
    event.preventDefault();
    downloadZip();
  });

  // The form should never navigate.
  $("#controls").addEventListener("submit", (event) => event.preventDefault());

  /* ---------------- Init ---------------- */
  syncModeUi();
  setPosition("se");
  syncColor("#ffffff");
  qualityField.classList.toggle("is-hidden", format.value === "png");
  updateActions();
})();
