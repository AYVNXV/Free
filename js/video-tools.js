(function () {
  const $ = (id) => document.getElementById(id);

  const engineBox = $("engineBox");
  const enableBtn = $("enableBtn");
  const progWrap = $("progWrap");
  const progBar = $("progBar");
  const statusText = $("statusText");

  const converterUI = $("converterUI");
  const drop = $("drop");
  const pickBtn = $("pickBtn");
  const fileInput = $("fileInput");
  const fileList = $("fileList");
  const outFormat = $("outFormat");
  const convertBtn = $("convertBtn");
  const convProgWrap = $("convProgWrap");
  const convProgBar = $("convProgBar");
  const convStatus = $("convStatus");
  const result = $("result");

  // CDN list: pehla fail ho to doosra try hoga
  const CDNS = [
    {
      ffmpeg: "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd",
      core: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd",
    },
    {
      ffmpeg: "https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/umd",
      core: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd",
    },
  ];

  const WASM_APPROX_SIZE = 32 * 1024 * 1024; // progress ke liye andaza

  let ffmpeg = null;
  let selectedFile = null;
  let lastUrl = null;

  // ---------- Helpers ----------
  async function fetchBlobURL(url, mime, onProgress) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Download failed: " + url);

    const total = Number(res.headers.get("Content-Length")) || WASM_APPROX_SIZE;
    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (onProgress) onProgress(Math.min(received / total, 1));
    }
    return URL.createObjectURL(new Blob(chunks, { type: mime }));
  }

  function setEngineProgress(p, text) {
    progWrap.style.display = "block";
    progBar.style.width = Math.round(p * 100) + "%";
    if (text) statusText.textContent = text;
  }

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  }

  // ---------- Engine load ----------
  async function loadFromCDN(cdn) {
    const { FFmpeg } = FFmpegWASM;

    const instance = new FFmpeg();

    setEngineProgress(0.02, "Downloading engine files...");
    const classWorkerURL = await fetchBlobURL(
      cdn.ffmpeg + "/814.ffmpeg.js",
      "text/javascript"
    );
    const coreURL = await fetchBlobURL(
      cdn.core + "/ffmpeg-core.js",
      "text/javascript"
    );
    const wasmURL = await fetchBlobURL(
      cdn.core + "/ffmpeg-core.wasm",
      "application/wasm",
      (p) => setEngineProgress(0.05 + p * 0.9, "Downloading engine... " + Math.round(p * 100) + "%")
    );

    setEngineProgress(0.97, "Starting engine...");
    await instance.load({ classWorkerURL, coreURL, wasmURL });
    return instance;
  }

  async function enableEngine() {
    enableBtn.disabled = true;
    enableBtn.textContent = "Loading...";
    statusText.textContent = "";

    let lastError = null;
    for (const cdn of CDNS) {
      try {
        ffmpeg = await loadFromCDN(cdn);
        lastError = null;
        break;
      } catch (err) {
        console.error("CDN failed:", cdn, err);
        lastError = err;
        statusText.textContent = "CDN failed, trying another...";
      }
    }

    if (lastError || !ffmpeg) {
      enableBtn.disabled = false;
      enableBtn.textContent = "Retry";
      statusText.textContent = "Could not load engine. Check your internet and try again.";
      return;
    }

    ffmpeg.on("progress", ({ progress }) => {
      const p = Math.max(0, Math.min(progress || 0, 1));
      convProgBar.style.width = Math.round(p * 100) + "%";
      convStatus.textContent = "Converting... " + Math.round(p * 100) + "%";
    });

    setEngineProgress(1, "Engine ready!");
    setTimeout(() => {
      engineBox.classList.add("hidden");
      converterUI.classList.remove("hidden");
    }, 400);
  }

  // ---------- File select ----------
  function setFile(file) {
    if (!file) return;
    selectedFile = file;
    fileList.style.display = "block";
    fileList.textContent = file.name + " (" + formatSize(file.size) + ")";
    convertBtn.disabled = false;
    result.innerHTML = "";
    convStatus.textContent = "";
    convProgWrap.style.display = "none";
  }

  pickBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => setFile(e.target.files[0]));

  ["dragenter", "dragover"].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add("drag");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.remove("drag");
    })
  );
  drop.addEventListener("drop", (e) => setFile(e.dataTransfer.files[0]));

  // ---------- Convert ----------
  function buildArgs(input, format, output) {
    switch (format) {
      case "mp4":
        return ["-i", input, "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
                "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
                "-movflags", "+faststart", output];
      case "webm":
        return ["-i", input, "-c:v", "libvpx", "-b:v", "1M", "-deadline", "realtime",
                "-cpu-used", "5", "-c:a", "libvorbis", output];
      case "gif":
        return ["-i", input, "-t", "15",
                "-vf", "fps=10,scale=480:-1:flags=lanczos", "-loop", "0", output];
      case "mp3":
        return ["-i", input, "-vn", "-c:a", "libmp3lame", "-q:a", "2", output];
      case "wav":
        return ["-i", input, "-vn", "-c:a", "pcm_s16le", output];
    }
  }

  const MIME = {
    mp4: "video/mp4",
    webm: "video/webm",
    gif: "image/gif",
    mp3: "audio/mpeg",
    wav: "audio/wav",
  };

  async function convert() {
    if (!ffmpeg || !selectedFile) return;

    const format = outFormat.value;
    const ext = (selectedFile.name.split(".").pop() || "mp4").replace(/[^a-z0-9]/gi, "");
    const inputName = "input." + ext;
    const outputName = "output." + format;

    convertBtn.disabled = true;
    result.innerHTML = "";
    convProgWrap.style.display = "block";
    convProgBar.style.width = "0%";
    convStatus.textContent = "Reading file...";

    try {
      await ffmpeg.writeFile(inputName, await FFmpegUtil.fetchFile(selectedFile));
      convStatus.textContent = "Converting... 0%";

      const code = await ffmpeg.exec(buildArgs(inputName, format, outputName));
      if (code !== 0) throw new Error("ffmpeg exited with code " + code);

      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data.buffer], { type: MIME[format] });

      if (lastUrl) URL.revokeObjectURL(lastUrl);
      lastUrl = URL.createObjectURL(blob);

      const baseName = selectedFile.name.replace(/\.[^.]+$/, "");
      const downloadName = baseName + "." + format;

      convProgBar.style.width = "100%";
      convStatus.textContent = "Done! (" + formatSize(blob.size) + ")";

      let preview = "";
      if (format === "mp4" || format === "webm") {
        preview = '<video src="' + lastUrl + '" controls style="max-width:100%;border-radius:10px;margin-bottom:12px;"></video><br>';
      } else if (format === "gif") {
        preview = '<img src="' + lastUrl + '" style="max-width:100%;border-radius:10px;margin-bottom:12px;"><br>';
      } else {
        preview = '<audio src="' + lastUrl + '" controls style="margin-bottom:12px;"></audio><br>';
      }

      result.innerHTML =
        preview +
        '<a class="convert-btn" style="display:inline-block;text-decoration:none;max-width:320px;" href="' +
        lastUrl + '" download="' + downloadName + '">Download ' + downloadName + "</a>";

      // memory free karna
      await ffmpeg.deleteFile(inputName).catch(() => {});
      await ffmpeg.deleteFile(outputName).catch(() => {});
    } catch (err) {
      console.error(err);
      convStatus.textContent = "Conversion failed. Try a smaller file or a different format.";
    } finally {
      convertBtn.disabled = false;
    }
  }

  convertBtn.addEventListener("click", convert);
  enableBtn.addEventListener("click", enableEngine);
})();