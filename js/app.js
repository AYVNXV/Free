/* WebToolVault – shared converter engine (simple English comments) */

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------- Converter categories ---------- */
const CATS = [
  {
    id: "image",
    t: "Image Converters",
    short: "Image",
    g: [
      ["Standard Image Formats", ["png>jpg", "jpg>png", "png>webp", "jpg>webp", "webp>jpg", "webp>png", "bmp>jpg|png|webp", "gif>png|jpg", "tiff>png|jpg", "heic>jpg|png"]],
      ["Vector & Icon", ["svg>png|jpg|ico", "png>svg", "png>ico", "jpg>ico", "ico>png", "eps>svg|png", "ai>svg|png"]]
    ]
  },
    {
    id: "audio",
    t: "Audio Converters",
    short: "Audio",
    g: [
      ["Popular", ["mp4>mp3", "wav>mp3", "mp3>wav", "ogg>mp3|wav", "aac>mp3", "m4a>mp3", "flac>mp3|wav", "webm>mp3|wav", "wma>mp3", "amr>mp3"]],
      ["More formats", ["mp3>ogg|opus|flac|m4a|aac|aiff|wma|ac3", "wav>ogg|opus|flac|m4a|aac|aiff|wma", "flac>ogg|opus|m4a|aac|aiff", "m4a>wav|ogg|opus|flac", "ogg>flac|m4a|opus", "opus>mp3|wav|ogg", "aiff>mp3|wav|flac", "mp4>wav|ogg|m4a|flac", "mov>mp3|wav", "mkv>mp3|wav|m4a"]]
    ]
  },
  {
    id: "documents",
    t: "Document & PDF Converters",
    short: "Documents",
    g: [["", ["jpg>pdf", "png>pdf", "pdf>jpg|png", "html>pdf", "txt>pdf", "md>pdf|html", "docx>html|txt|pdf", "pdf>txt", "xlsx>csv|json", "csv>xlsx|json"]]]
  },
  {
    id: "developer",
    t: "Developer, Text & Data Converters",
    short: "Developer",
    g: [["", ["json>csv", "csv>json", "json>xml", "xml>json", "yaml>json", "json>yaml", "text>base64", "base64>text", "base64>image", "text>binary", "text>hex", "binary>text", "hex>text", "html>md", "md>html", "sql>json|csv"]]]
  }
];

const NAMES = {
  jpg: "JPG", md: "Markdown", text: "Text", base64: "Base64", binary: "Binary",
  hex: "Hex", docx: "Word (DOCX)", xlsx: "Excel (XLSX)", image: "Image", apng: "APNG"
};
const lab = (x) => NAMES[x] || x.toUpperCase();

const REG = {};
const SOON = new Set();

const ex = (s) => {
  const [a, b] = s.split(">");
  return b.split("|").map((t) => [a, t]);
};

CATS.forEach((c) => {
  c.g.forEach((g) => {
    g[1] = g[1].flatMap(ex).map(([f, t]) => {
      const id = f + "-to-" + t;
      REG[id] = [f, t];
      if (c.soon || ["tiff", "eps", "ai"].includes(f)) SOON.add(id);
      return id;
    });
  });
});

/* ---------- Helper libraries (load only when needed) ---------- */
const CD = "https://cdnjs.cloudflare.com/ajax/libs/";
const LIBS = {
  lame: [CD + "lamejs/1.2.1/lame.min.js", "lamejs"],
  yaml: [CD + "js-yaml/4.1.0/js-yaml.min.js", "jsyaml"],
  mammoth: [CD + "mammoth/1.6.0/mammoth.browser.min.js", "mammoth"],
  xlsx: [CD + "xlsx/0.18.5/xlsx.full.min.js", "XLSX"],
  heic: [CD + "heic2any/0.0.4/heic2any.min.js", "heic2any"],
  pdfjs: [CD + "pdf.js/3.11.174/pdf.min.js", "pdfjsLib"]
};
const got = {};
const lib = (k) =>
  got[k] ||
  (got[k] = new Promise((ok, no) => {
    if (window[LIBS[k][1]]) return ok();
    const s = document.createElement("script");
    s.src = LIBS[k][0];
    s.onload = ok;
    s.onerror = () => {
      delete got[k];
      no(Error("Could not load a helper file. Please check your internet and try again."));
    };
    document.head.appendChild(s);
  }));

/* ---------- Small helpers ---------- */
const out = (b, n) => ({ files: [{ blob: b, name: n }] });
const nm = (f, e) => f.name.replace(/\.[^.]+$/, "") + "." + e;
const bl = (c, m, q) => new Promise((r) => c.toBlob(r, m, q));
const MIME = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

async function cv(file, white, size) {
  const u = URL.createObjectURL(file);
  const i = new Image();
  i.src = u;
  try {
    await i.decode();
  } catch (e) {
    URL.revokeObjectURL(u);
    throw Error("This file could not be read as a picture.");
  }
  const w = i.naturalWidth || 800;
  const h = i.naturalHeight || 600;
  const c = document.createElement("canvas");
  const x = c.getContext("2d");
  if (size) {
    c.width = c.height = size;
    const s = Math.min(size / w, size / h);
    x.drawImage(i, (size - w * s) / 2, (size - h * s) / 2, w * s, h * s);
  } else {
    c.width = w;
    c.height = h;
    if (white) {
      x.fillStyle = "#fff";
      x.fillRect(0, 0, w, h);
    }
    x.drawImage(i, 0, 0, w, h);
  }
  URL.revokeObjectURL(u);
  return c;
}

async function dec(file) {
  const C = new (window.AudioContext || window.webkitAudioContext)();
  try {
    return await C.decodeAudioData(await file.arrayBuffer());
  } catch (e) {
    throw Error("Your browser cannot read this audio type. WMA and AMR are often not supported.");
  } finally {
    C.close();
  }
}

function wav(b) {
  const n = b.length;
  const ch = b.numberOfChannels;
  const v = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const s = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  s(0, "RIFF");
  v.setUint32(4, 36 + n * ch * 2, true);
  s(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, ch, true);
  v.setUint32(24, b.sampleRate, true);
  v.setUint32(28, b.sampleRate * ch * 2, true);
  v.setUint16(32, ch * 2, true);
  v.setUint16(34, 16, true);
  s(36, "data");
  v.setUint32(40, n * ch * 2, true);
  const d = [...Array(ch)].map((_, i) => b.getChannelData(i));
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const x = Math.max(-1, Math.min(1, d[c][i]));
      v.setInt16(o, x < 0 ? x * 32768 : x * 32767, true);
      o += 2;
    }
  }
  return new Blob([v], { type: "audio/wav" });
}

async function mp3(b) {
  await lib("lame");
  const ch = Math.min(2, b.numberOfChannels);
  const e = new lamejs.Mp3Encoder(ch, b.sampleRate, 128);
  const I = (a) => Int16Array.from(a, (v) => Math.max(-1, Math.min(1, v)) * 32767);
  const l = I(b.getChannelData(0));
  const r = ch > 1 ? I(b.getChannelData(1)) : null;
  const p = [];
  for (let i = 0; i < l.length; i += 1152) {
    const k = r ? e.encodeBuffer(l.subarray(i, i + 1152), r.subarray(i, i + 1152)) : e.encodeBuffer(l.subarray(i, i + 1152));
    if (k.length) p.push(k);
  }
  p.push(e.flush());
  return new Blob(p, { type: "audio/mpeg" });
}

function pdf(pages) {
  const parts = [];
  const offs = [];
  const enc = new TextEncoder();
  let len = 0;
  const push = (d) => {
    const b = typeof d === "string" ? enc.encode(d) : d;
    parts.push(b);
    len += b.length;
  };
  const obj = (n, body) => {
    offs[n] = len;
    push(n + " 0 obj\n" + body + "\nendobj\n");
  };
  push("%PDF-1.4\n");
  obj(1, "<</Type/Catalog/Pages 2 0 R>>");
  obj(2, `<</Type/Pages/Kids[${pages.map((_, i) => 3 + i * 3 + " 0 R").join(" ")}]/Count ${pages.length}>>`);
  pages.forEach((p, i) => {
    const b = 3 + i * 3;
    if (p.jpeg) {
      const W = 595,
        H = 842,
        s = Math.min((W - 40) / p.w, (H - 40) / p.h),
        w = p.w * s,
        h = p.h * s,
        c = `q ${w} 0 0 ${h} ${(W - w) / 2} ${(H - h) / 2} cm /I Do Q`;
      obj(b, `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${W} ${H}]/Contents ${b + 1} 0 R/Resources<</XObject<</I ${b + 2} 0 R>>>>>>`);
      obj(b + 1, `<</Length ${c.length}>>\nstream\n${c}\nendstream`);
      offs[b + 2] = len;
      push(`${b + 2} 0 obj\n<</Type/XObject/Subtype/Image/Width ${p.w}/Height ${p.h}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${p.jpeg.length}>>\nstream\n`);
      push(p.jpeg);
      push("\nendstream\nendobj\n");
    } else {
      obj(b, `<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents ${b + 1} 0 R/Resources<</Font<</F1 ${b + 2} 0 R>>>>>>`);
      const c =
        "BT /F1 11 Tf 14 TL 50 800 Td " +
        p.lines.map((l) => "(" + l.replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7e]/g, "?") + ") Tj T*").join(" ") +
        " ET";
      obj(b + 1, `<</Length ${c.length}>>\nstream\n${c}\nendstream`);
      obj(b + 2, "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>");
    }
  });
  const n = 3 + pages.length * 3;
  const x = len;
  push(
    `xref\n0 ${n}\n0000000000 65535 f \n` +
      offs
        .slice(1, n)
        .map((o) => String(o).padStart(10, "0") + " 00000 n \n")
        .join("") +
      `trailer\n<</Size ${n}/Root 1 0 R>>\nstartxref\n${x}\n%%EOF`
  );
  return new Blob(parts, { type: "application/pdf" });
}

const textPdf = (t) => {
  const L = t.split("\n").flatMap((l) => l.match(/.{1,95}/g) || [""]);
  const p = [];
  for (let i = 0; i < L.length; i += 52) p.push({ lines: L.slice(i, i + 52) });
  return out(pdf(p), "document.pdf");
};

const printIt = (h) => {
  const w = open("", "_blank");
  if (!w) throw Error("Please allow pop-ups, then try again.");
  w.document.write(h);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
  return { note: "A print window opened. Choose “Save as PDF” as the printer." };
};

const parseCSV = (s) => {
  const r = [];
  let row = [],
    c = "",
    q = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch == '"') {
        if (s[i + 1] == '"') {
          c += '"';
          i++;
        } else q = 0;
      } else c += ch;
    } else if (ch == '"') q = 1;
    else if (ch == ",") {
      row.push(c);
      c = "";
    } else if (ch == "\n" || ch == "\r") {
      if (ch == "\r" && s[i + 1] == "\n") i++;
      row.push(c);
      r.push(row);
      row = [];
      c = "";
    } else c += ch;
  }
  if (c || row.length) {
    row.push(c);
    r.push(row);
  }
  return r.filter((r) => r.some((v) => v !== ""));
};

const toCSV = (d) => {
  if (!Array.isArray(d)) d = [d];
  const k = [...new Set(d.flatMap((o) => Object.keys(o)))];
  const q = (v) => {
    v = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };
  return [k.join(",")].concat(d.map((o) => k.map((x) => q(o[x])).join(","))).join("\n");
};

const toXML = (o, n) =>
  Array.isArray(o)
    ? o.map((v) => toXML(v, n)).join("")
    : o && typeof o === "object"
      ? `<${n}>` + Object.entries(o).map(([k, v]) => toXML(v, k)).join("") + `</${n}>`
      : `<${n}>${esc(o ?? "")}</${n}>`;

const fromXML = (n) => {
  const e = [...n.children];
  if (!e.length) return n.textContent;
  const o = {};
  e.forEach((c) => {
    const v = fromXML(c);
    o[c.tagName] = c.tagName in o ? [].concat(o[c.tagName], [v]) : v;
  });
  return o;
};

const sqlRows = (s) => {
  const rows = [];
  const re = /insert\s+into\s+[`"\[\]\w.]+\s*\(([^)]+)\)\s*values\s*([\s\S]*?);/gi;
  let m;
  while ((m = re.exec(s))) {
    const cols = m[1].split(",").map((c) => c.replace(/[`"\[\]\s]/g, ""));
    const v = m[2];
    let i = 0;
    while (i < v.length) {
      if (v[i] == "(") {
        let j = i + 1,
          cur = "",
          vals = [],
          q = "";
        for (; j < v.length; j++) {
          const ch = v[j];
          if (q) {
            if (ch == q) {
              if (v[j + 1] == q) {
                cur += q;
                j++;
              } else q = "";
            } else cur += ch;
          } else if (ch == "'" || ch == '"') q = ch;
          else if (ch == ",") {
            vals.push(cur.trim());
            cur = "";
          } else if (ch == ")") {
            vals.push(cur.trim());
            break;
          } else cur += ch;
        }
        rows.push(Object.fromEntries(cols.map((c, k) => [c, vals[k] === "NULL" ? null : vals[k]])));
        i = j;
      }
      i++;
    }
  }
  if (!rows.length) throw Error("No INSERT INTO … VALUES … statements were found.");
  return rows;
};

const md2html = (s) =>
  esc(s)
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.+?)\*/g, "<i>$1</i>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/^[-*] (.*)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => "<ul>" + m + "</ul>")
    .split(/\n{2,}/)
    .map((p) => (/^\s*<(h\d|ul)/.test(p) ? p : "<p>" + p.trim() + "</p>"))
    .join("\n");

const html2md = (s) => {
  const w = (n) =>
    n.nodeType == 3
      ? n.textContent
      : n.nodeType != 1
        ? ""
        : ((c) =>
            ({
              H1: "# " + c + "\n\n",
              H2: "## " + c + "\n\n",
              H3: "### " + c + "\n\n",
              P: c + "\n\n",
              B: "**" + c + "**",
              STRONG: "**" + c + "**",
              I: "*" + c + "*",
              EM: "*" + c + "*",
              CODE: "`" + c + "`",
              LI: "- " + c + "\n",
              UL: c + "\n",
              BR: "\n",
              A: "[" + c + "](" + n.getAttribute("href") + ")"
            }[n.tagName] ?? c))([...n.childNodes].map(w).join(""));
  return w(new DOMParser().parseFromString(s, "text/html").body).trim();
};

const bytes = (s) => [...new TextEncoder().encode(s)];

/* ---------- Main converter function ---------- */
async function run(f, t, { text: T = "", files: F = [] }) {
  const file = F[0];
  const K = f + ">" + t;
  if (SOON.has(f + "-to-" + t)) throw Error("This converter is coming soon. It needs a big add-on that is not included yet.");

  if (f === "heic") {
    await lib("heic");
    const b = await heic2any({ blob: file, toType: MIME[t] });
    return out(Array.isArray(b) ? b[0] : b, nm(file, t));
  }

  if (["png", "jpg", "webp", "bmp", "gif", "svg", "ico"].includes(f)) {
    if (MIME[t]) return out(await bl(await cv(file, t === "jpg"), MIME[t], 0.92), nm(file, t));
    if (t === "ico") {
      const d = new Uint8Array(await (await bl(await cv(file, false, 256), "image/png")).arrayBuffer());
      const h = new DataView(new ArrayBuffer(22));
      h.setUint16(2, 1, true);
      h.setUint16(4, 1, true);
      h.setUint16(10, 1, true);
      h.setUint16(12, 32, true);
      h.setUint32(14, d.length, true);
      h.setUint32(18, 22, true);
      return out(new Blob([h.buffer, d], { type: "image/x-icon" }), nm(file, "ico"));
    }
    if (K === "png>svg") {
      const c = await cv(file, false);
      return out(
        new Blob(
          [`<svg xmlns="http://www.w3.org/2000/svg" width="${c.width}" height="${c.height}"><image href="${c.toDataURL("image/png")}" width="${c.width}" height="${c.height}"/></svg>`],
          { type: "image/svg+xml" }
        ),
        nm(file, "svg")
      );
    }
    if (t === "pdf") {
      const p = [];
      for (const x of F) {
        const c = await cv(x, true);
        p.push({ jpeg: new Uint8Array(await (await bl(c, "image/jpeg", 0.92)).arrayBuffer()), w: c.width, h: c.height });
      }
      return out(pdf(p), "images.pdf");
    }
  }

  if (AU_IN.includes(f) && AU_FORMATS[t]) {
    const r = await audioConvert(file, t, {});
    return out(r.blob, nm(file, r.ext));
  }

  if (f === "pdf") {
    await lib("pdfjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
      new Blob([`importScripts("${CD}pdf.js/3.11.174/pdf.worker.min.js")`])
    );
    const d = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    if (t === "txt") {
      let s = "";
      for (let i = 1; i <= d.numPages; i++) s += (await (await d.getPage(i)).getTextContent()).items.map((x) => x.str).join(" ") + "\n\n";
      return { text: s.trim() || "No text found. This PDF may be a scanned picture." };
    }
    const r = [];
    for (let i = 1; i <= d.numPages; i++) {
      const p = await d.getPage(i);
      const v = p.getViewport({ scale: 2 });
      const c = document.createElement("canvas");
      c.width = v.width;
      c.height = v.height;
      const x = c.getContext("2d");
      x.fillStyle = "#fff";
      x.fillRect(0, 0, c.width, c.height);
      await p.render({ canvasContext: x, viewport: v }).promise;
      r.push({ blob: await bl(c, MIME[t], 0.92), name: nm(file, "") + "page-" + i + "." + t });
    }
    return { files: r };
  }

  if (f === "docx") {
    await lib("mammoth");
    const b = await file.arrayBuffer();
    if (t === "txt") return { text: (await mammoth.extractRawText({ arrayBuffer: b })).value };
    const h = (await mammoth.convertToHtml({ arrayBuffer: b })).value;
    return t === "html" ? { text: h } : printIt("<!doctype html><meta charset=utf-8>" + h);
  }

  if (f === "xlsx") {
    await lib("xlsx");
    const w = XLSX.read(await file.arrayBuffer());
    const s = w.Sheets[w.SheetNames[0]];
    return { text: t === "csv" ? XLSX.utils.sheet_to_csv(s) : JSON.stringify(XLSX.utils.sheet_to_json(s), null, 2) };
  }

  if (K === "csv>xlsx") {
    await lib("xlsx");
    return out(new Blob([XLSX.write(XLSX.read(T, { type: "string" }), { bookType: "xlsx", type: "array" })]), "data.xlsx");
  }

  if (K === "txt>pdf") return textPdf(T);
  if (K === "md>pdf") return textPdf(T.replace(/[#*`]/g, ""));
  if (K === "html>pdf") return printIt(T);

  const J = () => {
    try {
      return JSON.parse(T);
    } catch (e) {
      throw Error("That does not look like valid JSON.");
    }
  };

  switch (K) {
    case "json>csv":
      return { text: toCSV(J()) };
    case "csv>json": {
      const r = parseCSV(T);
      const h = r[0] || [];
      return { text: JSON.stringify(r.slice(1).map((x) => Object.fromEntries(h.map((k, i) => [k, x[i] ?? ""]))), null, 2) };
    }
    case "json>xml":
      return { text: '<?xml version="1.0"?>\n' + toXML(J(), "root") };
    case "xml>json": {
      const d = new DOMParser().parseFromString(T, "text/xml");
      if (d.querySelector("parsererror")) throw Error("That does not look like valid XML.");
      return { text: JSON.stringify({ [d.documentElement.tagName]: fromXML(d.documentElement) }, null, 2) };
    }
    case "yaml>json":
      await lib("yaml");
      return { text: JSON.stringify(jsyaml.load(T), null, 2) };
    case "json>yaml":
      await lib("yaml");
      return { text: jsyaml.dump(J()) };
    case "text>base64":
      return { text: btoa(String.fromCharCode(...bytes(T))) };
    case "base64>text": {
      try {
        return { text: new TextDecoder().decode(Uint8Array.from(atob(T.replace(/^data:.*?,/, "").trim()), (c) => c.charCodeAt(0))) };
      } catch (e) {
        throw Error("That is not valid Base64.");
      }
    }
    case "base64>image": {
      const u = T.trim().startsWith("data:") ? T.trim() : "data:image/png;base64," + T.trim();
      try {
        return out(await (await fetch(u)).blob(), "image.png");
      } catch (e) {
        throw Error("That is not a valid Base64 picture.");
      }
    }
    case "text>binary":
      return { text: bytes(T).map((b) => b.toString(2).padStart(8, "0")).join(" ") };
    case "text>hex":
      return { text: bytes(T).map((b) => b.toString(16).padStart(2, "0")).join(" ") };
    case "binary>text":
      return { text: new TextDecoder().decode(Uint8Array.from(T.trim().split(/\s+/).map((b) => parseInt(b, 2)))) };
    case "hex>text":
      return { text: new TextDecoder().decode(Uint8Array.from(T.trim().split(/[\s,]+/).map((b) => parseInt(b.replace(/^0x/i, ""), 16)))) };
    case "html>md":
      return { text: html2md(T) };
    case "md>html":
      return { text: md2html(T) };
    case "sql>json":
      return { text: JSON.stringify(sqlRows(T), null, 2) };
    case "sql>csv":
      return { text: toCSV(sqlRows(T)) };
  }
  throw Error("This converter is not available yet.");
}

/* ---------- Download helper ---------- */
function dl(b, n) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = n;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- Build category card grid (used on home + category pages) ---------- */
function buildGrid(cat, container) {
  let html = "";
  cat.g.forEach((g) => {
    if (g[0]) html += `<h3>${g[0]}</h3>`;
    html += `<div class="grid">`;
    g[1].forEach((id) => {
      const [f, t] = REG[id];
      const n = lab(f) + " to " + lab(t);
      const soonTag = SOON.has(id) ? '<span class="soon">Coming soon</span>' : "";
      html += `<a class="card" href="converter.html?id=${id}" data-s="${esc((n + " " + f + " " + t).toLowerCase())}">
        <b>${n}${soonTag}</b>
        <small>.${f} → .${t}</small>
      </a>`;
    });
    html += `</div>`;
  });
  container.innerHTML = html;
}

/* ---------- Search filter (home page) ---------- */
function setupSearch() {
  const q = $("#q");
  if (!q) return;
  q.addEventListener("input", (e) => {
    const v = e.target.value.trim().toLowerCase();
    let n = 0;
    document.querySelectorAll("a.card").forEach((c) => {
      const ok = !v || (c.dataset.s || "").includes(v);
      c.style.display = ok ? "" : "none";
      n += ok;
    });
    document.querySelectorAll(".section").forEach((s) => {
      s.style.display = [...s.querySelectorAll("a.card")].some((c) => c.style.display !== "none") ? "" : "none";
    });
    const empty = $("#empty");
    if (empty) empty.style.display = n ? "none" : "block";
  });
}

/* ---------- Converter page UI ---------- */
const TXT = new Set(["html", "md", "txt", "csv", "json", "xml", "yaml", "sql", "text", "base64", "binary", "hex"]);

function initConverterPage() {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  if (!id || !REG[id]) {
    $("#page").innerHTML = `<div class="msg err">Converter not found. <a href="index.html">Go back home</a></div>`;
    return;
  }

  const [f, t] = REG[id];
  const title = lab(f) + " to " + lab(t);
  const isText = TXT.has(f);
  const multi = (f === "jpg" || f === "png") && t === "pdf";
  const soon = SOON.has(id);

  document.title = title + " – WebToolVault";

  const acc = {
    jpg: ".jpg,.jpeg",
    tiff: ".tiff,.tif",
    heic: ".heic,.heif",
    md: ".md,.markdown",
    yaml: ".yaml,.yml",
    text: ".txt",
    base64: ".txt",
    binary: ".txt",
    hex: ".txt"
  }[f] || "." + f;

  const ext = ["base64", "binary", "hex", "text"].includes(t) ? "txt" : t;

  let html = `
    <a class="back" href="index.html">← All converters</a>
    <h1 style="margin-top:4px">${title}</h1>
    <p class="sub" style="margin-left:0;text-align:left">Free and private. Your ${isText ? "text" : "file"} is never uploaded anywhere.</p>
  `;

  if (soon) {
    html += `<div class="msg warn">This converter is coming soon. Video, TIFF and EPS/AI files need a large add-on that is not included in this version.</div>`;
  } else {
    html += `<div class="box">`;
    if (isText) {
      html += `
        <label class="l" for="in">Your ${lab(f)}</label>
        <textarea id="in" placeholder="Type or paste here…"></textarea>
        <div class="row">
          <label class="btn alt" for="f">Open a file</label>
          <input id="f" type="file" accept="${acc},.txt" hidden>
          <button id="go">Convert</button>
        </div>
      `;
    } else {
      html += `
        <label class="drop" id="drop" for="f">
          <b>Click to choose ${multi ? "files" : "a file"}</b> or drop ${multi ? "them" : "it"} here
          <small>${lab(f)} file${multi ? "s" : ""}</small>
        </label>
        <input id="f" type="file" accept="${acc}" ${multi ? "multiple" : ""} hidden>
        <div id="names" class="msg" style="display:none"></div>
        ${multi ? '<div class="row"><button id="go">Convert</button></div>' : ""}
      `;
    }
    html += `<div id="res"></div></div>`;
  }

  $("#page").innerHTML = html;
  if (soon) return;

  let files = [];
  const res = $("#res");
  const say = (m, c = "") => (res.innerHTML = `<div class="msg ${c}">${esc(m)}</div>`);

  async function go() {
    say("Working on it…");
    try {
      const r = await run(f, t, { text: isText ? $("#in").value : "", files });
      if (r.note) return say(r.note);
      if (r.text !== undefined) {
        res.innerHTML = `
          <label class="l" style="margin-top:14px">Result</label>
          <textarea id="o" readonly></textarea>
          <div class="row">
            <button id="cp" class="alt">Copy</button>
            <button id="sv">Download .${ext}</button>
          </div>
        `;
        $("#o").value = r.text;
        $("#cp").onclick = () => navigator.clipboard.writeText(r.text).then(() => ($("#cp").textContent = "Copied!"));
        $("#sv").onclick = () => dl(new Blob([r.text]), "converted." + ext);
      } else {
        res.innerHTML =
          `<div class="msg">Done! Your file is ready.</div><div class="row">` +
          r.files.map((x, i) => `<button data-i="${i}">Download ${esc(x.name)}</button>`).join("") +
          `</div>`;
        if (r.files.length == 1 && /^image\/(png|jpeg|webp|svg)/.test(r.files[0].blob.type)) {
          const im = new Image();
          im.className = "pv";
          im.src = URL.createObjectURL(r.files[0].blob);
          res.appendChild(im);
        }
        res.onclick = (e) => {
          const b = e.target.closest("[data-i]");
          if (b) dl(r.files[b.dataset.i].blob, r.files[b.dataset.i].name);
        };
      }
    } catch (e) {
      say(e.message || "Something went wrong.", "err");
    }
  }

  const pick = (fl) => {
    files = [...fl];
    if (!files.length) return;
    if (isText) {
      files[0].text().then((s) => ($("#in").value = s));
    } else {
      const n = $("#names");
      n.style.display = "block";
      n.textContent = "Selected: " + files.map((x) => x.name).join(", ");
      if (!multi) go();
    }
  };

  $("#f").onchange = (e) => pick(e.target.files);
  if ($("#go")) $("#go").onclick = () => {
    if (!isText && !files.length) return say("Please choose a file first.", "err");
    go();
  };

  const d = $("#drop");
  if (d) {
    ["dragover", "dragenter"].forEach((n) =>
      d.addEventListener(n, (e) => {
        e.preventDefault();
        d.classList.add("over");
      })
    );
    ["dragleave", "drop"].forEach((n) =>
      d.addEventListener(n, (e) => {
        e.preventDefault();
        d.classList.remove("over");
      })
    );
    d.addEventListener("drop", (e) => pick(e.dataTransfer.files));
  }
}

/* ---------- Home page builder ---------- */
function buildHome() {
  const list = $("#list");
  if (!list) return;

  list.innerHTML = CATS.map((c, i) => {
    let section = `<section class="section" id="c${i}">
      <h2><a href="${c.id}.html" style="color:inherit;text-decoration:none">${i + 1}. ${c.t}</a></h2>`;
    c.g.forEach((g) => {
      if (g[0]) section += `<h3>${g[0]}</h3>`;
      section += `<div class="grid">`;
      g[1].forEach((id) => {
        const [f, t] = REG[id];
        const n = lab(f) + " to " + lab(t);
        const soonTag = SOON.has(id) ? '<span class="soon">Coming soon</span>' : "";
        section += `<a class="card" href="converter.html?id=${id}" data-s="${esc((n + " " + f + " " + t).toLowerCase())}">
          <b>${n}${soonTag}</b>
          <small>.${f} → .${t}</small>
        </a>`;
      });
      section += `</div>`;
    });
    section += `</section>`;
    return section;
  }).join("");

  // Category nav – links to separate pages
  const nav = $("#nav");
  if (nav) {
    nav.innerHTML = CATS.map(
      (c) => `<a href="${c.id}.html">${c.short}</a>`
    ).join("");
  }

  setupSearch();
}

/* ---------- Category page builder ---------- */
function buildCategoryPage(catId) {
  const cat = CATS.find((c) => c.id === catId);
  if (!cat) return;

  document.title = cat.t + " – WebToolVault";
  const hero = $("#catHero");
  if (hero) {
    hero.innerHTML = `
      <a class="back" href="index.html">← All converters</a>
      <h1>${cat.t}</h1>
      <p class="sub">All tools on this page work in your browser. Nothing is uploaded.</p>
    `;
  }

  const list = $("#list");
  if (list) buildGrid(cat, list);
}
/* =====================================================================
   AUDIO CONVERTER ENGINE  (paste at the very end of app.js)
   - MP3, WAV, AIFF, AU: made inside the browser (works from a local file)
   - Other formats: ffmpeg engine from a public CDN (needs http/https)
   ===================================================================== */
const MP3_SR = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000];

/* js:true  = can be made without the big engine
   mux      = ffmpeg container name, codec = ffmpeg codec arguments */
const AU_FORMATS = {
  mp3:  { label: "MP3", ext: "mp3", mime: "audio/mpeg", js: true, lossy: true, mux: "mp3", codec: ["-c:a", "libmp3lame"], sr: MP3_SR, srDef: 44100,
          desc: "Works almost everywhere. Best choice for sharing and music players." },
  wav:  { label: "WAV (16-bit)", ext: "wav", mime: "audio/wav", js: true, lossy: false, mux: "wav", codec: ["-c:a", "pcm_s16le"],
          desc: "Uncompressed, perfect quality. Files are large." },
  aiff: { label: "AIFF", ext: "aiff", mime: "audio/aiff", js: true, lossy: false, mux: "aiff", codec: ["-c:a", "pcm_s16be"],
          desc: "Uncompressed audio used on Mac and in music software." },
  au:   { label: "AU", ext: "au", mime: "audio/basic", js: true, lossy: false, mux: "au", codec: ["-c:a", "pcm_s16be"],
          desc: "Simple uncompressed format from Sun/Unix systems." },
  ogg:  { label: "OGG (Vorbis)", ext: "ogg", mime: "audio/ogg", js: false, lossy: true, mux: "ogg", codec: ["-c:a", "libvorbis"],
          desc: "Open format with good quality at a small size." },
  opus: { label: "OPUS", ext: "opus", mime: "audio/ogg", js: false, lossy: true, mux: "opus", codec: ["-c:a", "libopus"], sr: [8000, 12000, 16000, 24000, 48000], srDef: 48000,
          desc: "Modern format. Very good quality even at low bitrate. Great for voice." },
  flac: { label: "FLAC (lossless)", ext: "flac", mime: "audio/flac", js: false, lossy: false, mux: "flac", codec: ["-c:a", "flac"],
          desc: "Lossless and smaller than WAV. Great for keeping music quality." },
  m4a:  { label: "M4A (AAC)", ext: "m4a", mime: "audio/mp4", js: false, lossy: true, mux: "ipod", codec: ["-c:a", "aac"],
          desc: "Good for iPhone and Apple devices. High quality at a small size." },
  aac:  { label: "AAC", ext: "aac", mime: "audio/aac", js: false, lossy: true, mux: "adts", codec: ["-c:a", "aac"],
          desc: "Raw AAC audio stream." },
  alac: { label: "ALAC (lossless M4A)", ext: "m4a", mime: "audio/mp4", js: false, lossy: false, mux: "ipod", codec: ["-c:a", "alac"],
          desc: "Apple Lossless. Perfect quality in an M4A file." },
  wma:  { label: "WMA", ext: "wma", mime: "audio/x-ms-wma", js: false, lossy: true, mux: "asf", codec: ["-c:a", "wmav2"],
          desc: "Windows Media Audio. For old Windows players." },
  ac3:  { label: "AC3 (Dolby Digital)", ext: "ac3", mime: "audio/ac3", js: false, lossy: true, mux: "ac3", codec: ["-c:a", "ac3"], sr: [32000, 44100, 48000], srDef: 48000,
          desc: "Dolby Digital audio used for TV and DVD." },
  mp2:  { label: "MP2", ext: "mp2", mime: "audio/mpeg", js: false, lossy: true, mux: "mp2", codec: ["-c:a", "mp2"], sr: [16000, 22050, 24000, 32000, 44100, 48000], srDef: 44100,
          desc: "Older MPEG audio used in radio and TV." },
  caf:  { label: "CAF", ext: "caf", mime: "audio/x-caf", js: false, lossy: false, mux: "caf", codec: ["-c:a", "pcm_s16le"],
          desc: "Apple Core Audio Format." },
  w64:  { label: "W64 (Wave64)", ext: "w64", mime: "audio/x-wav", js: false, lossy: false, mux: "w64", codec: ["-c:a", "pcm_s16le"],
          desc: "Like WAV, but supports files bigger than 4 GB." },
  weba: { label: "WEBA (WebM audio)", ext: "weba", mime: "audio/webm", js: false, lossy: true, mux: "webm", codec: ["-c:a", "libopus"], sr: [8000, 12000, 16000, 24000, 48000], srDef: 48000,
          desc: "Audio-only WebM file. Good for websites." }
};

/* File types accepted as input (audio and video) */
const AU_IN = ["mp3", "wav", "ogg", "oga", "opus", "flac", "m4a", "m4b", "aac", "wma", "aiff", "aif", "aifc", "amr", "ac3", "eac3", "mp2", "au", "snd", "caf", "w64", "wv", "ape", "mka", "weba",
  "mp4", "m4v", "webm", "mkv", "mov", "avi", "flv", "wmv", "3gp", "3g2", "mpg", "mpeg", "ts", "mts", "m2ts", "ogv", "vob", "asf"];

const auExt = (n) => {
  const i = n.lastIndexOf(".");
  return (i > 0 ? n.slice(i + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "") || "bin";
};
const auBase = (n) => {
  const i = n.lastIndexOf(".");
  return i > 0 ? n.slice(0, i) : n;
};
const auSize = (n) => (n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(1) + " MB");

/* ---------- Browser-only path (no engine needed) ---------- */
async function auDecode(file) {
  const ab = await file.arrayBuffer();
  const C = new (window.AudioContext || window.webkitAudioContext)();
  try {
    return await C.decodeAudioData(ab);
  } finally {
    try { C.close(); } catch (e) {}
  }
}

/* Change sample rate and/or channels (max 2 channels) */
async function auPrep(buf, sr, ch) {
  const outCh = Math.min(2, ch || buf.numberOfChannels);
  if (sr === buf.sampleRate && outCh === buf.numberOfChannels) return buf;
  const O = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const off = new O(outCh, Math.max(1, Math.ceil(buf.duration * sr)), sr);
  const src = off.createBufferSource();
  src.buffer = buf;
  src.connect(off.destination);
  src.start();
  return off.startRendering();
}

function auPCM16(v, off, b, little) {
  const d = [...Array(b.numberOfChannels)].map((_, i) => b.getChannelData(i));
  for (let i = 0; i < b.length; i++) {
    for (let c = 0; c < d.length; c++) {
      const x = Math.max(-1, Math.min(1, d[c][i]));
      v.setInt16(off, x < 0 ? x * 32768 : x * 32767, little);
      off += 2;
    }
  }
}

function auAiff(b) {
  const n = b.length, ch = b.numberOfChannels, len = n * ch * 2;
  const v = new DataView(new ArrayBuffer(54 + len));
  const s = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  s(0, "FORM"); v.setUint32(4, 46 + len); s(8, "AIFF");
  s(12, "COMM"); v.setUint32(16, 18); v.setUint16(20, ch); v.setUint32(22, n); v.setUint16(26, 16);
  const e = Math.floor(Math.log2(b.sampleRate));          // 80-bit sample rate
  v.setUint16(28, 16383 + e);
  v.setUint32(30, Math.round(b.sampleRate * Math.pow(2, 31 - e)));
  v.setUint32(34, 0);
  s(38, "SSND"); v.setUint32(42, 8 + len); v.setUint32(46, 0); v.setUint32(50, 0);
  auPCM16(v, 54, b, false);
  return new Blob([v], { type: "audio/aiff" });
}

function auAu(b) {
  const ch = b.numberOfChannels, len = b.length * ch * 2;
  const v = new DataView(new ArrayBuffer(24 + len));
  v.setUint32(0, 0x2e736e64);   // ".snd"
  v.setUint32(4, 24);
  v.setUint32(8, len);
  v.setUint32(12, 3);           // 16-bit PCM
  v.setUint32(16, b.sampleRate);
  v.setUint32(20, ch);
  auPCM16(v, 24, b, false);
  return new Blob([v], { type: "audio/basic" });
}

async function auEncMp3(b, kbps, onPct) {
  await lib("lame");
  const ch = Math.min(2, b.numberOfChannels);
  if (b.sampleRate <= 12000) kbps = Math.min(kbps, 64);
  else if (b.sampleRate <= 24000) kbps = Math.min(kbps, 160);
  const enc = new lamejs.Mp3Encoder(ch, b.sampleRate, kbps);
  const toInt = (a) => {
    const o = new Int16Array(a.length);
    for (let i = 0; i < a.length; i++) {
      const x = Math.max(-1, Math.min(1, a[i]));
      o[i] = x < 0 ? x * 32768 : x * 32767;
    }
    return o;
  };
  const L = toInt(b.getChannelData(0));
  const R = ch > 1 ? toInt(b.getChannelData(1)) : null;
  const parts = [];
  const step = 1152;
  for (let i = 0, k = 0; i < L.length; i += step, k++) {
    const d = R ? enc.encodeBuffer(L.subarray(i, i + step), R.subarray(i, i + step)) : enc.encodeBuffer(L.subarray(i, i + step));
    if (d.length) parts.push(d);
    if (k % 300 === 0) {                       // let the page breathe
      if (onPct) onPct(Math.round((i / L.length) * 100));
      await new Promise((r) => setTimeout(r));
    }
  }
  const end = enc.flush();
  if (end.length) parts.push(end);
  return new Blob(parts, { type: "audio/mpeg" });
}

/* ---------- Advanced engine (ffmpeg from public CDN, needs http/https) ---------- */
const AU_CDNS = [
  { name: "jsDelivr",
    ffmpeg: "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/",
    core: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/" },
  { name: "unpkg",
    ffmpeg: "https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/umd/",
    core: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/" }
];
let auFF = null;
let auProg = null;

const auScript = (src) =>
  new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = ok;
    s.onerror = () => no(Error("Could not load " + src));
    document.head.appendChild(s);
  });

async function auFetchURL(url, mime, onPct) {
  const res = await fetch(url);
  if (!res.ok) throw Error("Download failed (" + res.status + ")");
  const total = parseInt(res.headers.get("Content-Length") || "0", 10);
  const chunks = [];
  let have = 0;
  if (res.body && res.body.getReader) {
    const rd = res.body.getReader();
    for (;;) {
      const r = await rd.read();
      if (r.done) break;
      chunks.push(r.value);
      have += r.value.length;
      if (onPct) onPct(have, total);
    }
  } else {
    chunks.push(new Uint8Array(await res.arrayBuffer()));
  }
  return URL.createObjectURL(new Blob(chunks, { type: mime }));
}

const auTimeout = (p, ms, msg) =>
  new Promise((ok, no) => {
    const t = setTimeout(() => no(Error(msg)), ms);
    p.then((v) => { clearTimeout(t); ok(v); }, (e) => { clearTimeout(t); no(e); });
  });

async function auLoadEngine(say) {
  if (auFF) return auFF;
  let last = null;
  for (const c of AU_CDNS) {
    let inst = null;
    try {
      say("Loading the conversion engine from " + c.name + " (first time only, about 30 MB)…");
      if (!window.FFmpegWASM) await auScript(c.ffmpeg + "ffmpeg.js");
      if (!window.FFmpegWASM) throw Error("Engine script not available");
      const worker = await auFetchURL(c.ffmpeg + "814.ffmpeg.js", "text/javascript");
      const core = await auFetchURL(c.core + "ffmpeg-core.js", "text/javascript");
      const wasm = await auFetchURL(c.core + "ffmpeg-core.wasm", "application/wasm", (g, t) =>
        say("Downloading the engine… " + (t ? Math.round((g / t) * 100) + "%" : (g / 1048576).toFixed(1) + " MB"))
      );
      say("Starting the engine…");
      inst = new FFmpegWASM.FFmpeg();
      inst.on("progress", (e) => { if (auProg) auProg(Math.round(e.progress * 100)); });
      await auTimeout(inst.load({ classWorkerURL: worker, coreURL: core, wasmURL: wasm }), 60000, "Engine start timed out");
      auFF = inst;
      return inst;
    } catch (e) {
      last = e;
      try { if (inst) inst.terminate(); } catch (_) {}
    }
  }
  throw last || Error("Could not load the conversion engine.");
}

/* ---------- Main audio function ----------
   o = { bitrate, sampleRate, channels, onStatus(text), onProgress(percent) }
   returns { blob, ext } */
async function audioConvert(file, key, o = {}) {
  const F = AU_FORMATS[key];
  if (!F) throw Error("Unknown output format.");
  const say = o.onStatus || (() => {});
  const prog = o.onProgress || (() => {});
  const kbps = +o.bitrate || 192;
  const online = location.protocol !== "file:";
  const ch = +o.channels || 0;
  let sr = +o.sampleRate || 0;
  if (sr && F.sr && !F.sr.includes(sr)) sr = F.srDef;

  if (!F.js && !online) {
    throw Error("This format needs the conversion engine. Open the live website (or http://localhost) to use it. MP3, WAV, AIFF and AU work everywhere.");
  }

  if (F.js) {
    try {
      say("Reading the audio…");
      prog(0);
      let buf = await auDecode(file);
      let rate = sr || buf.sampleRate;
      if (F.sr && !F.sr.includes(rate)) rate = F.srDef;
      buf = await auPrep(buf, rate, ch);
      say("Converting…");
      let blob;
      if (key === "mp3") blob = await auEncMp3(buf, kbps, prog);
      else if (key === "wav") blob = wav(buf);
      else if (key === "aiff") blob = auAiff(buf);
      else blob = auAu(buf);
      prog(100);
      return { blob, ext: F.ext };
    } catch (e) {
      if (!online) {
        throw Error("Your browser cannot read this file type without the engine. Try an MP3, WAV, OGG, M4A or FLAC file, or open the live website.");
      }
      /* online: fall through and let the engine try */
    }
  }

  const ff = await auLoadEngine(say);
  const inName = "in." + auExt(file.name);
  const outName = "out." + F.ext;
  try {
    await ff.writeFile(inName, new Uint8Array(await file.arrayBuffer()));
    const args = ["-i", inName, "-vn"].concat(F.codec);
    if (F.lossy) args.push("-b:a", kbps + "k");
    if (sr) args.push("-ar", String(sr));
    if (ch) args.push("-ac", String(ch));
    args.push("-f", F.mux, outName);
    say("Converting…");
    auProg = prog;
    prog(0);
    const code = await ff.exec(args);
    if (code !== 0) throw Error("The engine could not convert this file. It may be damaged or not an audio/video file.");
    const data = await ff.readFile(outName);
    if (!data || !data.length) throw Error("The output file is empty.");
    return { blob: new Blob([data], { type: F.mime }), ext: F.ext };
  } finally {
    auProg = null;
    try { await ff.deleteFile(inName); } catch (e) {}
    try { await ff.deleteFile(outName); } catch (e) {}
  }
}

/* ---------- Audio page UI ---------- */
function auStyle() {
  if ($("#auStyle")) return;
  const s = document.createElement("style");
  s.id = "auStyle";
  s.textContent = `
    .au-opt{margin-bottom:18px}.au-opt:last-child{margin-bottom:0}
    .au-opt select{max-width:340px}
    .au-desc{color:var(--muted);font-size:.88rem;margin:8px 0 0}
    .file-list .item .size{color:var(--muted);font-size:.82rem;white-space:nowrap}
    .au-bar{height:10px;background:var(--soft);border-radius:999px;overflow:hidden;margin-top:10px;display:none}
    .au-bar>div{height:100%;width:0;background:var(--ac);transition:width .2s}
    .au-res{background:#fff;border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin-bottom:10px;text-align:left}
    .au-res .top{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
    .au-res .nm{flex:1;min-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;font-size:.93rem}
    .au-res .sz{color:var(--muted);font-size:.82rem}
    .au-res audio{width:100%;margin-top:10px}
    .au-res.fail{background:var(--err-bg);color:var(--err-text)}
    .au-info{max-width:720px;margin:32px auto 0}
    .au-info h2{font-size:1.15rem;margin:0 0 10px}
    .au-info ul{margin:0;padding-left:20px;color:var(--muted);font-size:.93rem}
    .au-info li{margin-bottom:6px}
  `;
  document.head.appendChild(s);
}

function buildAudioConverter(sel) {
  const root = $(sel || "#audioApp");
  if (!root) return;
  auStyle();
  const online = location.protocol !== "file:";
  const keys = Object.keys(AU_FORMATS);
  const opt = (k) => {
    const dis = !online && !AU_FORMATS[k].js;
    return `<option value="${k}"${dis ? " disabled" : ""}>${esc(AU_FORMATS[k].label)}${dis ? " (website only)" : ""}</option>`;
  };
  const accept = "audio/*,video/*," + AU_IN.map((e) => "." + e).join(",");

  root.innerHTML = `
    ${online ? "" : `<div class="msg warn" style="margin-bottom:16px">
      You opened this page from a file on your computer. MP3, WAV, AIFF and AU work right now.
      Other formats are marked <b>website only</b> and need the live website or http://localhost.</div>`}

    <div class="drop-zone" id="auDrop">
      <button type="button" class="big-btn">Select Audio Files</button>
      <div class="hint">or drag &amp; drop here (audio or video files)</div>
      <div class="privacy">Files stay on your device. Nothing is sent to any server.</div>
    </div>
    <input type="file" id="auFile" multiple hidden accept="${accept}">
    <div class="file-list" id="auList"></div>

    <div class="options-box">
      <div class="au-opt">
        <label for="auFmt">Select new format:</label>
        <select id="auFmt">
          <optgroup label="Instant – works everywhere">${keys.filter((k) => AU_FORMATS[k].js).map(opt).join("")}</optgroup>
          <optgroup label="Advanced – loads the engine once (about 30 MB)">${keys.filter((k) => !AU_FORMATS[k].js).map(opt).join("")}</optgroup>
        </select>
        <p class="au-desc" id="auDesc"></p>
      </div>
      <div class="au-opt" id="auQRow">
        <label for="auBit">Quality (bitrate):</label>
        <select id="auBit">
          <option value="64">64 kbps – small file</option>
          <option value="96">96 kbps</option>
          <option value="128">128 kbps – good</option>
          <option value="160">160 kbps</option>
          <option value="192" selected>192 kbps – very good</option>
          <option value="256">256 kbps – high</option>
          <option value="320">320 kbps – best</option>
        </select>
        <p class="au-desc">Higher bitrate gives better sound but a bigger file.</p>
      </div>
      <div class="au-opt">
        <label for="auSr">Sample rate:</label>
        <select id="auSr">
          <option value="0" selected>Keep original</option>
          <option value="8000">8000 Hz (phone quality)</option>
          <option value="16000">16000 Hz (voice)</option>
          <option value="22050">22050 Hz</option>
          <option value="32000">32000 Hz</option>
          <option value="44100">44100 Hz (CD)</option>
          <option value="48000">48000 Hz (video)</option>
        </select>
      </div>
      <div class="au-opt">
        <label for="auCh">Channels:</label>
        <select id="auCh">
          <option value="0" selected>Keep original</option>
          <option value="1">Mono</option>
          <option value="2">Stereo</option>
        </select>
      </div>
    </div>

    <button class="convert-btn" id="auGo" type="button" disabled>Convert</button>

    <div class="result-area">
      <div id="auStatus"></div>
      <div class="au-bar" id="auBar"><div id="auFill"></div></div>
      <div id="auRes" style="margin-top:18px"></div>
    </div>

    <div class="au-info box">
      <h2>Good to know</h2>
      <ul>
        <li>MP3, WAV, AIFF and AU are made instantly inside your browser.</li>
        <li>For the other formats a conversion engine (about 30 MB) is downloaded from a public CDN the first time. After that your browser keeps it.</li>
        <li>Your files are processed on your own device. Do not close the tab while converting.</li>
        <li>Very large files can take a while and need free memory.</li>
        <li>Lossless formats (WAV, FLAC, ALAC, AIFF, AU, CAF, W64) do not use the quality setting.</li>
      </ul>
    </div>
  `;

  const g = (id) => root.querySelector("#" + id);
  const drop = g("auDrop"), input = g("auFile"), list = g("auList");
  const fmtSel = g("auFmt"), desc = g("auDesc"), qRow = g("auQRow");
  const go = g("auGo"), statusEl = g("auStatus"), bar = g("auBar"), fill = g("auFill"), res = g("auRes");
  let files = [], busy = false, urls = [];

  const setStatus = (t, type) => {
    statusEl.innerHTML = "";
    if (!t) return;
    const d = document.createElement("div");
    d.className = "msg" + (type ? " " + type : "");
    d.textContent = t;
    statusEl.appendChild(d);
  };
  const setProg = (p) => {
    if (p === null) { bar.style.display = "none"; fill.style.width = "0"; return; }
    bar.style.display = "block";
    fill.style.width = Math.max(0, Math.min(100, p)) + "%";
  };

  /* default = MP3 */
  fmtSel.value = "mp3";
  const updateFmt = () => {
    const F = AU_FORMATS[fmtSel.value];
    desc.textContent = F.desc;
    qRow.style.display = F.lossy ? "" : "none";
  };
  fmtSel.addEventListener("change", updateFmt);
  updateFmt();

  const renderFiles = () => {
    list.innerHTML = "";
    files.forEach((f, idx) => {
      const it = document.createElement("div");
      it.className = "item";
      const n = document.createElement("span");
      n.className = "name";
      n.textContent = f.name;
      const sz = document.createElement("span");
      sz.className = "size";
      sz.textContent = auSize(f.size);
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "rm";
      rm.title = "Remove";
      rm.textContent = "✕";
      rm.addEventListener("click", () => {
        if (busy) return;
        files.splice(idx, 1);
        renderFiles();
      });
      it.append(n, sz, rm);
      list.appendChild(it);
    });
    go.disabled = busy || !files.length;
  };

  const addFiles = (fl) => {
    if (busy) return;
    let added = 0;
    [...fl].forEach((f) => {
      if (/^(audio|video)\//.test(f.type) || AU_IN.includes(auExt(f.name))) { files.push(f); added++; }
    });
    if (!added && fl.length) setStatus("This file type is not supported. Please choose an audio or video file.", "err");
    else setStatus("");
    res.innerHTML = "";
    renderFiles();
  };

  drop.addEventListener("click", () => { if (!busy) input.click(); });
  input.addEventListener("change", () => { addFiles(input.files); input.value = ""; });
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => { if (e.dataTransfer) addFiles(e.dataTransfer.files); });

  const addResult = (blob, name, mime) => {
    const box = document.createElement("div");
    box.className = "au-res";
    const top = document.createElement("div");
    top.className = "top";
    const nm2 = document.createElement("span");
    nm2.className = "nm";
    nm2.textContent = name;
    const sz = document.createElement("span");
    sz.className = "sz";
    sz.textContent = auSize(blob.size);
    const url = URL.createObjectURL(blob);
    urls.push(url);
    const a = document.createElement("a");
    a.className = "btn";
    a.href = url;
    a.download = name;
    a.textContent = "Download";
    top.append(nm2, sz, a);
    box.appendChild(top);
    const au = document.createElement("audio");
    if (au.canPlayType(mime)) {
      au.controls = true;
      au.src = url;
      box.appendChild(au);
    }
    res.appendChild(box);
  };
  const addFail = (f, why) => {
    const box = document.createElement("div");
    box.className = "au-res fail";
    box.textContent = f.name + " – could not be converted. " + why;
    res.appendChild(box);
  };

  go.addEventListener("click", async () => {
    if (busy || !files.length) return;
    busy = true;
    go.disabled = true;
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls = [];
    res.innerHTML = "";
    const key = fmtSel.value;
    const F = AU_FORMATS[key];
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const tag = "File " + (i + 1) + " of " + files.length + ": " + f.name;
      setProg(0);
      try {
        const r = await audioConvert(f, key, {
          bitrate: g("auBit").value,
          sampleRate: g("auSr").value,
          channels: g("auCh").value,
          onStatus: (m) => setStatus(tag + " – " + m),
          onProgress: setProg
        });
        addResult(r.blob, auBase(f.name) + "." + r.ext, F.mime);
        ok++;
      } catch (e) {
        addFail(f, e && e.message ? e.message : "Unknown error.");
      }
    }
    setProg(null);
    if (ok === files.length) setStatus("Done! " + ok + " file" + (ok > 1 ? "s" : "") + " converted. Use the Download buttons below.");
    else if (ok) setStatus("Finished. " + ok + " of " + files.length + " files were converted.", "warn");
    else setStatus("No file could be converted.", "err");
    busy = false;
    renderFiles();
  });

  renderFiles();
}
/* =====================================================================
   VIDEO CONVERTER  (paste at the very end of app.js, after the audio block)
   - Engine is saved in the browser (Cache Storage) after the first download
   - Engine starts by itself, no "Enable" button needed
   ===================================================================== */
const AU_CACHE = "wtv-engine-v1";

/* Upgrade 1: download once, keep a copy in the browser cache */
auFetchURL = async function (url, mime, onPct) {
  let cache = null;
  try { if (window.caches) cache = await caches.open(AU_CACHE); } catch (e) {}
  let res = null;
  if (cache) { try { res = await cache.match(url); } catch (e) {} }
  const cached = !!res;
  if (!res) {
    res = await fetch(url);
    if (!res.ok) throw Error("Download failed (" + res.status + ")");
  }
  const total = parseInt(res.headers.get("Content-Length") || "0", 10);
  const chunks = [];
  let have = 0;
  if (res.body && res.body.getReader) {
    const rd = res.body.getReader();
    for (;;) {
      const r = await rd.read();
      if (r.done) break;
      chunks.push(r.value);
      have += r.value.length;
      if (onPct) onPct(have, total || have);
    }
  } else {
    const u8 = new Uint8Array(await res.arrayBuffer());
    chunks.push(u8);
    if (onPct) onPct(u8.length, u8.length);
  }
  const blob = new Blob(chunks, { type: mime });
  if (cache && !cached) {
    try { await cache.put(url, new Response(blob, { headers: { "Content-Type": mime } })); } catch (e) {}
  }
  return URL.createObjectURL(blob);
};

/* Upgrade 2: never start the engine twice, share status text */
const _auLoadRaw = auLoadEngine;
let auLoading = null;
let auSayCur = () => {};
auLoadEngine = function (say) {
  auSayCur = say || (() => {});
  if (!auLoading) {
    auLoading = _auLoadRaw((m) => auSayCur(m)).catch((e) => { auLoading = null; throw e; });
  }
  return auLoading;
};

/* Is the engine already saved in this browser? */
async function auEngineCached() {
  try {
    if (!window.caches) return false;
    const c = await caches.open(AU_CACHE);
    for (const x of AU_CDNS) {
      if (await c.match(x.core + "ffmpeg-core.wasm")) return true;
    }
  } catch (e) {}
  return false;
}

/* ---------- Video formats ---------- */
const VID_Q = {
  high:   { crf: 20, qv: 3,  vb: "2500k", th: 8 },
  medium: { crf: 26, qv: 6,  vb: "1200k", th: 6 },
  small:  { crf: 32, qv: 12, vb: "600k",  th: 3 }
};
const X264 = (q) => ["-c:v", "libx264", "-preset", "ultrafast", "-crf", String(q.crf), "-pix_fmt", "yuv420p"];
const AAC = ["-c:a", "aac", "-b:a", "128k"];
const VID_FORMATS = {
  mp4:  { label: "MP4 (H.264)", ext: "mp4", mime: "video/mp4", mux: "mp4", v: X264, a: AAC, x: ["-movflags", "+faststart"],
          desc: "Works on every phone, PC and website. The best choice for most people." },
  webm: { label: "WebM (VP8)", ext: "webm", mime: "video/webm", mux: "webm",
          v: (q) => ["-c:v", "libvpx", "-b:v", q.vb, "-deadline", "realtime", "-cpu-used", "5"], a: ["-c:a", "libvorbis"],
          desc: "Open format made for websites and Chrome/Firefox." },
  mkv:  { label: "MKV (H.264)", ext: "mkv", mime: "video/x-matroska", mux: "matroska", v: X264, a: AAC,
          desc: "Flexible container used for movies and downloads." },
  mov:  { label: "MOV (QuickTime)", ext: "mov", mime: "video/quicktime", mux: "mov", v: X264, a: AAC,
          desc: "Apple QuickTime format. Good for Mac and video editors." },
  avi:  { label: "AVI", ext: "avi", mime: "video/x-msvideo", mux: "avi",
          v: (q) => ["-c:v", "mpeg4", "-q:v", String(q.qv)], a: ["-c:a", "libmp3lame", "-b:a", "128k", "-ac", "2"],
          desc: "Old Windows format. Works on old players and TVs." },
  flv:  { label: "FLV (Flash video)", ext: "flv", mime: "video/x-flv", mux: "flv", v: X264, a: AAC,
          desc: "Old Flash video format." },
  "3gp": { label: "3GP (old phones)", ext: "3gp", mime: "video/3gpp", mux: "3gp", v: X264,
          a: ["-c:a", "aac", "-b:a", "64k", "-ac", "1", "-ar", "22050"],
          desc: "Small files for very old mobile phones." },
  mpg:  { label: "MPG (MPEG-2)", ext: "mpg", mime: "video/mpeg", mux: "mpeg",
          v: (q) => ["-c:v", "mpeg2video", "-q:v", String(q.qv)], a: ["-c:a", "mp2", "-b:a", "192k", "-ar", "44100"],
          desc: "DVD style video. Works on old DVD and TV players." },
  ogv:  { label: "OGV (Theora)", ext: "ogv", mime: "video/ogg", mux: "ogg",
          v: (q) => ["-c:v", "libtheora", "-q:v", String(q.th)], a: ["-c:a", "libvorbis", "-q:a", "5"],
          desc: "Open and free video format." },
  wmv:  { label: "WMV (Windows)", ext: "wmv", mime: "video/x-ms-wmv", mux: "asf",
          v: (q) => ["-c:v", "wmv2", "-b:v", q.vb], a: ["-c:a", "wmav2", "-b:a", "128k"],
          desc: "Windows Media Video, for old Windows players." },
  gif:  { label: "GIF (animation)", ext: "gif", mime: "image/gif", mux: "gif", anim: true,
          desc: "Short looping animation. Best for clips under 15 seconds." },
  webp: { label: "Animated WebP", ext: "webp", mime: "image/webp", mux: "webp", anim: true,
          desc: "Like GIF but smaller and sharper. Works in modern browsers." }
};
const VID_AUDIO = ["mp3", "wav", "ogg", "opus", "flac", "m4a", "aac"];

function vidArgs(key, inName, outName, o) {
  const F = VID_FORMATS[key];
  const a = ["-i", inName];
  if (F.anim) {
    const fps = +o.fps || 10, w = +o.width || 480, len = +o.length || 10;
    a.push("-t", String(len), "-an");
    if (key === "gif") {
      a.push("-vf", "fps=" + fps + ",scale=" + w + ":-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse", "-loop", "0");
    } else {
      a.push("-vf", "fps=" + fps + ",scale=" + w + ":-1:flags=lanczos", "-c:v", "libwebp", "-loop", "0", "-q:v", "60");
    }
    a.push("-f", F.mux, outName);
    return a;
  }
  const q = VID_Q[o.quality] || VID_Q.medium;
  const h = +o.height || 0;
  a.push("-vf", h ? "scale=-2:'min(" + h + ",ih)'" : "scale=trunc(iw/2)*2:trunc(ih/2)*2");
  a.push.apply(a, F.v(q));
  if (o.mute) a.push("-an");
  else a.push.apply(a, F.a);
  if (F.x) a.push.apply(a, F.x);
  a.push("-f", F.mux, outName);
  return a;
}

/* val = "v:mp4" (video) or "a:mp3" (audio only)
   o = { quality, height, mute, width, fps, length, bitrate, onStatus, onProgress } */
async function videoConvert(file, val, o = {}) {
  const say = o.onStatus || (() => {});
  const prog = o.onProgress || (() => {});
  const kind = val.split(":")[0], key = val.split(":")[1];
  if (kind === "a") {
    return audioConvert(file, key, { bitrate: o.bitrate, onStatus: say, onProgress: prog });
  }
  if (location.protocol === "file:") {
    throw Error("Video conversion needs the live website or http://localhost. Opening the page from a file is not enough.");
  }
  const F = VID_FORMATS[key];
  if (!F) throw Error("Unknown output format.");
  const ff = await auLoadEngine(say);
  const inName = "in." + auExt(file.name);
  const outName = "out." + F.ext;
  try {
    say("Reading the file…");
    await ff.writeFile(inName, new Uint8Array(await file.arrayBuffer()));
    say("Converting… (large videos can take a few minutes)");
    auProg = prog;
    prog(0);
    const code = await ff.exec(vidArgs(key, inName, outName, o));
    if (code !== 0) throw Error("The engine could not convert this file. It may be damaged, or this format does not suit this video.");
    const data = await ff.readFile(outName);
    if (!data || !data.length) throw Error("The output file is empty.");
    return { blob: new Blob([data], { type: F.mime }), ext: F.ext };
  } finally {
    auProg = null;
    try { await ff.deleteFile(inName); } catch (e) {}
    try { await ff.deleteFile(outName); } catch (e) {}
  }
}

/* ---------- Video page UI ---------- */
function buildVideoConverter(sel) {
  const root = $(sel || "#videoApp");
  if (!root) return;
  auStyle();
  const online = location.protocol !== "file:";
  const vOpt = (k) => `<option value="v:${k}"${online ? "" : " disabled"}>${esc(VID_FORMATS[k].label)}${online ? "" : " (website only)"}</option>`;
  const aOpt = (k) => {
    const dis = !online && !AU_FORMATS[k].js;
    return `<option value="a:${k}"${dis ? " disabled" : ""}>${esc(AU_FORMATS[k].label)}${dis ? " (website only)" : ""}</option>`;
  };
  const accept = "video/*,audio/*," + AU_IN.map((e) => "." + e).join(",");
  root.innerHTML = `
    ${online ? "" : `<div class="msg warn" style="margin-bottom:16px">
      You opened this page from a file on your computer. Video formats need the live website or http://localhost.
      Only MP3 and WAV audio extraction work right now.</div>`}
    <div class="drop-zone" id="vdDrop">
      <button type="button" class="big-btn">Select Video Files</button>
      <div class="hint">or drag &amp; drop here</div>
      <div class="privacy">Files stay on your device. Nothing is sent to any server.</div>
    </div>
    <input type="file" id="vdFile" multiple hidden accept="${accept}">
    <div class="file-list" id="vdList"></div>
    <div class="options-box">
      <div class="au-opt">
        <label for="vdFmt">Select new format:</label>
        <select id="vdFmt">
          <optgroup label="Video">${Object.keys(VID_FORMATS).filter((k) => !VID_FORMATS[k].anim).map(vOpt).join("")}</optgroup>
          <optgroup label="Animation">${Object.keys(VID_FORMATS).filter((k) => VID_FORMATS[k].anim).map(vOpt).join("")}</optgroup>
          <optgroup label="Extract audio only">${VID_AUDIO.map(aOpt).join("")}</optgroup>
        </select>
        <p class="au-desc" id="vdDesc"></p>
      </div>
      <div class="au-opt" id="vdRowQ">
        <label for="vdQ">Quality:</label>
        <select id="vdQ">
          <option value="high">High (bigger file)</option>
          <option value="medium" selected>Medium (balanced)</option>
          <option value="small">Small file</option>
        </select>
      </div>
      <div class="au-opt" id="vdRowRes">
        <label for="vdRes">Size (height):</label>
        <select id="vdRes">
          <option value="0" selected>Keep original</option>
          <option value="1080">1080p</option>
          <option value="720">720p</option>
          <option value="480">480p</option>
          <option value="360">360p</option>
          <option value="240">240p</option>
        </select>
      </div>
      <div class="au-opt" id="vdRowMute">
        <label><input type="checkbox" id="vdMute"> Remove sound (mute)</label>
      </div>
      <div id="vdRowGif">
        <div class="au-opt">
          <label for="vdW">Width:</label>
          <select id="vdW"><option value="320">320 px</option><option value="480" selected>480 px</option><option value="640">640 px</option></select>
        </div>
        <div class="au-opt">
          <label for="vdFps">Frames per second:</label>
          <select id="vdFps"><option value="8">8</option><option value="10" selected>10</option><option value="15">15</option></select>
        </div>
        <div class="au-opt">
          <label for="vdLen">Use only the first:</label>
          <select id="vdLen"><option value="5">5 seconds</option><option value="10" selected>10 seconds</option><option value="15">15 seconds</option><option value="30">30 seconds</option></select>
        </div>
      </div>
      <div class="au-opt" id="vdRowAB">
        <label for="vdAB">Audio quality (bitrate):</label>
        <select id="vdAB">
          <option value="96">96 kbps</option><option value="128">128 kbps</option>
          <option value="192" selected>192 kbps</option><option value="256">256 kbps</option><option value="320">320 kbps</option>
        </select>
      </div>
    </div>
    <button class="convert-btn" id="vdGo" type="button" disabled>Convert</button>
    <div class="result-area">
      <div class="au-desc" id="vdEng" style="text-align:center"></div>
      <div id="vdStatus" style="margin-top:10px"></div>
      <div class="au-bar" id="vdBar"><div id="vdFill"></div></div>
      <div id="vdOut" style="margin-top:18px"></div>
    </div>
    <div class="au-info box">
      <h2>Good to know</h2>
      <ul>
        <li>The first time, a small conversion engine (about 30 MB) is downloaded from a public CDN. Your browser then saves it, so next time it starts by itself.</li>
        <li>Your videos are converted on your own device. Nothing is uploaded. Do not close the tab while converting.</li>
        <li>Big videos need free memory and time. Files under 500 MB work best.</li>
        <li>For GIF and WebP only the first few seconds are used, so the file stays small.</li>
      </ul>
    </div>
  `;
  const g = (id) => root.querySelector("#" + id);
  const drop = g("vdDrop"), input = g("vdFile"), list = g("vdList"), fmt = g("vdFmt"), desc = g("vdDesc");
  const go = g("vdGo"), eng = g("vdEng"), statusEl = g("vdStatus"), bar = g("vdBar"), fill = g("vdFill"), out2 = g("vdOut");
  let files = [], busy = false, urls = [], engineReady = false;
  const setEng = (t) => { eng.textContent = t || ""; };
  const setStatus = (t, type) => {
    statusEl.innerHTML = "";
    if (!t) return;
    const d = document.createElement("div");
    d.className = "msg" + (type ? " " + type : "");
    d.textContent = t;
    statusEl.appendChild(d);
  };
  const setProg = (p) => {
    if (p === null) { bar.style.display = "none"; fill.style.width = "0"; return; }
    bar.style.display = "block";
    fill.style.width = Math.max(0, Math.min(100, p)) + "%";
  };
  const needsEngine = () => {
    const k = fmt.value.split(":");
    return k[0] === "v" || !AU_FORMATS[k[1]].js;
  };
  /* start the engine in the background (no click needed) */
  const warm = () => {
    if (!online || engineReady || !needsEngine()) return;
    setEng("Preparing the engine…");
    auLoadEngine(setEng).then(
      () => { engineReady = true; setEng("Engine ready ✓ (saved in this browser)"); },
      () => setEng("Engine could not load yet. It will try again when you press Convert.")
    );
  };
  const updateFmt = () => {
    const k = fmt.value.split(":"), isA = k[0] === "a";
    const F = isA ? AU_FORMATS[k[1]] : VID_FORMATS[k[1]];
    const anim = !isA && F.anim;
    desc.textContent = F.desc;
    g("vdRowQ").style.display = !isA && !anim ? "" : "none";
    g("vdRowRes").style.display = !isA && !anim ? "" : "none";
    g("vdRowMute").style.display = !isA && !anim ? "" : "none";
    g("vdRowGif").style.display = anim ? "" : "none";
    g("vdRowAB").style.display = isA && F.lossy ? "" : "none";
  };
  fmt.value = online ? "v:mp4" : "a:mp3";
  fmt.addEventListener("change", () => { updateFmt(); if (files.length) warm(); });
  updateFmt();
  const renderFiles = () => {
    list.innerHTML = "";
    files.forEach((f, idx) => {
      const it = document.createElement("div");
      it.className = "item";
      const n = document.createElement("span");
      n.className = "name";
      n.textContent = f.name;
      const sz = document.createElement("span");
      sz.className = "size";
      sz.textContent = auSize(f.size);
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "rm";
      rm.title = "Remove";
      rm.textContent = "✕";
      rm.addEventListener("click", () => { if (busy) return; files.splice(idx, 1); renderFiles(); });
      it.append(n, sz, rm);
      list.appendChild(it);
    });
    go.disabled = busy || !files.length;
  };
  const addFiles = (fl) => {
    if (busy) return;
    let added = 0, big = false;
    [...fl].forEach((f) => {
      if (/^(audio|video)\//.test(f.type) || AU_IN.includes(auExt(f.name))) {
        files.push(f); added++;
        if (f.size > 500 * 1048576) big = true;
      }
    });
    if (!added && fl.length) setStatus("This file type is not supported. Please choose a video file.", "err");
    else if (big) setStatus("This file is very large. Conversion may be slow or may fail if your device runs out of memory.", "warn");
    else setStatus("");
    out2.innerHTML = "";
    renderFiles();
    if (added) warm();
  };
  drop.addEventListener("click", () => { if (!busy) input.click(); });
  input.addEventListener("change", () => { addFiles(input.files); input.value = ""; });
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => { if (e.dataTransfer) addFiles(e.dataTransfer.files); });
  const addResult = (blob, name) => {
    const box = document.createElement("div");
    box.className = "au-res";
    const top = document.createElement("div");
    top.className = "top";
    const n = document.createElement("span");
    n.className = "nm";
    n.textContent = name;
    const sz = document.createElement("span");
    sz.className = "sz";
    sz.textContent = auSize(blob.size);
    const url = URL.createObjectURL(blob);
    urls.push(url);
    const a = document.createElement("a");
    a.className = "btn";
    a.href = url;
    a.download = name;
    a.textContent = "Download";
    top.append(n, sz, a);
    box.appendChild(top);
    const t = blob.type || "";
    let m = null;
    if (t.indexOf("image/") === 0) { m = document.createElement("img"); m.style.cssText = "max-width:100%;margin-top:10px;border-radius:8px"; }
    else if (t.indexOf("video/") === 0 && document.createElement("video").canPlayType(t)) { m = document.createElement("video"); m.controls = true; m.style.cssText = "width:100%;margin-top:10px;border-radius:8px"; }
    else if (t.indexOf("audio/") === 0 && document.createElement("audio").canPlayType(t)) { m = document.createElement("audio"); m.controls = true; m.style.width = "100%"; m.style.marginTop = "10px"; }
    if (m) { m.src = url; box.appendChild(m); }
    out2.appendChild(box);
  };
  const addFail = (f, why) => {
    const box = document.createElement("div");
    box.className = "au-res fail";
    box.textContent = f.name + " – could not be converted. " + why;
    out2.appendChild(box);
  };
  go.addEventListener("click", async () => {
    if (busy || !files.length) return;
    busy = true;
    go.disabled = true;
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls = [];
    out2.innerHTML = "";
    const val = fmt.value;
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const tag = "File " + (i + 1) + " of " + files.length + ": " + f.name;
      setProg(0);
      try {
        const r = await videoConvert(f, val, {
          quality: g("vdQ").value,
          height: g("vdRes").value,
          mute: g("vdMute").checked,
          width: g("vdW").value,
          fps: g("vdFps").value,
          length: g("vdLen").value,
          bitrate: g("vdAB").value,
          onStatus: (m) => setStatus(tag + " – " + m),
          onProgress: setProg
        });
        engineReady = engineReady || needsEngine();
        addResult(r.blob, auBase(f.name) + "." + r.ext);
        ok++;
      } catch (e) {
        addFail(f, e && e.message ? e.message : "Unknown error.");
      }
    }
    setProg(null);
    if (ok === files.length) setStatus("Done! " + ok + " file" + (ok > 1 ? "s" : "") + " converted. Use the Download buttons below.");
    else if (ok) setStatus("Finished. " + ok + " of " + files.length + " files were converted.", "warn");
    else setStatus("No file could be converted.", "err");
    busy = false;
    renderFiles();
  });
  renderFiles();
  /* if the engine is already saved, start it quietly right now */
  if (online) {
    auEngineCached().then((c) => {
      if (c) {
        setEng("Loading the saved engine…");
        auLoadEngine(setEng).then(
          () => { engineReady = true; setEng("Engine ready ✓ (saved in this browser)"); },
          () => setEng("")
        );
      } else {
        setEng("The engine (about 30 MB) downloads automatically when you add a file. Only the first time.");
      }
    });
  }
}
/* =====================================================================
   DOCUMENT CONVERTER v2  (paste at the very end of app.js)
   Reads many file types -> simple "blocks" -> writes many file types
   ===================================================================== */
LIBS.jszip = [CD + "jszip/3.10.1/jszip.min.js", "JSZip"];
LIBS.pdflib = [CD + "pdf-lib/1.17.1/pdf-lib.min.js", "PDFLib"];

const DOC_ALIAS = { jpeg: "jpg", markdown: "md", htm: "html", xhtml: "html", text: "txt" };
const docType = (n) => {
  const e = auExt(n);
  return DOC_ALIAS[e] || e;
};
const DOC_KIND = {};
[
  ["img", "jpg png webp bmp gif svg avif heic heif ico"],
  ["pdf", "pdf"],
  ["text", "docx odt rtf epub pptx txt md html"],
  ["sheet", "xlsx xls xlsb ods csv tsv json"]
].forEach(([k, l]) => l.split(" ").forEach((e) => { DOC_KIND[e] = k; }));

const DOC_TO = {
  img: ["pdf"],
  pdf: ["txt", "docx", "html", "md", "rtf", "jpg", "png", "webp", "pdfmerge", "pdfsplit", "pdfrot"],
  text: ["pdf", "docx", "rtf", "html", "md", "txt"],
  sheet: ["csv", "tsv", "json", "xml", "html", "md", "pdf", "xlsx", "xls", "ods"]
};
const docOuts = (type) => {
  const k = DOC_KIND[type];
  return k ? DOC_TO[k].filter((x) => x !== type) : [];
};
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_OUT = {
  pdf:  { label: "PDF", ext: "pdf", mime: "application/pdf", grp: "Documents", desc: "Works everywhere. Good for sharing and printing. Word, HTML and similar files open a print window: choose Save as PDF." },
  docx: { label: "Word (DOCX)", ext: "docx", mime: DOCX_MIME, grp: "Documents", desc: "Word document with the text. Pictures and complex layout are not copied." },
  rtf:  { label: "RTF", ext: "rtf", mime: "application/rtf", text: 1, grp: "Documents", desc: "Simple document format that Word and WordPad can open." },
  html: { label: "HTML (web page)", ext: "html", mime: "text/html", text: 1, grp: "Documents", desc: "A web page file you can open in any browser. Tables become HTML tables." },
  md:   { label: "Markdown (.md)", ext: "md", mime: "text/markdown", text: 1, grp: "Documents", desc: "Simple text with headings and lists. Tables become Markdown tables." },
  txt:  { label: "TXT (plain text)", ext: "txt", mime: "text/plain", text: 1, grp: "Documents", desc: "Only the text, without pictures or styles." },
  jpg:  { label: "JPG (one picture per page)", ext: "jpg", mime: "image/jpeg", grp: "Pictures", desc: "Every PDF page becomes one JPG picture." },
  png:  { label: "PNG (one picture per page)", ext: "png", mime: "image/png", grp: "Pictures", desc: "Every PDF page becomes one PNG picture. Sharper than JPG." },
  webp: { label: "WEBP (one picture per page)", ext: "webp", mime: "image/webp", grp: "Pictures", desc: "Every PDF page becomes one small WEBP picture." },
  csv:  { label: "CSV", ext: "csv", mime: "text/csv", text: 1, grp: "Data", desc: "Simple table file. Opens in Excel and Google Sheets." },
  tsv:  { label: "TSV (tab separated)", ext: "tsv", mime: "text/tab-separated-values", text: 1, grp: "Data", desc: "Like CSV but columns are separated by tabs." },
  json: { label: "JSON", ext: "json", mime: "application/json", text: 1, grp: "Data", desc: "Table rows as JSON. Good for developers." },
  xml:  { label: "XML", ext: "xml", mime: "application/xml", text: 1, grp: "Data", desc: "Table rows as XML." },
  xlsx: { label: "Excel (XLSX)", ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", grp: "Data", desc: "Modern Excel spreadsheet file." },
  xls:  { label: "Excel 97-2003 (XLS)", ext: "xls", mime: "application/vnd.ms-excel", grp: "Data", desc: "Old Excel format for old programs." },
  ods:  { label: "OpenDocument Sheet (ODS)", ext: "ods", mime: "application/vnd.oasis.opendocument.spreadsheet", grp: "Data", desc: "Spreadsheet for LibreOffice and OpenOffice." },
  pdfmerge: { label: "Join PDFs into one PDF", ext: "pdf", mime: "application/pdf", min: 2, grp: "PDF tools", desc: "Choose two or more PDF files. They are joined in the order shown above." },
  pdfsplit: { label: "Split PDF (one PDF per page)", ext: "pdf", mime: "application/pdf", grp: "PDF tools", desc: "Every page becomes its own PDF file." },
  pdfrot:   { label: "Rotate PDF pages", ext: "pdf", mime: "application/pdf", grp: "PDF tools", desc: "Turns all pages of the PDF." }
};

/* ---------- small helpers ---------- */
const docRes = (f, key, data, suffix) => {
  const O = DOC_OUT[key];
  return {
    blob: new Blob([data], { type: O.mime }),
    name: auBase(f.name) + (suffix || "") + "." + O.ext,
    text: O.text && typeof data === "string" ? data : undefined
  };
};
const docHtml = (body, title) =>
  /<html|<!doctype/i.test(body)
    ? body
    : '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title || "Document") +
      '</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:30px auto;padding:0 16px;line-height:1.6;color:#222}table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px 8px}</style></head><body>' +
      body + "</body></html>";

/* HTML text -> list of blocks { t: text, h: heading level 0-6, li: list item } */
function htmlBlocks(h) {
  const d = new DOMParser().parseFromString(h, "text/html");
  d.querySelectorAll("script,style,noscript,head,template").forEach((n) => n.remove());
  const res = [];
  let buf = "";
  const flush = (lvl, li) => {
    const t = buf.replace(/\s+/g, " ").trim();
    buf = "";
    if (t) res.push({ t, h: lvl, li });
  };
  const BL = /^(P|DIV|H[1-6]|LI|PRE|BLOCKQUOTE|TR|SECTION|ARTICLE|TABLE|UL|OL|HEADER|FOOTER|MAIN|ASIDE|NAV|FIGURE|FIGCAPTION|DL|DT|DD|BODY)$/;
  const walk = (n) => {
    if (n.nodeType === 3) { buf += n.textContent; return; }
    if (n.nodeType !== 1) return;
    const tag = n.tagName;
    if (tag === "BR") { buf += " "; return; }
    if (BL.test(tag)) {
      flush(0, false);
      n.childNodes.forEach(walk);
      const m = /^H([1-6])$/.exec(tag);
      flush(m ? +m[1] : 0, tag === "LI");
    } else {
      n.childNodes.forEach(walk);
      if (tag === "TD" || tag === "TH") buf += " ";
    }
  };
  walk(d.body);
  return res;
}
const blocksBody = (b) => {
  let h = "", inList = false;
  b.forEach((x) => {
    if (x.li && !inList) { h += "<ul>"; inList = true; }
    if (!x.li && inList) { h += "</ul>"; inList = false; }
    h += x.li ? "<li>" + esc(x.t) + "</li>" : x.h ? "<h" + x.h + ">" + esc(x.t) + "</h" + x.h + ">" : "<p>" + esc(x.t) + "</p>";
  });
  return h + (inList ? "</ul>" : "");
};
const blocksTxt = (b) => b.map((x) => (x.li ? "- " : "") + x.t).join("\n\n");
const blocksMd = (b) => b.map((x) => (x.h ? "#".repeat(x.h) + " " + x.t : x.li ? "- " + x.t : x.t)).join("\n\n");
const rtfEsc = (s) =>
  s.replace(/[\\{}]/g, "\\$&").replace(/[^\x00-\x7e]/g, (c) => {
    const n = c.charCodeAt(0);
    return "\\u" + (n > 32767 ? n - 65536 : n) + "?";
  });
const blocksRtf = (b) => {
  const SZ = { 1: 40, 2: 34, 3: 30, 4: 26, 5: 24, 6: 22 };
  return "{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\f0\\fs22\n" +
    b.map((x) => x.h ? "{\\pard\\sa160\\b\\fs" + SZ[x.h] + " " + rtfEsc(x.t) + "\\par}"
      : x.li ? "{\\pard\\sa80\\li360 \\bullet  " + rtfEsc(x.t) + "\\par}"
      : "{\\pard\\sa160 " + rtfEsc(x.t) + "\\par}").join("\n") + "\n}";
};
async function makeDocx(blocks) {
  await lib("jszip");
  const x = (s) => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const SZ = { 1: 44, 2: 36, 3: 30, 4: 26, 5: 24, 6: 22 };
  const list = blocks.length ? blocks : [{ t: "", h: 0, li: false }];
  const body = list.map((b) => {
    const rpr = b.h ? '<w:rPr><w:b/><w:sz w:val="' + SZ[b.h] + '"/></w:rPr>' : "";
    const ppr = b.li ? '<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>' : "";
    return "<w:p>" + ppr + "<w:r>" + rpr + '<w:t xml:space="preserve">' + x((b.li ? "• " : "") + b.t) + "</w:t></w:r></w:p>";
  }).join("");
  const z = new JSZip();
  z.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  z.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  z.file("word/document.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + body + "</w:body></w:document>");
  return z.generateAsync({ type: "blob", mimeType: DOCX_MIME });
}

/* ---------- readers: file -> blocks ---------- */
async function odtBlocks(file) {
  await lib("jszip");
  const z = await JSZip.loadAsync(await file.arrayBuffer());
  const cf = z.file("content.xml");
  if (!cf) throw Error("This is not a valid ODT file.");
  const d = new DOMParser().parseFromString(await cf.async("string"), "text/xml");
  const res = [];
  const clean = (n) => n.textContent.replace(/\s+/g, " ").trim();
  const walk = (n, li) => {
    [...n.children].forEach((c) => {
      const nm = c.localName;
      if (nm === "h") { const t = clean(c); if (t) res.push({ t, h: +c.getAttribute("text:outline-level") || 1, li: false }); }
      else if (nm === "p") { const t = clean(c); if (t) res.push({ t, h: 0, li }); }
      else walk(c, li || nm === "list-item");
    });
  };
  walk(d.getElementsByTagName("office:text")[0] || d.documentElement, false);
  return res;
}
function rtfBlocks(s) {
  const stack = [];
  const SKIP = /^(fonttbl|colortbl|stylesheet|info|pict|header|footer|footnote|themedata|datastore|listtable|listoverridetable|rsidtbl|generator)$/;
  const SYM = { emdash: "—", endash: "–", bullet: "•", lquote: "‘", rquote: "’", ldblquote: "“", rdblquote: "”" };
  let skip = false, text = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "{") stack.push(skip);
    else if (c === "}") skip = stack.length ? stack.pop() : false;
    else if (c === "\\") {
      const n = s[i + 1];
      if (n === "\\" || n === "{" || n === "}") { if (!skip) text += n; i++; }
      else if (n === "'") { if (!skip) text += String.fromCharCode(parseInt(s.substr(i + 2, 2), 16)); i += 3; }
      else if (n === "*") { skip = true; i++; }
      else {
        const m = /^\\([a-zA-Z]+)(-?\d+)?\s?/.exec(s.slice(i, i + 40));
        if (!m) { i++; continue; }
        i += m[0].length - 1;
        const w = m[1];
        if (SKIP.test(w)) skip = true;
        else if (skip) continue;
        else if (w === "par" || w === "line" || w === "sect" || w === "page") text += "\n";
        else if (w === "tab") text += " ";
        else if (SYM[w]) text += SYM[w];
        else if (w === "u") {
          let cp = +m[2];
          if (cp < 0) cp += 65536;
          text += String.fromCharCode(cp);
          const nx = s[i + 1];
          if (nx && nx !== "\\" && nx !== "{" && nx !== "}") i++;
        }
      }
    } else if (c !== "\n" && c !== "\r" && !skip) text += c;
  }
  const res = text.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).map((t) => ({ t, h: 0, li: false }));
  if (!res.length) throw Error("No text was found in this RTF file.");
  return res;
}
async function epubBlocks(file) {
  await lib("jszip");
  const z = await JSZip.loadAsync(await file.arrayBuffer());
  const rd = async (p) => { const f = z.file(p); return f ? f.async("string") : ""; };
  const parse = (s) => new DOMParser().parseFromString(s, "application/xml");
  const rf = parse(await rd("META-INF/container.xml")).querySelector("rootfile");
  const opfPath = rf && rf.getAttribute("full-path");
  if (!opfPath) throw Error("This is not a valid EPUB file.");
  const opf = parse(await rd(opfPath));
  const dir = opfPath.indexOf("/") > -1 ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
  const man = {};
  opf.querySelectorAll("manifest > item").forEach((it) => { man[it.getAttribute("id")] = it.getAttribute("href"); });
  const res = [];
  for (const r of [...opf.querySelectorAll("spine > itemref")]) {
    const href = man[r.getAttribute("idref")];
    if (!href) continue;
    const path = decodeURIComponent(new URL(href, "http://x/" + dir).pathname.slice(1));
    const html = await rd(path);
    if (html) res.push.apply(res, htmlBlocks(html));
  }
  if (!res.length) throw Error("No text was found in this EPUB file.");
  return res;
}
async function pptxBlocks(file) {
  await lib("jszip");
  const z = await JSZip.loadAsync(await file.arrayBuffer());
  const num = (n) => parseInt(n.match(/(\d+)\.xml$/)[1], 10);
  const names = Object.keys(z.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => num(a) - num(b));
  if (!names.length) throw Error("No slides were found. Only .pptx files are supported (not old .ppt).");
  const res = [];
  for (let i = 0; i < names.length; i++) {
    const d = new DOMParser().parseFromString(await z.file(names[i]).async("string"), "text/xml");
    res.push({ t: "Slide " + (i + 1), h: 2, li: false });
    [...d.getElementsByTagName("a:p")].forEach((p) => {
      const t = [...p.getElementsByTagName("a:t")].map((x) => x.textContent).join("").trim();
      if (t) res.push({ t, h: 0, li: false });
    });
  }
  return res;
}
async function docPdfPages(file) {
  await lib("pdfjs");
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([`importScripts("${CD}pdf.js/3.11.174/pdf.worker.min.js")`]));
  }
  const d = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let i = 1; i <= d.numPages; i++) {
    const items = (await (await d.getPage(i)).getTextContent()).items;
    pages.push(items.map((x) => x.str + (x.hasEOL ? "\n" : " ")).join(""));
  }
  return pages;
}
/* any text-like file -> { blocks, html?, txt?, raw? } */
async function docSource(f, type) {
  if (type === "txt") {
    const raw = (await f.text()).replace(/\r/g, "");
    return { raw, blocks: raw.split("\n").map((l) => l.trim()).filter(Boolean).map((t) => ({ t, h: 0, li: false })) };
  }
  if (type === "md") { const html = md2html(await f.text()); return { blocks: htmlBlocks(html), html }; }
  if (type === "html") { const html = await f.text(); return { blocks: htmlBlocks(html), html }; }
  if (type === "docx") {
    await lib("mammoth");
    const html = (await mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() })).value;
    return { blocks: htmlBlocks(html), html };
  }
  if (type === "odt") return { blocks: await odtBlocks(f) };
  if (type === "rtf") return { blocks: rtfBlocks(await f.text()) };
  if (type === "epub") return { blocks: await epubBlocks(f) };
  if (type === "pptx") return { blocks: await pptxBlocks(f) };
  if (type === "pdf") {
    const pages = await docPdfPages(f);
    if (!pages.join("").trim()) throw Error("No text found. This PDF may be a scanned picture.");
    const blocks = [];
    pages.forEach((p) => p.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).forEach((t) => blocks.push({ t, h: 0, li: false })));
    const txt = pages.map((p) => p.replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim()).join("\n\n");
    return { blocks, txt };
  }
  throw Error("This file type is not supported.");
}

/* ---------- spreadsheets (SheetJS) ---------- */
async function sheetWB(f, type) {
  await lib("xlsx");
  if (type === "csv" || type === "tsv") return XLSX.read(await f.text(), { type: "string" });
  if (type === "json") {
    let d;
    try { d = JSON.parse(await f.text()); } catch (e) { throw Error("That does not look like valid JSON."); }
    if (!Array.isArray(d)) d = [d];
    d = d.map((o) => (o && typeof o === "object"
      ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v && typeof v === "object" ? JSON.stringify(v) : v]))
      : { value: o }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d), "Sheet1");
    return wb;
  }
  return XLSX.read(await f.arrayBuffer(), { type: "array" });
}
const sheetMd = (s) => {
  const a = XLSX.utils.sheet_to_json(s, { header: 1, defval: "" });
  const w = a.reduce((m, r) => Math.max(m, r.length), 0);
  if (!a.length || !w) return "";
  const cell = (v) => String(v).replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
  const row = (r) => "| " + [...Array(w)].map((_, i) => cell(r[i] == null ? "" : r[i])).join(" | ") + " |";
  return [row(a[0]), "| " + Array(w).fill("---").join(" | ") + " |"].concat(a.slice(1).map(row)).join("\n");
};
const xmlKey = (k) => {
  k = String(k).replace(/[^\w.-]/g, "_");
  return /^[A-Za-z_]/.test(k) ? k : "_" + k;
};
async function sheetOut(f, type, key) {
  const wb = await sheetWB(f, type);
  if (!wb.SheetNames.length) throw Error("No sheets were found in this file.");
  const base = auBase(f.name);
  if (key === "xlsx" || key === "xls" || key === "ods") {
    const data = XLSX.write(wb, { bookType: key === "xls" ? "biff8" : key, type: "array" });
    return { files: [docRes(f, key, data)] };
  }
  const tbl = (s) => XLSX.utils.sheet_to_html(s, { header: "", footer: "" });
  if (key === "pdf") {
    const all = wb.SheetNames.map((n) => (wb.SheetNames.length > 1 ? "<h2>" + esc(n) + "</h2>" : "") + tbl(wb.Sheets[n])).join("");
    return printIt(docHtml(all, base));
  }
  const files = wb.SheetNames.map((sn) => {
    const s = wb.Sheets[sn];
    const suf = wb.SheetNames.length > 1 ? "-" + sn.replace(/[\\/:*?"<>|]/g, "_") : "";
    let data;
    if (key === "csv") data = XLSX.utils.sheet_to_csv(s);
    else if (key === "tsv") data = XLSX.utils.sheet_to_csv(s, { FS: "\t" });
    else if (key === "json") data = JSON.stringify(XLSX.utils.sheet_to_json(s, { defval: "" }), null, 2);
    else if (key === "md") data = sheetMd(s);
    else if (key === "html") data = docHtml(tbl(s), sn);
    else if (key === "xml") {
      const rows = XLSX.utils.sheet_to_json(s, { defval: "" }).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [xmlKey(k), v])));
      data = '<?xml version="1.0" encoding="UTF-8"?>\n<rows>' + toXML(rows, "row") + "</rows>";
    } else throw Error("This format is not available for spreadsheets.");
    return docRes(f, key, data, suf);
  });
  return { files };
}

/* ---------- pictures and PDF tools ---------- */
async function docImgCanvas(f) {
  let src = f;
  if (/^hei[cf]$/.test(auExt(f.name))) {
    await lib("heic");
    const b = await heic2any({ blob: f, toType: "image/jpeg" });
    src = Array.isArray(b) ? b[0] : b;
  }
  return cv(src, true);
}
async function imgsToPdf(job) {
  const pages = [];
  for (const x of job) {
    const c = await docImgCanvas(x);
    pages.push({ jpeg: new Uint8Array(await (await bl(c, "image/jpeg", 0.92)).arrayBuffer()), w: c.width, h: c.height });
  }
  return pdf(pages);
}
async function pdfLibOut(job, key, o) {
  await lib("pdflib");
  const { PDFDocument, degrees } = PDFLib;
  const load = async (f) => {
    try { return await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true }); }
    catch (e) { throw Error("Could not read " + f.name + ". It may be damaged or protected by a password."); }
  };
  const save = async (d) => new Blob([await d.save()], { type: "application/pdf" });
  if (key === "pdfmerge") {
    const dst = await PDFDocument.create();
    for (const f of job) {
      const s = await load(f);
      (await dst.copyPages(s, s.getPageIndices())).forEach((p) => dst.addPage(p));
    }
    return [{ blob: await save(dst), name: "merged.pdf" }];
  }
  const f = job[0];
  const src = await load(f);
  const base = auBase(f.name);
  if (key === "pdfsplit") {
    const n = src.getPageCount();
    if (n < 2) throw Error("This PDF has only one page.");
    const res = [];
    for (let i = 0; i < n; i++) {
      const d = await PDFDocument.create();
      const [p] = await d.copyPages(src, [i]);
      d.addPage(p);
      res.push({ blob: await save(d), name: base + "-page-" + (i + 1) + ".pdf" });
    }
    return res;
  }
  const deg = +o.rotate || 90;
  src.getPages().forEach((p) => p.setRotation(degrees((((p.getRotation().angle + deg) % 360) + 360) % 360)));
  return [{ blob: await save(src), name: base + "-rotated.pdf" }];
}

/* ---------- main function for one job ----------
   job = list of files, key = output key, o = { rotate }
   returns { files:[{blob,name,text}] } or { note } */
async function docConvert(job, key, o) {
  o = o || {};
  const f = job[0];
  const type = docType(f.name);
  const kind = DOC_KIND[type];
  const base = auBase(f.name);
  if (kind === "img") {
    if (key !== "pdf") throw Error("Pictures can be converted to PDF here. For other picture formats use the Image page.");
    return { files: [{ blob: await imgsToPdf(job), name: job.length > 1 ? "images.pdf" : base + ".pdf" }] };
  }
  if (key === "pdfmerge" || key === "pdfsplit" || key === "pdfrot") return { files: await pdfLibOut(job, key, o) };
  if (kind === "sheet") return sheetOut(f, type, key);
  if (type === "pdf" && (key === "jpg" || key === "png" || key === "webp")) {
    const r = await run("pdf", key, { files: [f] });
    return { files: r.files.map((x, i) => ({ blob: x.blob, name: base + "-page-" + (i + 1) + "." + key })) };
  }
  const S = await docSource(f, type);
  if (!S.blocks.length) throw Error("No text was found in this file.");
  switch (key) {
    case "txt": return { files: [docRes(f, key, S.txt != null ? S.txt : blocksTxt(S.blocks))] };
    case "md": return { files: [docRes(f, key, S.html ? html2md(S.html) : blocksMd(S.blocks))] };
    case "html": return { files: [docRes(f, key, docHtml(S.html || blocksBody(S.blocks), base))] };
    case "rtf": return { files: [docRes(f, key, blocksRtf(S.blocks))] };
    case "docx": return { files: [{ blob: await makeDocx(S.blocks), name: base + ".docx" }] };
    case "pdf":
      if (type === "txt" && /^[\x09\x0a\x20-\x7e]*$/.test(S.raw)) return { files: [{ blob: textPdf(S.raw).files[0].blob, name: base + ".pdf" }] };
      return printIt(docHtml(S.html || blocksBody(S.blocks), base));
  }
  throw Error("This conversion is not available.");
}

/* ---------- Page UI ---------- */
function buildDocConverter(sel) {
  const root = $(sel || "#docApp");
  if (!root) return;
  auStyle();
  const accept = Object.keys(DOC_KIND).concat(Object.keys(DOC_ALIAS)).map((e) => "." + e).join(",");
  root.innerHTML = `
    <div class="drop-zone" id="dcDrop">
      <button type="button" class="big-btn">Select Files</button>
      <div class="hint">or drag &amp; drop here (PDF, Word, Excel, PowerPoint, EPUB, ODT, RTF, CSV, JSON, TXT, Markdown, HTML, pictures)</div>
      <div class="privacy">Files stay on your device. Nothing is sent to any server.</div>
    </div>
    <input type="file" id="dcFile" multiple hidden accept="${accept}">
    <div class="file-list" id="dcList"></div>
    <div class="options-box">
      <div class="au-opt">
        <label for="dcFmt">Select new format:</label>
        <select id="dcFmt"></select>
        <p class="au-desc" id="dcDesc"></p>
      </div>
      <div class="au-opt" id="dcMergeRow" style="display:none">
        <label><input type="checkbox" id="dcMerge" checked> Join all pictures into one PDF</label>
      </div>
      <div class="au-opt" id="dcRotRow" style="display:none">
        <label for="dcRot">Rotate pages:</label>
        <select id="dcRot">
          <option value="90">90° clockwise</option>
          <option value="180">180°</option>
          <option value="270">90° anti-clockwise</option>
        </select>
      </div>
    </div>
    <button class="convert-btn" id="dcGo" type="button" disabled>Convert</button>
    <div class="result-area">
      <div id="dcStatus"></div>
      <div id="dcRes" style="margin-top:18px"></div>
    </div>
    <div class="au-info box">
      <h2>What can I convert?</h2>
      <ul>
        <li><b>Pictures</b> (JPG, PNG, WEBP, BMP, GIF, SVG, AVIF, HEIC, ICO) → PDF</li>
        <li><b>PDF</b> → TXT, DOCX, HTML, Markdown, RTF, JPG, PNG, WEBP</li>
        <li><b>PDF tools</b> → join, split and rotate</li>
        <li><b>Word (DOCX), ODT, RTF, EPUB, PowerPoint (PPTX)</b> → PDF, DOCX, TXT, HTML, Markdown, RTF</li>
        <li><b>TXT, Markdown, HTML</b> → PDF, DOCX, RTF and each other</li>
        <li><b>Excel (XLSX, XLS, XLSB), ODS, CSV, TSV, JSON</b> → CSV, TSV, JSON, XML, HTML, Markdown, PDF, XLSX, XLS, ODS</li>
      </ul>
    </div>
    <div class="au-info box">
      <h2>Good to know</h2>
      <ul>
        <li>Everything happens inside your browser. Your files are never uploaded.</li>
        <li>A small helper file (for PDF, Word, Excel or ZIP) is loaded once from a public CDN when needed. Your files are not sent there.</li>
        <li>Converting to PDF from Word, HTML, ODT, EPUB and similar opens a print window. Choose <b>Save as PDF</b> as the printer and allow pop-ups.</li>
        <li>PDF → text formats works only if the PDF has real text. Scanned PDFs are pictures and need OCR, which is not included.</li>
        <li>PowerPoint, EPUB and PDF conversions copy the text only, not the layout or pictures.</li>
        <li>Old .doc and .ppt files are not supported. Save them as .docx or .pptx first.</li>
      </ul>
    </div>
  `;
  const g = (id) => root.querySelector("#" + id);
  const drop = g("dcDrop"), input = g("dcFile"), list = g("dcList"), fmt = g("dcFmt"), desc = g("dcDesc");
  const mergeRow = g("dcMergeRow"), mergeBox = g("dcMerge"), rotRow = g("dcRotRow");
  const go = g("dcGo"), statusEl = g("dcStatus"), res = g("dcRes");
  const isImg = (f) => DOC_KIND[docType(f.name)] === "img";
  let files = [], busy = false, urls = [];
  const setStatus = (t, type) => {
    statusEl.innerHTML = "";
    if (!t) return;
    const d = document.createElement("div");
    d.className = "msg" + (type ? " " + type : "");
    d.textContent = t;
    statusEl.appendChild(d);
  };
  const outsFor = () => {
    let r = null;
    files.forEach((f) => {
      const o = docOuts(docType(f.name));
      r = r ? r.filter((x) => o.includes(x)) : o.slice();
    });
    return (r || []).filter((x) => !DOC_OUT[x].min || files.length >= DOC_OUT[x].min);
  };
  const updateFmt = () => {
    const F = DOC_OUT[fmt.value];
    desc.textContent = F ? F.desc : "";
    mergeRow.style.display = fmt.value === "pdf" && files.length > 1 && files.every(isImg) ? "" : "none";
    rotRow.style.display = fmt.value === "pdfrot" ? "" : "none";
  };
  const fillFormats = () => {
    const prev = fmt.value;
    const outs = outsFor();
    if (!files.length) {
      fmt.innerHTML = '<option value="">Choose a file first</option>';
      fmt.disabled = true;
    } else if (!outs.length) {
      fmt.innerHTML = '<option value="">No common format – choose files of the same kind</option>';
      fmt.disabled = true;
    } else {
      let h = "";
      ["Documents", "Pictures", "Data", "PDF tools"].forEach((grp) => {
        const k = outs.filter((x) => DOC_OUT[x].grp === grp);
        if (k.length) h += '<optgroup label="' + grp + '">' + k.map((x) => '<option value="' + x + '">' + esc(DOC_OUT[x].label) + "</option>").join("") + "</optgroup>";
      });
      fmt.innerHTML = h;
      fmt.disabled = false;
      if (outs.includes(prev)) fmt.value = prev;
    }
    updateFmt();
  };
  fmt.addEventListener("change", updateFmt);
  const renderFiles = () => {
    list.innerHTML = "";
    files.forEach((f, idx) => {
      const it = document.createElement("div");
      it.className = "item";
      const n = document.createElement("span");
      n.className = "name";
      n.textContent = f.name;
      const sz = document.createElement("span");
      sz.className = "size";
      sz.textContent = auSize(f.size);
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "rm";
      rm.title = "Remove";
      rm.textContent = "✕";
      rm.addEventListener("click", () => {
        if (busy) return;
        files.splice(idx, 1);
        renderFiles();
      });
      it.append(n, sz, rm);
      list.appendChild(it);
    });
    fillFormats();
    go.disabled = busy || !files.length || !outsFor().length;
  };
  const addFiles = (fl) => {
    if (busy) return;
    let added = 0;
    [...fl].forEach((f) => {
      if (DOC_KIND[docType(f.name)]) { files.push(f); added++; }
    });
    if (!added && fl.length) setStatus("This file type is not supported. Please choose a PDF, Word, Excel, PowerPoint, EPUB, ODT, RTF, CSV, JSON, TXT, Markdown, HTML or picture file.", "err");
    else if (files.length && !outsFor().length) setStatus("These files are of different kinds, so no common format was found. Please remove some files.", "warn");
    else setStatus("");
    res.innerHTML = "";
    renderFiles();
  };
  drop.addEventListener("click", () => { if (!busy) input.click(); });
  input.addEventListener("change", () => { addFiles(input.files); input.value = ""; });
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => { if (e.dataTransfer) addFiles(e.dataTransfer.files); });
  const addCard = (blob, name, text) => {
    const box = document.createElement("div");
    box.className = "au-res";
    const top = document.createElement("div");
    top.className = "top";
    const n = document.createElement("span");
    n.className = "nm";
    n.textContent = name;
    const sz = document.createElement("span");
    sz.className = "sz";
    sz.textContent = auSize(blob.size);
    top.append(n, sz);
    if (text !== undefined) {
      const cp = document.createElement("button");
      cp.type = "button";
      cp.className = "btn alt";
      cp.textContent = "Copy";
      cp.addEventListener("click", () => {
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => { cp.textContent = "Copied!"; });
      });
      top.appendChild(cp);
    }
    const url = URL.createObjectURL(blob);
    urls.push(url);
    const a = document.createElement("a");
    a.className = "btn";
    a.href = url;
    a.download = name;
    a.textContent = "Download";
    top.appendChild(a);
    box.appendChild(top);
    if ((blob.type || "").indexOf("image/") === 0) {
      const im = document.createElement("img");
      im.src = url;
      im.style.cssText = "max-width:100%;max-height:260px;margin-top:10px;border-radius:8px;border:1px solid var(--line)";
      box.appendChild(im);
    } else if (text !== undefined) {
      const ta = document.createElement("textarea");
      ta.readOnly = true;
      ta.value = text.length > 6000 ? text.slice(0, 6000) + "\n… (preview only, download for the full file)" : text;
      ta.style.cssText = "width:100%;height:140px;margin-top:10px;box-sizing:border-box";
      box.appendChild(ta);
    }
    res.appendChild(box);
  };
  const addZip = (all) => {
    const box = document.createElement("div");
    box.className = "au-res";
    const top = document.createElement("div");
    top.className = "top";
    const n = document.createElement("span");
    n.className = "nm";
    n.textContent = all.length + " files ready";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn";
    b.textContent = "Download all as ZIP";
    b.addEventListener("click", async () => {
      b.disabled = true;
      b.textContent = "Making ZIP…";
      try {
        await lib("jszip");
        const z = new JSZip();
        const used = {};
        all.forEach((x) => {
          let nm2 = x.name, k = 1;
          while (used[nm2]) nm2 = x.name.replace(/(\.[^.]*)?$/, "-" + ++k + "$1");
          used[nm2] = 1;
          z.file(nm2, x.blob);
        });
        dl(await z.generateAsync({ type: "blob" }), "webtoolvault-files.zip");
        b.textContent = "Download all as ZIP";
      } catch (e) {
        b.textContent = "ZIP failed – use the single downloads";
      }
      b.disabled = false;
    });
    top.append(n, b);
    box.appendChild(top);
    res.insertBefore(box, res.firstChild);
  };
  const addFail = (name, why) => {
    const box = document.createElement("div");
    box.className = "au-res fail";
    box.textContent = name + " – could not be converted. " + why;
    res.appendChild(box);
  };
  go.addEventListener("click", async () => {
    if (busy || !files.length) return;
    const key = fmt.value;
    if (!DOC_OUT[key]) return;
    busy = true;
    go.disabled = true;
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls = [];
    res.innerHTML = "";
    const merge = key === "pdfmerge" || (key === "pdf" && files.length > 1 && files.every(isImg) && mergeBox.checked);
    const jobs = merge ? [files.slice()] : files.map((f) => [f]);
    const done = [];
    let ok = 0, note = "";
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i], f = job[0];
      setStatus(merge ? "Joining " + job.length + " files – working…" : "File " + (i + 1) + " of " + jobs.length + ": " + f.name + " – working…");
      await new Promise((r) => setTimeout(r, 30));
      try {
        const r = await docConvert(job, key, { rotate: g("dcRot").value });
        if (r.note) { note = r.note; ok++; continue; }
        r.files.forEach((x) => { addCard(x.blob, x.name, x.text); done.push(x); });
        ok++;
      } catch (e) {
        addFail(merge ? "Files" : f.name, e && e.message ? e.message : "Unknown error.");
      }
    }
    if (done.length > 1) addZip(done);
    if (ok === jobs.length) setStatus(note || "Done! Use the Download buttons below.");
    else if (ok) setStatus("Finished. " + ok + " of " + jobs.length + " were converted.", "warn");
    else setStatus("Nothing could be converted.", "err");
    busy = false;
    renderFiles();
  });
  renderFiles();
}
/* ===== DEVELOPER CONVERTER (paste at the very end of app.js) ===== */
(function () {
"use strict";

const isObj = v => v !== null && typeof v === "object" && !Array.isArray(v);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const $ = (s, r) => (r || document).querySelector(s);
const enc = s => new TextEncoder().encode(s);
const dec = u => new TextDecoder().decode(u);
const hex = u => Array.from(u, b => b.toString(16).padStart(2, "0")).join("");
const fmtSize = n => n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(1) + " MB";

/* ---------- names / cases ---------- */
const words = s => String(s).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").split(/[^A-Za-z0-9]+/).filter(Boolean);
const cap = w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
const pascal = w => w.map(cap).join("");
const camel = w => w.map((x, i) => i ? cap(x) : x.toLowerCase()).join("");
const snake = w => w.map(x => x.toLowerCase()).join("_");
const kebab = w => w.map(x => x.toLowerCase()).join("-");
const constant = w => w.map(x => x.toUpperCase()).join("_");
const dotc = w => w.map(x => x.toLowerCase()).join(".");
const KW = new Set("abstract as async await base boolean break byte case catch char class const continue crate def default do double dyn else enum extends false final finally float fn for from fun global goto if impl implements import in int interface internal is lambda let long loop match mod move mut namespace new not null object or out package params pass private public ref return self short static string struct super switch this throw trait true try type unsafe use using val var void where while".split(" "));
const idf = (s, fn) => { let r = fn(words(s)); if (!r) r = "field"; if (/^\d/.test(r)) r = "_" + r; if (KW.has(r)) r += "_"; return r; };
const perLine = (t, f) => t.replace(/\r/g, "").split("\n").map(l => { const w = words(l); return w.length ? f(w) : l; }).join("\n");
const lines = t => t.replace(/\r/g, "").split("\n");

/* ---------- YAML helper (only library used) ---------- */
let yamlP = null;
function loadYaml() {
  if (window.jsyaml) return Promise.resolve(window.jsyaml);
  if (!yamlP) yamlP = new Promise((ok, bad) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js";
    s.onload = () => window.jsyaml ? ok(window.jsyaml) : bad(new Error("The YAML helper did not load."));
    s.onerror = () => { yamlP = null; bad(new Error("Could not load the YAML helper. Please check your internet.")); };
    document.head.appendChild(s);
  });
  return yamlP;
}

/* ---------- reading data ---------- */
function stripJsonExtras(t) {
  let o = "", i = 0, n = t.length, inS = false;
  while (i < n) {
    const c = t[i], d = t[i + 1];
    if (inS) { o += c; if (c === "\\") { o += d || ""; i += 2; continue; } if (c === '"') inS = false; i++; continue; }
    if (c === '"') { inS = true; o += c; i++; continue; }
    if (c === "/" && d === "/") { while (i < n && t[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") { const e = t.indexOf("*/", i + 2); i = e < 0 ? n : e + 2; continue; }
    o += c; i++;
  }
  return o.replace(/,(\s*[}\]])/g, "$1");
}
function parseJSON(t) {
  t = t.replace(/^\uFEFF/, "");
  try { return JSON.parse(t); } catch (e1) {
    try { return JSON.parse(stripJsonExtras(t)); } catch (e2) { throw new Error("This is not valid JSON. " + e1.message); }
  }
}
function typed(s, o) {
  if (!o.types || typeof s !== "string") return s;
  const t = s.trim();
  if (t === "true") return true;
  if (t === "false") return false;
  if (/^-?(0|[1-9]\d{0,14})(\.\d+)?([eE][+-]?\d+)?$/.test(t)) return Number(t);
  return s;
}
function csvRows(t, d) {
  const rows = []; let row = [], f = "", q = false;
  t = t.replace(/^\uFEFF/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === d) { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(f); f = ""; rows.push(row); row = []; }
    else f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows;
}
function rowsToVal(rows, o) {
  rows = rows.filter(r => r.some(c => String(c).trim() !== ""));
  if (!rows.length) throw new Error("No rows were found.");
  if (!o.header) return rows.map(r => r.map(c => typed(c, o)));
  const seen = {};
  const head = rows[0].map((h, i) => { let k = String(h).trim() || ("column" + (i + 1)); if (seen[k]) { k = k + "_" + (++seen[k]); } else seen[k] = 1; return k; });
  return rows.slice(1).map(r => { const ob = {}; head.forEach((h, i) => ob[h] = typed(r[i] === undefined ? "" : r[i], o)); return ob; });
}
function xmlParse(t, o) {
  const d = new DOMParser().parseFromString(t, "application/xml");
  const e = d.querySelector("parsererror");
  if (e) throw new Error("This XML is not valid. " + e.textContent.split("\n")[0].slice(0, 160));
  const conv = n => {
    const obj = {}; let hasAttr = false;
    for (const a of Array.from(n.attributes)) { obj["@" + a.name] = typed(a.value, o); hasAttr = true; }
    const kids = Array.from(n.children);
    const text = Array.from(n.childNodes).filter(c => c.nodeType === 3 || c.nodeType === 4).map(c => c.nodeValue).join("").trim();
    if (!kids.length && !hasAttr) return text === "" ? "" : typed(text, o);
    for (const k of kids) {
      const v = conv(k), tn = k.tagName;
      if (own(obj, tn)) { if (!Array.isArray(obj[tn])) obj[tn] = [obj[tn]]; obj[tn].push(v); } else obj[tn] = v;
    }
    if (text !== "") obj["#text"] = typed(text, o);
    return obj;
  };
  const r = {}; r[d.documentElement.tagName] = conv(d.documentElement); return r;
}
function iniParse(t, o) {
  const root = {}; let cur = root;
  for (const raw of t.split(/\r?\n/)) {
    const l = raw.trim();
    if (!l || l[0] === ";" || l[0] === "#") continue;
    let m = /^\[(.+)\]$/.exec(l);
    if (m) { root[m[1].trim()] = root[m[1].trim()] || {}; cur = root[m[1].trim()]; continue; }
    m = /^([^=:]+?)\s*[=:]\s*(.*)$/.exec(l);
    if (!m) continue;
    let v = m[2];
    if (/^".*"$|^'.*'$/.test(v)) v = v.slice(1, -1); else v = typed(v, o);
    cur[m[1].trim()] = v;
  }
  return root;
}
function fixArrays(v) {
  if (Array.isArray(v)) return v.map(fixArrays);
  if (!isObj(v)) return v;
  const ks = Object.keys(v), r = {};
  ks.forEach(k => r[k] = fixArrays(v[k]));
  if (ks.length && ks.every((k, i) => k === String(i))) return ks.map(k => r[k]);
  return r;
}
function nestKeys(flat) {
  const root = {};
  for (const k of Object.keys(flat)) {
    const p = k.split("."); let c = root;
    p.forEach((s, i) => { if (i === p.length - 1) c[s] = flat[k]; else { if (!isObj(c[s])) c[s] = {}; c = c[s]; } });
  }
  return fixArrays(root);
}
function propsParse(t, o) {
  const flat = {}, L = t.replace(/\r/g, "").split("\n");
  const un = s => s.replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\r/g, "\r").replace(/\\(.)/g, "$1");
  for (let i = 0; i < L.length; i++) {
    let l = L[i].replace(/^\s+/, "");
    if (!l || l[0] === "#" || l[0] === "!") continue;
    while (/(^|[^\\])(\\\\)*\\$/.test(l) && i + 1 < L.length) l = l.slice(0, -1) + L[++i].replace(/^\s+/, "");
    const m = /^((?:\\.|[^=:\s\\])+)(?:\s*[=:]\s*|\s+)?(.*)$/.exec(l);
    if (m) flat[un(m[1])] = typed(un(m[2]), o);
  }
  return nestKeys(flat);
}
function envParse(t, o) {
  const r = {};
  for (const l of t.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][\w.]*)\s*=\s*(.*)$/.exec(l);
    if (!m) continue;
    let v = m[2].trim();
    if (/^".*"$/.test(v)) v = v.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"');
    else if (/^'.*'$/.test(v)) v = v.slice(1, -1);
    else v = typed(v.replace(/\s+#.*$/, ""), o);
    r[m[1]] = v;
  }
  return r;
}
function ndParse(t) {
  const out = [];
  t.split(/\r?\n/).forEach((l, i) => { if (!l.trim()) return; try { out.push(JSON.parse(l)); } catch (e) { throw new Error("Line " + (i + 1) + " is not valid JSON."); } });
  return out;
}
function htmlTableParse(t, o) {
  const d = new DOMParser().parseFromString(t, "text/html");
  const tb = d.querySelector("table");
  if (!tb) throw new Error("No <table> was found in this HTML.");
  const rows = Array.from(tb.querySelectorAll("tr")).map(tr => Array.from(tr.children).filter(c => /^(td|th)$/i.test(c.tagName)).map(c => c.textContent.trim().replace(/\s+/g, " "))).filter(r => r.length);
  return rowsToVal(rows, o);
}
function mdTableParse(t, o) {
  const cells = r => r.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, "|"));
  const rows = t.split(/\r?\n/).filter(l => l.includes("|") && !(/^\s*\|?[\s:\-|]+\|?\s*$/.test(l) && l.includes("-"))).map(cells);
  if (!rows.length) throw new Error("No Markdown table was found.");
  return rowsToVal(rows, o);
}
function sqlParse(t) {
  const rows = [];
  const re = /INSERT\s+(?:IGNORE\s+)?INTO\s+([`"\[\]\w.]+)\s*(?:\(([^)]*)\))?\s*VALUES\s*/gi;
  let m;
  while ((m = re.exec(t))) {
    const cols = m[2] ? m[2].split(",").map(c => c.trim().replace(/^[`"\[]+|[`"\]]+$/g, "")) : null;
    let p = re.lastIndex;
    for (;;) {
      while (p < t.length && /[\s,]/.test(t[p])) p++;
      if (t[p] !== "(") break;
      p++;
      const vals = []; let tok = "", inS = false, wasStr = false, depth = 0;
      const fin = () => {
        let r;
        if (wasStr) r = tok;
        else { const s = tok.trim(); if (/^null$/i.test(s)) r = null; else if (/^true$/i.test(s)) r = true; else if (/^false$/i.test(s)) r = false; else if (s !== "" && !isNaN(Number(s))) r = Number(s); else r = s; }
        vals.push(r); tok = ""; wasStr = false;
      };
      for (; p < t.length; p++) {
        const ch = t[p];
        if (inS) {
          if (ch === "'") { if (t[p + 1] === "'") { tok += "'"; p++; } else inS = false; }
          else if (ch === "\\" && p + 1 < t.length) { const n = t[++p]; tok += n === "n" ? "\n" : n === "t" ? "\t" : n === "r" ? "\r" : n; }
          else tok += ch;
        }
        else if (ch === "'") { inS = true; wasStr = true; }
        else if (ch === "(") { depth++; tok += ch; }
        else if (ch === ")") { if (depth > 0) { depth--; tok += ch; } else { fin(); p++; break; } }
        else if (ch === "," && depth === 0) fin();
        else if (wasStr && /\s/.test(ch)) { }
        else tok += ch;
      }
      rows.push(cols ? Object.fromEntries(cols.map((c, i) => [c, vals[i]])) : vals);
    }
    re.lastIndex = p;
  }
  if (!rows.length) throw new Error("I could not find INSERT INTO ... VALUES (...) in this SQL.");
  return rows;
}

/* ---------- TOML ---------- */
function tomlEq(l) { let q = ""; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (q) { if (ch === q) q = ""; } else if (ch === '"' || ch === "'") q = ch; else if (ch === "=") return i; } return -1; }
function tomlSplitKey(s) {
  const out = []; let cur = "", q = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === q) q = ""; else cur += ch; }
    else if (ch === '"' || ch === "'") q = ch;
    else if (ch === ".") { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim()); return out;
}
function tomlStripComment(l) {
  let q = "";
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (q) { if (ch === "\\" && q === '"') i++; else if (ch === q) q = ""; }
    else if (ch === '"' || ch === "'") q = ch;
    else if (ch === "#") return l.slice(0, i);
  }
  return l;
}
function tomlDepth(s) {
  let d = 0, q = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === "\\" && q === '"') i++; else if (ch === q) q = ""; }
    else if (ch === '"' || ch === "'") q = ch;
    else if (ch === "[" || ch === "{") d++;
    else if (ch === "]" || ch === "}") d--;
  }
  return d;
}
function tomlUnesc(s) {
  try { return JSON.parse('"' + s.replace(/\\(?!["\\\/bfnrtu])/g, "\\\\").replace(/\n/g, "\\n").replace(/\t/g, "\\t") + '"'); } catch (e) { return s; }
}
function tomlTable(root, path, isArr) {
  let c = root;
  path.forEach((k, i) => {
    const last = i === path.length - 1;
    if (last && isArr) { if (!Array.isArray(c[k])) c[k] = []; const n = {}; c[k].push(n); c = n; }
    else { if (Array.isArray(c[k])) c = c[k][c[k].length - 1]; else { if (!isObj(c[k])) c[k] = {}; c = c[k]; } }
  });
  return c;
}
function tomlValue(s) {
  let p = 0;
  const ws = () => { while (p < s.length && /\s/.test(s[p])) p++; };
  const wsc = () => { for (;;) { ws(); if (s[p] === ",") p++; else break; } };
  function val() {
    ws();
    if (p >= s.length) throw new Error("TOML: a value is missing.");
    const c = s[p];
    if (c === '"') { let q = p + 1, r = ""; while (q < s.length && s[q] !== '"') { if (s[q] === "\\") { r += s[q] + (s[q + 1] || ""); q += 2; } else r += s[q++]; } p = q + 1; return tomlUnesc(r); }
    if (c === "'") { const e = s.indexOf("'", p + 1); if (e < 0) throw new Error("TOML: a string is not closed."); const r = s.slice(p + 1, e); p = e + 1; return r; }
    if (c === "[") { p++; const a = []; for (;;) { wsc(); if (p >= s.length) throw new Error("TOML: a list is not closed."); if (s[p] === "]") { p++; break; } a.push(val()); } return a; }
    if (c === "{") {
      p++; const o = {};
      for (;;) {
        wsc(); if (p >= s.length) throw new Error("TOML: an inline table is not closed.");
        if (s[p] === "}") { p++; break; }
        const e = tomlEq(s.slice(p)); if (e < 0) throw new Error("TOML: bad inline table.");
        const ks = tomlSplitKey(s.slice(p, p + e)); p += e + 1;
        const v = val(); let t = o;
        for (let k = 0; k < ks.length - 1; k++) { if (!isObj(t[ks[k]])) t[ks[k]] = {}; t = t[ks[k]]; }
        t[ks[ks.length - 1]] = v;
      }
      return o;
    }
    const m = /^[^\s,\]\}]+/.exec(s.slice(p));
    if (!m) throw new Error("TOML: cannot read the value near '" + s.slice(p, p + 10) + "'.");
    p += m[0].length;
    const w = m[0];
    if (w === "true") return true;
    if (w === "false") return false;
    const n = w.replace(/_/g, "");
    if (/^[+-]?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(n)) return Number(n);
    if (/^0x[0-9a-f]+$/i.test(n)) return parseInt(n, 16);
    if (/^0o[0-7]+$/.test(n)) return parseInt(n.slice(2), 8);
    if (/^0b[01]+$/.test(n)) return parseInt(n.slice(2), 2);
    return w;
  }
  return val();
}
function tomlParse(t) {
  const root = {}; let cur = root;
  const L = t.replace(/\r/g, "").split("\n");
  for (let i = 0; i < L.length; i++) {
    const line = L[i].trim();
    if (!line || line[0] === "#") continue;
    if (line.startsWith("[[")) { const e = line.indexOf("]]"); if (e < 0) throw new Error("TOML: bad table on line " + (i + 1) + "."); cur = tomlTable(root, tomlSplitKey(line.slice(2, e)), true); continue; }
    if (line[0] === "[") { const e = line.indexOf("]"); if (e < 0) throw new Error("TOML: bad table on line " + (i + 1) + "."); cur = tomlTable(root, tomlSplitKey(line.slice(1, e)), false); continue; }
    const eq = tomlEq(line);
    if (eq < 0) throw new Error("TOML: line " + (i + 1) + " needs key = value.");
    const keys = tomlSplitKey(line.slice(0, eq));
    let val = line.slice(eq + 1).trim(), v;
    const tq = val.startsWith('"""') ? '"""' : val.startsWith("'''") ? "'''" : "";
    if (tq) {
      let buf = val.slice(3);
      while (buf.indexOf(tq) < 0) { if (++i >= L.length) throw new Error("TOML: a multi-line string is not closed."); buf += "\n" + L[i]; }
      let s = buf.slice(0, buf.indexOf(tq)); if (s[0] === "\n") s = s.slice(1);
      v = tq === '"""' ? tomlUnesc(s.replace(/\\\n\s*/g, "")) : s;
    } else {
      val = tomlStripComment(val);
      while (tomlDepth(val) > 0 && i + 1 < L.length) val += "\n" + tomlStripComment(L[++i]);
      v = tomlValue(val.trim());
    }
    let c = cur;
    for (let k = 0; k < keys.length - 1; k++) { if (!isObj(c[keys[k]])) c[keys[k]] = {}; c = c[keys[k]]; }
    c[keys[keys.length - 1]] = v;
  }
  return root;
}

async function getVal(type, text, o) {
  switch (type) {
    case "json": return parseJSON(text);
    case "yaml": {
      const y = await loadYaml(); let r;
      try { r = y.load(text); } catch (e) { if (/single document/i.test(e.message)) r = y.loadAll(text); else throw new Error("This YAML is not valid. " + String(e.message).split("\n")[0]); }
      if (r === undefined) throw new Error("The YAML is empty.");
      return JSON.parse(JSON.stringify(r));
    }
    case "xml": return xmlParse(text, o);
    case "csv": return rowsToVal(csvRows(text, ","), o);
    case "tsv": return rowsToVal(csvRows(text, "\t"), o);
    case "toml": return tomlParse(text);
    case "ini": return iniParse(text, o);
    case "props": return propsParse(text, o);
    case "env": return envParse(text, o);
    case "ndjson": return ndParse(text);
    case "html": return htmlTableParse(text, o);
    case "md": return mdTableParse(text, o);
    case "sql": return sqlParse(text);
  }
  throw new Error("I could not tell what type of data this is. Please choose the input type above.");
}

const IN_TYPES = [["json", "JSON"], ["yaml", "YAML"], ["xml", "XML"], ["csv", "CSV (comma)"], ["tsv", "TSV (tab)"], ["toml", "TOML"], ["ini", "INI"], ["props", ".properties"], ["env", ".env file"], ["ndjson", "JSON Lines (NDJSON)"], ["html", "HTML table"], ["md", "Markdown table"], ["sql", "SQL INSERT"]];
function detect(t, name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || ""), ext = m ? m[1].toLowerCase() : "";
  const E = { json: "json", jsonc: "json", json5: "json", geojson: "json", yaml: "yaml", yml: "yaml", xml: "xml", rss: "xml", atom: "xml", svg: "xml", plist: "xml", csv: "csv", tsv: "tsv", tab: "tsv", toml: "toml", ini: "ini", cfg: "ini", conf: "ini", properties: "props", env: "env", ndjson: "ndjson", jsonl: "ndjson", html: "html", htm: "html", md: "md", markdown: "md", sql: "sql" };
  if (E[ext]) return E[ext];
  const s = t.trim();
  if (s[0] === "{") return "json";
  if (s[0] === "[") { try { parseJSON(s); return "json"; } catch (e) { } }
  if (/^INSERT\s+INTO/i.test(s)) return "sql";
  if (/^<\?xml/i.test(s)) return "xml";
  if (/^<!doctype html|^<html/i.test(s) || /<table[\s>]/i.test(s)) return "html";
  if (s[0] === "<") return "xml";
  const ls = s.split(/\r?\n/).filter(l => l.trim());
  if (ls.length > 1 && ls.every(l => /^\s*\{.*\}\s*$/.test(l))) return "ndjson";
  if (/^\s*\|.*\|/m.test(s) && /^\s*\|?\s*:?-{2,}/m.test(s)) return "md";
  if (/^\s*\[[^\]]+\]\s*$/m.test(s) && /^\s*[\w.\-]+\s*=/m.test(s)) return /"|\[\[/.test(s) ? "toml" : "ini";
  if (ls.length && ls.every(l => /^\s*(export\s+)?[A-Za-z_][\w.]*\s*=/.test(l) || /^\s*#/.test(l))) {
    if (/^\s*(export\s+)?[A-Z][A-Z0-9_]*\s*=/m.test(s)) return "env";
    return /=\s*"/.test(s) ? "toml" : "props";
  }
  const f = ls[0] || "";
  if (/^---/.test(s) || /^\s*-\s+\S/.test(f) || /^[\w.\-"' ]+:(\s|$)/.test(f)) return "yaml";
  if (ls.length && f.includes("\t")) return "tsv";
  if (f.includes(",")) return "csv";
  return "text";
}

/* ---------- writing data ---------- */
function sortKeys(v) { if (Array.isArray(v)) return v.map(sortKeys); if (isObj(v)) { const r = {}; Object.keys(v).sort().forEach(k => r[k] = sortKeys(v[k])); return r; } return v; }
function flatten(v, mode, pre, out) {
  pre = pre || ""; out = out || {};
  if (isObj(v) && Object.keys(v).length) { for (const k of Object.keys(v)) flatten(v[k], mode, pre ? pre + "." + k : k, out); }
  else if (Array.isArray(v) && mode === "index" && v.length) { v.forEach((x, i) => flatten(x, mode, pre ? pre + "." + i : String(i), out)); }
  else out[pre] = v;
  return out;
}
function findList(v) {
  let x = v;
  for (let i = 0; i < 5; i++) {
    if (Array.isArray(x)) return x;
    if (isObj(x)) { const ks = Object.keys(x).filter(k => k[0] !== "@"); if (ks.length === 1) { x = x[ks[0]]; continue; } }
    break;
  }
  return Array.isArray(x) ? x : (isObj(x) ? x : v);
}
const cellStr = x => x === null || x === undefined ? "" : typeof x === "object" ? JSON.stringify(x) : String(x);
function tableRows(v) {
  let l = findList(v);
  if (!Array.isArray(l)) l = [l];
  if (!l.length) throw new Error("There is no data to put in a table.");
  let rows;
  if (l.every(Array.isArray)) { rows = l.map(r => r.map(cellStr)); rows.hasHeader = false; return rows; }
  const flats = l.map(x => isObj(x) ? flatten(x, "json") : { value: x });
  const keys = [], seen = new Set();
  flats.forEach(f => Object.keys(f).forEach(k => { if (!seen.has(k)) { seen.add(k); keys.push(k); } }));
  rows = [keys].concat(flats.map(f => keys.map(k => cellStr(f[k]))));
  rows.hasHeader = true; return rows;
}
function csvOut(v, d, o) {
  let rows = tableRows(v);
  if (!o.header && rows.hasHeader) rows = rows.slice(1);
  const cell = s => (s.indexOf(d) >= 0 || /["\r\n]/.test(s) || /^\s|\s$/.test(s)) ? '"' + s.replace(/"/g, '""') + '"' : s;
  return rows.map(r => r.map(cell).join(d)).join("\n") + "\n";
}
function htmlTableOut(v, o) {
  const rows = tableRows(v), I = o.ind;
  const cell = (t, x) => I + I + I + "<" + t + ">" + esc(x) + "</" + t + ">";
  return "<table>\n" + I + "<thead>\n" + I + I + "<tr>\n" + rows[0].map(x => cell("th", x)).join("\n") + "\n" + I + I + "</tr>\n" + I + "</thead>\n" + I + "<tbody>\n" +
    rows.slice(1).map(r => I + I + "<tr>\n" + r.map(x => cell("td", x)).join("\n") + "\n" + I + I + "</tr>").join("\n") + "\n" + I + "</tbody>\n</table>\n";
}
function mdTable(rows) {
  const c = x => String(x).replace(/\|/g, "\\|").replace(/\n/g, " ");
  const n = Math.max(...rows.map(r => r.length));
  const R = rows.map(r => { const a = r.map(c); while (a.length < n) a.push(""); return a; });
  const w = []; for (let i = 0; i < n; i++) w[i] = Math.max(3, ...R.map(r => r[i].length));
  const line = r => "| " + r.map((x, i) => x.padEnd(w[i])).join(" | ") + " |";
  return [line(R[0]), "| " + w.map(x => "-".repeat(x)).join(" | ") + " |"].concat(R.slice(1).map(line)).join("\n") + "\n";
}
const xe = x => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const xmlName = k => { k = String(k).replace(/[^\w.\-]/g, "_"); return /^[A-Za-z_]/.test(k) ? k : "_" + k; };
function xmlNode(name, v, ind, lvl) {
  const pad = ind.repeat(lvl), nl = ind ? "\n" : "";
  if (Array.isArray(v)) return v.map(x => xmlNode(name, x, ind, lvl)).join(nl);
  const tag = xmlName(name);
  if (v === null || v === undefined) return pad + "<" + tag + "/>";
  if (!isObj(v)) return pad + "<" + tag + ">" + xe(v) + "</" + tag + ">";
  let attrs = "", text = ""; const kids = [];
  for (const k of Object.keys(v)) {
    if (k[0] === "@") attrs += " " + xmlName(k.slice(1)) + '="' + xe(v[k]).replace(/"/g, "&quot;") + '"';
    else if (k === "#text") text = xe(v[k]);
    else kids.push(xmlNode(k, v[k], ind, lvl + 1));
  }
  if (!kids.length) return text ? pad + "<" + tag + attrs + ">" + text + "</" + tag + ">" : pad + "<" + tag + attrs + "/>";
  return pad + "<" + tag + attrs + ">" + nl + (text ? pad + ind + text + nl : "") + kids.join(nl) + nl + pad + "</" + tag + ">";
}
function xmlOut(v, o) {
  const I = o.ind; let root = o.name || "root", body;
  if (isObj(v) && !o.name) {
    const all = Object.keys(v), ks = all.filter(k => k[0] !== "@" && k !== "#text");
    if (all.length === 1 && ks.length === 1 && !Array.isArray(v[ks[0]])) { root = ks[0]; body = xmlNode(root, v[root], I, 0); }
  }
  if (body === undefined) body = xmlNode(root, Array.isArray(v) ? { item: v } : v, I, 0);
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + body + "\n";
}
function tomlOut(v) {
  if (!isObj(v)) throw new Error("TOML needs an object at the top (like {...}). Your data is a list.");
  const L = [];
  const key = k => /^[A-Za-z0-9_\-]+$/.test(k) ? k : JSON.stringify(k);
  const val = x => {
    if (x === null || x === undefined) return '""';
    if (typeof x === "string") return JSON.stringify(x);
    if (typeof x === "number" || typeof x === "boolean") return String(x);
    if (Array.isArray(x)) return "[" + x.map(val).join(", ") + "]";
    return "{ " + Object.keys(x).map(k => key(k) + " = " + val(x[k])).join(", ") + " }";
  };
  const isTA = a => Array.isArray(a) && a.length && a.every(isObj);
  const emit = (obj, path) => {
    const tables = [];
    for (const k of Object.keys(obj)) { const x = obj[k]; if (isObj(x) || isTA(x)) tables.push(k); else L.push(key(k) + " = " + val(x)); }
    for (const k of tables) {
      const p = path.concat(k).map(key).join("."), x = obj[k];
      if (Array.isArray(x)) x.forEach(it => { L.push("", "[[" + p + "]]"); emit(it, path.concat(k)); });
      else { L.push("", "[" + p + "]"); emit(x, path.concat(k)); }
    }
  };
  emit(v, []);
  return L.join("\n").trim() + "\n";
}
function iniOut(v) {
  if (!isObj(v)) throw new Error("INI needs an object at the top (like {...}). Your data is a list.");
  const sv = x => x === null || x === undefined ? "" : typeof x === "object" ? JSON.stringify(x) : String(x);
  const top = [], secs = [];
  for (const k of Object.keys(v)) {
    if (isObj(v[k])) { const f = flatten(v[k], "json"); secs.push("[" + k + "]\n" + Object.keys(f).map(x => x + " = " + sv(f[x])).join("\n")); }
    else top.push(k + " = " + sv(v[k]));
  }
  return [top.join("\n")].concat(secs).filter(Boolean).join("\n\n") + "\n";
}
function propsOut(v) {
  const f = flatten(v, "index");
  const pk = k => k.replace(/\\/g, "\\\\").replace(/[=: ]/g, m => "\\" + m);
  const pv = x => (x === null || x === undefined ? "" : typeof x === "object" ? JSON.stringify(x) : String(x)).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
  return Object.keys(f).map(k => pk(k) + "=" + pv(f[k])).join("\n") + "\n";
}
function envOut(v) {
  const f = flatten(v, "index");
  return Object.keys(f).map(k => {
    const s = cellStr(f[k]);
    return k.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase() + "=" + (/[\s#"'\\]/.test(s) || s === "" ? JSON.stringify(s) : s);
  }).join("\n") + "\n";
}
function sqlOut(v, o, full) {
  let l = findList(v); if (!Array.isArray(l)) l = [l];
  const flats = l.map(x => isObj(x) ? flatten(x, "json") : Array.isArray(x) ? Object.fromEntries(x.map((y, i) => ["col" + (i + 1), y])) : { value: x });
  const cols = [], seen = new Set();
  flats.forEach(f => Object.keys(f).forEach(k => { if (!seen.has(k)) { seen.add(k); cols.push(k); } }));
  if (!cols.length) throw new Error("There is no data to turn into SQL.");
  const idn = k => { k = String(k).replace(/\W+/g, "_"); return /^\d/.test(k) ? "_" + k : k; };
  const tbl = idn(o.name || "data");
  const val = x => x === null || x === undefined ? "NULL" : typeof x === "number" ? String(x) : typeof x === "boolean" ? (x ? "TRUE" : "FALSE") : "'" + (typeof x === "object" ? JSON.stringify(x) : String(x)).replace(/'/g, "''") + "'";
  const typ = k => {
    const vals = flats.map(f => f[k]).filter(x => x !== null && x !== undefined);
    if (vals.length && vals.every(x => typeof x === "boolean")) return "BOOLEAN";
    if (vals.length && vals.every(x => Number.isInteger(x))) return "INTEGER";
    if (vals.length && vals.every(x => typeof x === "number")) return "REAL";
    return "TEXT";
  };
  let s = "";
  if (full) s += "CREATE TABLE " + tbl + " (\n" + cols.map(k => "  " + idn(k) + " " + typ(k)).join(",\n") + "\n);\n\n";
  s += flats.map(f => "INSERT INTO " + tbl + " (" + cols.map(idn).join(", ") + ") VALUES (" + cols.map(k => val(f[k])).join(", ") + ");").join("\n") + "\n";
  return s;
}

/* ---------- code generators ---------- */
function infer(v) {
  if (v === null || v === undefined) return { k: "null" };
  if (Array.isArray(v)) { let t = null; for (const x of v) t = t ? merge(t, infer(x)) : infer(x); return { k: "arr", of: t || { k: "any" } }; }
  if (isObj(v)) { const props = {}; for (const k of Object.keys(v)) props[k] = { t: infer(v[k]), opt: false }; return { k: "obj", props }; }
  if (typeof v === "string") return { k: "str" };
  if (typeof v === "boolean") return { k: "bool" };
  return { k: Number.isInteger(v) ? "int" : "num" };
}
function merge(a, b) {
  const nul = !!(a.nullable || b.nullable);
  if (a.k === b.k) {
    if (a.k === "arr") return { k: "arr", of: merge(a.of, b.of), nullable: nul };
    if (a.k === "obj") {
      const props = {}, keys = new Set(Object.keys(a.props).concat(Object.keys(b.props)));
      keys.forEach(k => { const x = a.props[k], y = b.props[k]; props[k] = x && y ? { t: merge(x.t, y.t), opt: x.opt || y.opt } : { t: (x || y).t, opt: true }; });
      return { k: "obj", props, nullable: nul };
    }
    return Object.assign({}, a, { nullable: nul });
  }
  if (a.k === "null") return Object.assign({}, b, { nullable: true });
  if (b.k === "null") return Object.assign({}, a, { nullable: true });
  if ((a.k === "int" && b.k === "num") || (a.k === "num" && b.k === "int")) return { k: "num", nullable: nul };
  return { k: "any" };
}
function schemaOf(t) {
  const w = s => { if (t.nullable && typeof s.type === "string") s.type = [s.type, "null"]; return s; };
  switch (t.k) {
    case "str": return w({ type: "string" });
    case "int": return w({ type: "integer" });
    case "num": return w({ type: "number" });
    case "bool": return w({ type: "boolean" });
    case "null": return { type: "null" };
    case "arr": return w({ type: "array", items: schemaOf(t.of) });
    case "obj": { const props = {}, req = []; for (const k of Object.keys(t.props)) { props[k] = schemaOf(t.props[k].t); if (!t.props[k].opt) req.push(k); } const r = { type: "object", properties: props }; if (req.length) r.required = req; return w(r); }
  }
  return {};
}
const BOX = { int: "Integer", double: "Double", boolean: "Boolean" };
const LANG = {
  ts: { str: "string", int: "number", num: "number", bool: "boolean", any: "any", arr: x => x + "[]",
    emit: cs => cs.map(c => "export interface " + c.name + " {\n" + c.fields.map(f => "  " + (/^[A-Za-z_$][\w$]*$/.test(f.orig) ? f.orig : JSON.stringify(f.orig)) + (f.opt ? "?" : "") + ": " + f.type + (f.nul ? " | null" : "") + ";").join("\n") + "\n}").join("\n\n") + "\n" },
  go: { str: "string", int: "int", num: "float64", bool: "bool", any: "interface{}", arr: x => "[]" + x,
    emit: cs => "package main\n\n" + cs.map(c => "type " + c.name + " struct {\n" + c.fields.map(f => "\t" + idf(f.orig, pascal) + " " + (f.nul && !/^(\[\]|interface)/.test(f.type) ? "*" : "") + f.type + " `json:\"" + f.orig + (f.opt ? ",omitempty" : "") + "\"`").join("\n") + "\n}").join("\n\n") + "\n" },
  cs: { str: "string", int: "int", num: "double", bool: "bool", any: "object", arr: x => "List<" + x + ">",
    emit: cs => "using System.Collections.Generic;\nusing System.Text.Json.Serialization;\n\n" + cs.map(c => "public class " + c.name + "\n{\n" + c.fields.map(f => "    [JsonPropertyName(\"" + f.orig + "\")]\n    public " + f.type + (f.nul && /^(int|double|bool)$/.test(f.type) ? "?" : "") + " " + idf(f.orig, pascal) + " { get; set; }").join("\n\n") + "\n}").join("\n\n") + "\n" },
  java: { str: "String", int: "int", num: "double", bool: "boolean", any: "Object", arr: x => "List<" + (BOX[x] || x) + ">",
    emit: cs => "import java.util.List;\n\n" + cs.map((c, i) => (i ? "" : "public ") + "class " + c.name + " {\n" + c.fields.map(f => "    public " + (f.nul ? (BOX[f.type] || f.type) : f.type) + " " + idf(f.orig, camel) + ";").join("\n") + "\n}").join("\n\n") + "\n" },
  kt: { str: "String", int: "Int", num: "Double", bool: "Boolean", any: "Any", arr: x => "List<" + x + ">",
    emit: cs => cs.map(c => "data class " + c.name + "(\n" + c.fields.map(f => "    val " + idf(f.orig, camel) + ": " + f.type + ((f.opt || f.nul) ? "?" : "") + (f.opt ? " = null" : "")).join(",\n") + "\n)").join("\n\n") + "\n" },
  py: { str: "str", int: "int", num: "float", bool: "bool", any: "Any", arr: x => "List[" + x + "]",
    emit: cs => "from dataclasses import dataclass\nfrom typing import Any, List, Optional\n\n\n" + cs.map(c => "@dataclass\nclass " + c.name + ":\n" + (c.fields.length ? c.fields.slice().sort((a, b) => (a.opt ? 1 : 0) - (b.opt ? 1 : 0)).map(f => "    " + idf(f.orig, snake) + ": " + ((f.opt || f.nul) ? "Optional[" + f.type + "] = None" : f.type)).join("\n") : "    pass")).join("\n\n\n") + "\n" },
  rust: { str: "String", int: "i64", num: "f64", bool: "bool", any: "serde_json::Value", arr: x => "Vec<" + x + ">",
    emit: cs => "use serde::{Deserialize, Serialize};\n\n" + cs.map(c => "#[derive(Debug, Serialize, Deserialize)]\npub struct " + c.name + " {\n" + c.fields.map(f => { const n = idf(f.orig, snake); return (n !== f.orig ? "    #[serde(rename = \"" + f.orig + "\")]\n" : "") + "    pub " + n + ": " + ((f.opt || f.nul) ? "Option<" + f.type + ">" : f.type) + ","; }).join("\n") + "\n}").join("\n\n") + "\n" }
};
function genCode(lang, v, rootName) {
  let t = infer(v);
  while (t.k === "arr") t = t.of;
  if (t.k !== "obj") throw new Error("Code needs an object or a list of objects.");
  const L = LANG[lang], classes = [], used = {};
  const uniq = n => { const base = n || "Item"; let r = base, i = 1; while (used[r]) r = base + (++i); used[r] = 1; return r; };
  const sing = s => { const p = pascal(words(s)); return /ies$/i.test(p) && p.length > 4 ? p.slice(0, -3) + "y" : (/[^s]s$/i.test(p) && p.length > 3 ? p.slice(0, -1) : p); };
  const tn = (t, hint, single) => {
    switch (t.k) {
      case "str": return L.str;
      case "int": return L.int;
      case "num": return L.num;
      case "bool": return L.bool;
      case "arr": return L.arr(tn(t.of, hint, true));
      case "obj": return mk(t, single ? sing(hint) : pascal(words(hint)));
      default: return L.any;
    }
  };
  const mk = (t, hint) => {
    const name = uniq(hint || "Item");
    const fields = Object.keys(t.props).map(k => { const p = t.props[k]; return { orig: k, type: tn(p.t, k, false), opt: p.opt, nul: !!p.t.nullable }; });
    classes.push({ name, fields }); return name;
  };
  mk(t, pascal(words(rootName)) || "Root");
  classes.reverse();
  return L.emit(classes);
}
function lit(v, c, ind, l) {
  const pad = ind.repeat(l + 1), end = ind.repeat(l), nl = ind ? "\n" : "", sep = ind ? "\n" : " ";
  if (v === null || v === undefined) return c.nul;
  if (typeof v === "boolean") return v ? c.t : c.f;
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return c.str(v);
  if (Array.isArray(v)) { if (!v.length) return c.ao + c.ac; return c.ao + nl + v.map(x => pad + lit(x, c, ind, l + 1)).join("," + sep) + nl + end + c.ac; }
  const ks = Object.keys(v);
  if (!ks.length) return c.oo + c.oc;
  return c.oo + nl + ks.map(k => pad + c.key(k) + c.sep + lit(v[k], c, ind, l + 1)).join("," + sep) + nl + end + c.oc;
}
const phpStr = s => "'" + s.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
const LIT = {
  js: { nul: "null", t: "true", f: "false", str: JSON.stringify, ao: "[", ac: "]", oo: "{", oc: "}", key: k => /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k), sep: ": " },
  php: { nul: "null", t: "true", f: "false", str: phpStr, ao: "[", ac: "]", oo: "[", oc: "]", key: phpStr, sep: " => " },
  py: { nul: "None", t: "True", f: "False", str: JSON.stringify, ao: "[", ac: "]", oo: "{", oc: "}", key: JSON.stringify, sep: ": " },
  rb: { nul: "nil", t: "true", f: "false", str: JSON.stringify, ao: "[", ac: "]", oo: "{", oc: "}", key: JSON.stringify, sep: " => " }
};

/* ---------- text tools ---------- */
function b64(u) { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(s) {
  s = s.replace(/^data:[^,]*,/, "").replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  let bin; try { bin = atob(s); } catch (e) { throw new Error("This is not valid Base64."); }
  const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u;
}
const MORSE = { A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..", 0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-", 5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----.", ".": ".-.-.-", ",": "--..--", "?": "..--..", "'": ".----.", "!": "-.-.--", "/": "-..-.", "(": "-.--.", ")": "-.--.-", "&": ".-...", ":": "---...", ";": "-.-.-.", "=": "-...-", "+": ".-.-.", "-": "-....-", "_": "..--.-", '"': ".-..-.", "$": "...-..-", "@": ".--.-." };
const MORSE_REV = {}; Object.keys(MORSE).forEach(k => MORSE_REV[MORSE[k]] = k);
function md5(u) {
  const K = [], S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
  const n = u.length, total = (((n + 8) >> 6) + 1) << 6;
  const buf = new Uint8Array(total); buf.set(u); buf[n] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 8, (n << 3) >>> 0, true); dv.setUint32(total - 4, Math.floor(n / 536870912), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let o = 0; o < total; o += 64) {
    const M = []; for (let j = 0; j < 16; j++) M[j] = dv.getUint32(o + j * 4, true);
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D; D = C; C = B;
      const s = S[(i >> 4) * 4 + (i & 3)];
      B = (B + ((F << s) | (F >>> (32 - s)))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const r = new DataView(new ArrayBuffer(16));
  r.setUint32(0, a0, true); r.setUint32(4, b0, true); r.setUint32(8, c0, true); r.setUint32(12, d0, true);
  return hex(new Uint8Array(r.buffer));
}
function crc32(u) {
  let c, crc = -1;
  for (let i = 0; i < u.length; i++) { c = (crc ^ u[i]) & 255; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; crc = (crc >>> 8) ^ c; }
  return ((crc ^ -1) >>> 0).toString(16).padStart(8, "0");
}
async function sha(alg, u) {
  if (!(window.crypto && crypto.subtle)) throw new Error("Your browser blocks secure hashing on this address. Open the site with https:// or http://localhost.");
  return hex(new Uint8Array(await crypto.subtle.digest(alg, u)));
}
function xmlPretty(s, I) {
  s = s.replace(/>\s+</g, "><").trim();
  const parts = s.replace(/(>)(<)(\/*)/g, "$1\n$2$3").split("\n"); let lvl = 0;
  return parts.map(p => {
    if (/^<\/\w/.test(p)) lvl = Math.max(lvl - 1, 0);
    const r = I.repeat(lvl) + p;
    if (/^<[^\/!?][^>]*>$/.test(p) && !/\/>$/.test(p)) lvl++;
    return r;
  }).join("\n") + "\n";
}
const VOID = new Set("area base br col embed hr img input link meta param source track wbr".split(" "));
function htmlPretty(s, I) {
  const toks = s.match(/<(script|style)\b[\s\S]*?<\/\1\s*>|<!--[\s\S]*?-->|<[^>]+>|[^<]+/gi) || [];
  const out = []; let lvl = 0;
  for (let i = 0; i < toks.length; i++) {
    let t = toks[i];
    if (!/^</.test(t)) { t = t.trim().replace(/\s+/g, " "); if (t) out.push(I.repeat(lvl) + t); continue; }
    const m = /^<\/?([a-zA-Z][\w:-]*)/.exec(t);
    if (!m || /^<!--/.test(t) || /^<(script|style)\b/i.test(t) || /^<!/.test(t)) { out.push(I.repeat(lvl) + t.trim()); continue; }
    const name = m[1].toLowerCase();
    if (t[1] === "/") { lvl = Math.max(0, lvl - 1); out.push(I.repeat(lvl) + t); continue; }
    if (VOID.has(name) || /\/>$/.test(t)) { out.push(I.repeat(lvl) + t); continue; }
    const nx = toks[i + 1], nn = toks[i + 2];
    if (nx && nn && !/^</.test(nx) && nx.trim() && nx.length < 120 && !/\n/.test(nx.trim()) && new RegExp("^</" + name + "\\s*>$", "i").test(nn.trim())) { out.push(I.repeat(lvl) + t + nx.trim() + nn.trim()); i += 2; continue; }
    out.push(I.repeat(lvl) + t); lvl++;
  }
  return out.join("\n") + "\n";
}
function cssPretty(s, I) {
  s = s.replace(/\s+/g, " ").replace(/\s*\{\s*/g, " {\n").replace(/\s*;\s*/g, ";\n").replace(/\s*\}\s*/g, "\n}\n");
  let lvl = 0; const out = [];
  s.split("\n").forEach(l => { l = l.trim(); if (!l) return; if (l[0] === "}") lvl = Math.max(0, lvl - 1); out.push(I.repeat(lvl) + l); if (l.endsWith("{")) lvl++; if (l === "}" && lvl === 0) out.push(""); });
  return out.join("\n").trim() + "\n";
}
const cssMin = s => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{};:,>])\s*/g, "$1").replace(/;}/g, "}").trim() + "\n";
function jsClean(s) {
  let o = "", i = 0; const n = s.length;
  while (i < n) {
    const c = s[i], d = s[i + 1];
    if (c === "'" || c === '"' || c === "`") { let j = i + 1; while (j < n && s[j] !== c) { if (s[j] === "\\") j++; j++; } o += s.slice(i, j + 1); i = j + 1; continue; }
    if (c === "/" && d === "/") { while (i < n && s[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") { const e = s.indexOf("*/", i + 2); i = e < 0 ? n : e + 2; continue; }
    o += c; i++;
  }
  return o.split("\n").map(l => l.replace(/[ \t]+$/, "")).filter(l => l.trim()).join("\n") + "\n";
}
function sqlPretty(s) {
  s = s.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim();
  const kw = "SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT|OFFSET|UNION ALL|UNION|VALUES|SET|INSERT INTO|UPDATE|DELETE FROM|LEFT JOIN|RIGHT JOIN|INNER JOIN|FULL JOIN|CROSS JOIN|JOIN|ON|AND|OR|CREATE TABLE";
  s = s.replace(new RegExp("\\b(" + kw + ")\\b", "gi"), m => "\n" + m.toUpperCase()).replace(/;\s*/g, ";\n");
  return s.split("\n").map(l => l.trim()).filter(Boolean).map(l => /^(AND|OR|ON)\b/.test(l) ? "  " + l : l).join("\n") + "\n";
}
const sqlMin = s => s.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim() + "\n";
function mdHtml(src) {
  const L = src.replace(/\r/g, "").split("\n"), out = []; let i = 0;
  const inl = s => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>').replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (m, a, b) => "<strong>" + (a || b) + "</strong>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>").replace(/~~([^~]+)~~/g, "<del>$1</del>");
  const LI = /^\s*([-*+]|\d+\.)\s+/;
  while (i < L.length) {
    const l = L[i]; let m;
    if (!l.trim()) { i++; continue; }
    if (/^```/.test(l)) { const code = []; i++; while (i < L.length && !/^```/.test(L[i])) code.push(L[i++]); i++; out.push("<pre><code>" + esc(code.join("\n")) + "</code></pre>"); continue; }
    if ((m = /^(#{1,6})\s+(.*?)\s*#*$/.exec(l))) { out.push("<h" + m[1].length + ">" + inl(m[2]) + "</h" + m[1].length + ">"); i++; continue; }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) { out.push("<hr>"); i++; continue; }
    if (/^>/.test(l)) { const q = []; while (i < L.length && /^>/.test(L[i])) q.push(L[i++].replace(/^>\s?/, "")); out.push("<blockquote>" + mdHtml(q.join("\n")) + "</blockquote>"); continue; }
    if (/\|/.test(l) && /^\s*\|?\s*:?-{2,}/.test(L[i + 1] || "")) {
      const cells = r => r.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
      const head = cells(l); i += 2; const rows = [];
      while (i < L.length && L[i].trim() && /\|/.test(L[i])) rows.push(cells(L[i++]));
      out.push("<table>\n<thead><tr>" + head.map(h => "<th>" + inl(h) + "</th>").join("") + "</tr></thead>\n<tbody>\n" + rows.map(r => "<tr>" + r.map(c => "<td>" + inl(c) + "</td>").join("") + "</tr>").join("\n") + "\n</tbody>\n</table>"); continue;
    }
    if (LI.test(l)) { const ord = /^\s*\d+\./.test(l), items = []; while (i < L.length && LI.test(L[i])) items.push(L[i++].replace(LI, "")); const tg = ord ? "ol" : "ul"; out.push("<" + tg + ">\n" + items.map(x => "<li>" + inl(x) + "</li>").join("\n") + "\n</" + tg + ">"); continue; }
    const p = [];
    while (i < L.length && L[i].trim() && !/^(```|#{1,6}\s|>)/.test(L[i]) && !LI.test(L[i])) p.push(L[i++]);
    if (!p.length) p.push(L[i++]);
    out.push("<p>" + inl(p.join(" ")) + "</p>");
  }
  return out.join("\n");
}
function htmlMd(src) {
  const d = new DOMParser().parseFromString(src, "text/html");
  d.querySelectorAll("script,style,head").forEach(n => n.remove());
  const kids = n => Array.from(n.childNodes).map(walk).join("");
  function walk(n) {
    if (n.nodeType === 3) return n.textContent.replace(/\s+/g, " ");
    if (n.nodeType !== 1) return "";
    const tag = n.tagName.toLowerCase();
    switch (tag) {
      case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": return "\n\n" + "#".repeat(+tag[1]) + " " + kids(n).trim() + "\n\n";
      case "p": case "div": case "section": case "article": case "header": case "footer": case "main": return "\n\n" + kids(n).trim() + "\n\n";
      case "br": return "  \n";
      case "hr": return "\n\n---\n\n";
      case "strong": case "b": return "**" + kids(n).trim() + "**";
      case "em": case "i": return "*" + kids(n).trim() + "*";
      case "del": case "s": return "~~" + kids(n).trim() + "~~";
      case "code": return n.parentNode && n.parentNode.tagName === "PRE" ? n.textContent : "`" + n.textContent + "`";
      case "pre": return "\n\n```\n" + n.textContent.replace(/\n$/, "") + "\n```\n\n";
      case "a": return "[" + kids(n).trim() + "](" + (n.getAttribute("href") || "") + ")";
      case "img": return "![" + (n.getAttribute("alt") || "") + "](" + (n.getAttribute("src") || "") + ")";
      case "blockquote": return "\n\n" + kids(n).trim().split("\n").map(x => "> " + x).join("\n") + "\n\n";
      case "ul": case "ol": {
        let k = 0;
        return "\n\n" + Array.from(n.children).filter(c => c.tagName === "LI").map(li => {
          k++;
          const body = kids(li).trim().replace(/\n{2,}/g, "\n").split("\n").map((x, j) => j ? "  " + x : x).join("\n");
          return (tag === "ol" ? k + ". " : "- ") + body;
        }).join("\n") + "\n\n";
      }
      case "table": {
        const rows = Array.from(n.querySelectorAll("tr")).map(tr => Array.from(tr.children).map(c => c.textContent.trim().replace(/\s+/g, " ")));
        return rows.length ? "\n\n" + mdTable(rows) + "\n" : "";
      }
      default: return kids(n);
    }
  }
  return walk(d.body).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
function colorLine(l) {
  let r, g, b, m;
  if ((m = /^#?([0-9a-f]{6})$/i.exec(l))) { const n = parseInt(m[1], 16); r = n >> 16; g = (n >> 8) & 255; b = n & 255; }
  else if ((m = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(l))) { r = parseInt(m[1] + m[1], 16); g = parseInt(m[2] + m[2], 16); b = parseInt(m[3] + m[3], 16); }
  else if ((m = /^rgb\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*\)$/i.exec(l))) { r = +m[1]; g = +m[2]; b = +m[3]; }
  else return l + "  →  (not a colour)";
  const R = r / 255, G = g / 255, B = b / 255, mx = Math.max(R, G, B), mn = Math.min(R, G, B), dl = mx - mn;
  let h = 0, s = 0; const lt = (mx + mn) / 2;
  if (dl) { s = dl / (1 - Math.abs(2 * lt - 1)); h = mx === R ? ((G - B) / dl) % 6 : mx === G ? (B - R) / dl + 2 : (R - G) / dl + 4; h = Math.round(h * 60); if (h < 0) h += 360; }
  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("") + "  |  rgb(" + r + ", " + g + ", " + b + ")  |  hsl(" + h + ", " + Math.round(s * 100) + "%, " + Math.round(lt * 100) + "%)";
}

/* ---------- list of outputs ---------- */
const GROUPS = ["Data formats", "Code generators", "Encode & decode", "Hashes & checksums", "Format & clean", "Text case", "Text tools"];
const OUTS = [];
const add = (g, id, label, ext, fn) => OUTS.push({ g, id, label, ext, fn });
const jstr = (x, i) => { if (x === undefined) throw new Error("No data was found."); return JSON.stringify(x, null, i) + "\n"; };
const D = "Data formats";
add(D, "json", "JSON", ".json", async c => jstr(await c.val(), c.o.ind));
add(D, "jsonmin", "JSON (minified)", ".json", async c => jstr(await c.val()));
add(D, "jsonsort", "JSON (keys sorted A–Z)", ".json", async c => jstr(sortKeys(await c.val()), c.o.ind));
add(D, "yaml", "YAML", ".yaml", async c => { const v = await c.val(), y = await loadYaml(); return y.dump(v, { indent: c.o.ind.length > 1 && c.o.ind[0] === " " ? c.o.ind.length : 2, lineWidth: -1, noRefs: true }); });
add(D, "xml", "XML", ".xml", async c => xmlOut(await c.val(), c.o));
add(D, "csv", "CSV (comma)", ".csv", async c => csvOut(await c.val(), ",", c.o));
add(D, "tsv", "TSV (tab)", ".tsv", async c => csvOut(await c.val(), "\t", c.o));
add(D, "toml", "TOML", ".toml", async c => tomlOut(await c.val()));
add(D, "ini", "INI", ".ini", async c => iniOut(await c.val()));
add(D, "props", ".properties (Java)", ".properties", async c => propsOut(await c.val()));
add(D, "env", ".env file", ".env", async c => envOut(await c.val()));
add(D, "ndjson", "JSON Lines (NDJSON)", ".ndjson", async c => { const l = findList(await c.val()); return (Array.isArray(l) ? l.map(x => JSON.stringify(x)).join("\n") : JSON.stringify(l)) + "\n"; });
add(D, "htmltable", "HTML table", ".html", async c => htmlTableOut(await c.val(), c.o));
add(D, "mdtable", "Markdown table", ".md", async c => mdTable(tableRows(await c.val())));
add(D, "sql", "SQL INSERT statements", ".sql", async c => sqlOut(await c.val(), c.o, false));
add(D, "sqlfull", "SQL CREATE TABLE + INSERT", ".sql", async c => sqlOut(await c.val(), c.o, true));
const G = "Code generators";
[["ts", "TypeScript interfaces", ".ts"], ["go", "Go structs", ".go"], ["cs", "C# classes", ".cs"], ["java", "Java classes", ".java"], ["kt", "Kotlin data classes", ".kt"], ["py", "Python dataclasses", ".py"], ["rust", "Rust structs (serde)", ".rs"]].forEach(a => add(G, "code_" + a[0], a[1], a[2], async c => genCode(a[0], await c.val(), c.o.name || "Root")));
add(G, "schema", "JSON Schema", ".json", async c => { let t = infer(await c.val()); return jstr(Object.assign({ $schema: "http://json-schema.org/draft-07/schema#" }, schemaOf(t)), c.o.ind); });
add(G, "jsobj", "JavaScript object", ".js", async c => "const data = " + lit(await c.val(), LIT.js, c.o.ind, 0) + ";\n");
add(G, "php", "PHP array", ".php", async c => "<?php\n\nreturn " + lit(await c.val(), LIT.php, c.o.ind, 0) + ";\n");
add(G, "pyd", "Python dict", ".py", async c => "data = " + lit(await c.val(), LIT.py, c.o.ind, 0) + "\n");
add(G, "rb", "Ruby hash", ".rb", async c => "data = " + lit(await c.val(), LIT.rb, c.o.ind, 0) + "\n");
const E = "Encode & decode";
add(E, "b64e", "Text / file → Base64", ".txt", c => b64(c.bytes()));
add(E, "b64d", "Base64 → text", ".txt", c => dec(unb64(c.text())));
add(E, "b64ue", "Text / file → Base64 URL-safe", ".txt", c => b64(c.bytes()).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
add(E, "b64ud", "Base64 URL-safe → text", ".txt", c => dec(unb64(c.text())));
add(E, "datauri", "File / text → Data URI", ".txt", c => "data:" + (c.mime() || "text/plain;charset=utf-8") + ";base64," + b64(c.bytes()));
add(E, "urle", "Text → URL encoded", ".txt", c => encodeURIComponent(c.text()));
add(E, "urld", "URL encoded → text", ".txt", c => { try { return decodeURIComponent(c.text().replace(/\+/g, " ")); } catch (e) { throw new Error("This is not valid URL-encoded text."); } });
add(E, "ente", "Text → HTML entities", ".txt", c => c.text().replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])).replace(/[^\x00-\x7F]/gu, ch => "&#" + ch.codePointAt(0) + ";"));
add(E, "entd", "HTML entities → text", ".txt", c => { const t = document.createElement("textarea"); t.innerHTML = c.text(); return t.value; });
add(E, "hexe", "Text → Hex", ".txt", c => Array.from(c.bytes(), b => b.toString(16).padStart(2, "0")).join(" "));
add(E, "hexd", "Hex → text", ".txt", c => { const h = c.text().replace(/0x|\\x/gi, " ").replace(/[^0-9a-f]/gi, ""); if (h.length % 2) throw new Error("The hex text has an odd number of digits."); const u = new Uint8Array(h.length / 2); for (let i = 0; i < u.length; i++) u[i] = parseInt(h.substr(i * 2, 2), 16); return dec(u); });
add(E, "bine", "Text → Binary (0 and 1)", ".txt", c => Array.from(c.bytes(), b => b.toString(2).padStart(8, "0")).join(" "));
add(E, "bind", "Binary (0 and 1) → text", ".txt", c => { const s = c.text().replace(/[^01]/g, ""); if (s.length % 8) throw new Error("Binary text must be in groups of 8 digits."); const u = new Uint8Array(s.length / 8); for (let i = 0; i < u.length; i++) u[i] = parseInt(s.substr(i * 8, 8), 2); return dec(u); });
add(E, "ue", "Text → Unicode escapes (\\uXXXX)", ".txt", c => c.text().replace(/[^\x00-\x7e]/g, ch => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0")));
add(E, "ud", "Unicode escapes (\\uXXXX) → text", ".txt", c => c.text().replace(/\\u\{([0-9a-fA-F]+)\}/g, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16))));
add(E, "jsone", "Text → JSON string (escaped)", ".txt", c => JSON.stringify(c.text()));
add(E, "jsond", "JSON string → plain text", ".txt", c => { let s = c.text().trim(); if (!(s[0] === '"' && s.endsWith('"') && s.length > 1)) s = '"' + s.replace(/\n/g, "\\n") + '"'; try { return JSON.parse(s); } catch (e) { throw new Error("This is not a valid JSON string."); } });
add(E, "rot13", "Text → ROT13", ".txt", c => c.text().replace(/[a-z]/gi, ch => { const b = ch <= "Z" ? 65 : 97; return String.fromCharCode((ch.charCodeAt(0) - b + 13) % 26 + b); }));
add(E, "morsee", "Text → Morse code", ".txt", c => c.text().toUpperCase().split(/\r?\n/).map(l => l.split(/\s+/).filter(Boolean).map(w => Array.from(w).map(ch => MORSE[ch] || "?").join(" ")).join(" / ")).join("\n"));
add(E, "morsed", "Morse code → text", ".txt", c => c.text().split(/\r?\n/).map(l => l.trim().split(/\s*\/\s*|\s{3,}/).map(w => w.split(/\s+/).filter(Boolean).map(s => MORSE_REV[s] || "?").join("")).join(" ")).join("\n"));
add(E, "jwt", "JWT token → decoded JSON", ".json", c => { const p = c.text().trim().split("."); if (p.length < 2) throw new Error("This does not look like a JWT (it needs 2 or 3 parts split by dots)."); let h, b; try { h = JSON.parse(dec(unb64(p[0]))); b = JSON.parse(dec(unb64(p[1]))); } catch (e) { throw new Error("The JWT parts are not valid."); } const r = { header: h, payload: b }; if (typeof b.exp === "number") r.expires_at = new Date(b.exp * 1000).toISOString(); if (typeof b.iat === "number") r.issued_at = new Date(b.iat * 1000).toISOString(); if (p[2]) r.signature = p[2]; return jstr(r, "  "); });
const H = "Hashes & checksums";
add(H, "md5", "MD5", ".txt", c => md5(c.bytes()));
add(H, "sha1", "SHA-1", ".txt", c => sha("SHA-1", c.bytes()));
add(H, "sha256", "SHA-256", ".txt", c => sha("SHA-256", c.bytes()));
add(H, "sha384", "SHA-384", ".txt", c => sha("SHA-384", c.bytes()));
add(H, "sha512", "SHA-512", ".txt", c => sha("SHA-512", c.bytes()));
add(H, "crc32", "CRC32", ".txt", c => crc32(c.bytes()));
add(H, "allhash", "All hashes at once", ".txt", async c => { const u = c.bytes(); return "MD5:     " + md5(u) + "\nSHA-1:   " + await sha("SHA-1", u) + "\nSHA-256: " + await sha("SHA-256", u) + "\nSHA-384: " + await sha("SHA-384", u) + "\nSHA-512: " + await sha("SHA-512", u) + "\nCRC32:   " + crc32(u) + "\n"; });
const F = "Format & clean";
add(F, "xmlpretty", "XML – beautify", ".xml", c => xmlPretty(c.text(), c.o.ind));
add(F, "xmlmin", "XML – minify", ".xml", c => c.text().replace(/<!--[\s\S]*?-->/g, "").replace(/>\s+</g, "><").trim() + "\n");
add(F, "htmlpretty", "HTML – beautify", ".html", c => htmlPretty(c.text(), c.o.ind));
add(F, "htmlmin", "HTML – minify (basic)", ".html", c => c.text().replace(/<!--[\s\S]*?-->/g, "").replace(/>\s+</g, "><").replace(/\s{2,}/g, " ").trim() + "\n");
add(F, "csspretty", "CSS – beautify", ".css", c => cssPretty(c.text(), c.o.ind));
add(F, "cssmin", "CSS – minify", ".css", c => cssMin(c.text()));
add(F, "jsclean", "JavaScript – remove comments & blank lines", ".js", c => jsClean(c.text()));
add(F, "sqlpretty", "SQL – beautify (basic)", ".sql", c => sqlPretty(c.text()));
add(F, "sqlmin", "SQL – minify (basic)", ".sql", c => sqlMin(c.text()));
add(F, "md2html", "Markdown → HTML", ".html", c => mdHtml(c.text()) + "\n");
add(F, "html2md", "HTML → Markdown", ".md", c => htmlMd(c.text()));
const T = "Text case";
add(T, "upper", "UPPER CASE", ".txt", c => c.text().toUpperCase());
add(T, "lower", "lower case", ".txt", c => c.text().toLowerCase());
add(T, "title", "Title Case", ".txt", c => c.text().toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()));
add(T, "sentence", "Sentence case", ".txt", c => c.text().toLowerCase().replace(/(^\s*|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase()));
add(T, "camel", "camelCase", ".txt", c => perLine(c.text(), camel));
add(T, "pascal", "PascalCase", ".txt", c => perLine(c.text(), pascal));
add(T, "snake", "snake_case", ".txt", c => perLine(c.text(), snake));
add(T, "kebab", "kebab-case", ".txt", c => perLine(c.text(), kebab));
add(T, "constant", "CONSTANT_CASE", ".txt", c => perLine(c.text(), constant));
add(T, "dotcase", "dot.case", ".txt", c => perLine(c.text(), dotc));
const X = "Text tools";
add(X, "sortaz", "Sort lines A → Z", ".txt", c => lines(c.text()).sort((a, b) => a.localeCompare(b)).join("\n"));
add(X, "sortza", "Sort lines Z → A", ".txt", c => lines(c.text()).sort((a, b) => b.localeCompare(a)).join("\n"));
add(X, "uniq", "Remove duplicate lines", ".txt", c => Array.from(new Set(lines(c.text()))).join("\n"));
add(X, "revlines", "Reverse order of lines", ".txt", c => lines(c.text()).reverse().join("\n"));
add(X, "noempty", "Remove empty lines", ".txt", c => lines(c.text()).filter(l => l.trim()).join("\n"));
add(X, "trimlines", "Trim spaces on every line", ".txt", c => lines(c.text()).map(l => l.trim()).join("\n"));
add(X, "numlines", "Number the lines", ".txt", c => lines(c.text()).map((l, i) => (i + 1) + ". " + l).join("\n"));
add(X, "joincomma", "Lines → comma separated", ".txt", c => lines(c.text()).map(l => l.trim()).filter(Boolean).join(", "));
add(X, "splitcomma", "Comma separated → lines", ".txt", c => c.text().split(/\s*,\s*/).join("\n"));
add(X, "revtext", "Reverse the text", ".txt", c => Array.from(c.text()).reverse().join(""));
add(X, "slug", "Text → URL slug", ".txt", c => lines(c.text()).map(l => l.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")).join("\n"));
add(X, "count", "Count words & characters", ".txt", c => { const t = c.text(); const w = t.trim().split(/\s+/).filter(Boolean).length; return "Characters: " + t.length + "\nCharacters (no spaces): " + t.replace(/\s/g, "").length + "\nWords: " + w + "\nLines: " + lines(t).length + "\nSentences: " + (t.match(/[.!?]+(\s|$)/g) || []).length + "\nBytes (UTF-8): " + enc(t).length + "\n"; });
add(X, "urls", "Extract all URLs", ".txt", c => Array.from(new Set(c.text().match(/https?:\/\/[^\s"'<>)\]]+/g) || [])).join("\n") || "No URLs found.");
add(X, "emails", "Extract all email addresses", ".txt", c => Array.from(new Set(c.text().match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || [])).join("\n") || "No email addresses found.");
add(X, "ts2date", "Unix timestamp → date", ".txt", c => lines(c.text()).map(l => { const s = l.trim(); if (!s) return ""; if (!/^-?\d+(\.\d+)?$/.test(s)) return s + "  →  (not a number)"; let n = Number(s); if (Math.abs(n) < 1e11) n *= 1000; const d = new Date(n); return isNaN(d) ? s + "  →  (invalid)" : d.toISOString() + "  |  " + d.toString(); }).join("\n"));
add(X, "date2ts", "Date → Unix timestamp", ".txt", c => lines(c.text()).map(l => { const s = l.trim(); if (!s) return ""; const n = Date.parse(s); return isNaN(n) ? s + "  →  (cannot read this date)" : Math.floor(n / 1000) + " (seconds)  |  " + n + " (milliseconds)"; }).join("\n"));
add(X, "color", "Colour (HEX / RGB) → HEX, RGB, HSL", ".txt", c => lines(c.text()).map(l => l.trim() ? colorLine(l.trim()) : "").join("\n"));

/* ---------- page ---------- */
function injectStyle() {
  if (document.getElementById("dvStyle")) return;
  const s = document.createElement("style"); s.id = "dvStyle";
  s.textContent =
    ".dv-ta{width:100%;box-sizing:border-box;min-height:190px;padding:12px;border:1px solid var(--line);border-radius:8px;font:13px/1.5 Consolas,Menlo,monospace;background:#fff;color:var(--text);resize:vertical}" +
    ".dv-ta:focus{outline:2px solid var(--ac)}" +
    ".dv-ta:disabled{background:var(--soft);color:var(--muted)}" +
    ".dv-row{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:12px 0}" +
    ".dv-row>label{font-weight:600}" +
    ".dv-sel,.dv-inp{padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--text);font-size:15px;max-width:100%;box-sizing:border-box}" +
    ".dv-sel{min-width:280px}" +
    ".dv-chk{display:flex;gap:6px;align-items:center;font-weight:400}" +
    ".dv-or{margin:16px 0 6px;font-weight:600;color:var(--muted)}" +
    ".dv-info{color:var(--muted);font-size:14px}" +
    ".dv-hint{color:var(--muted);font-size:13px;margin:4px 0 0}" +
    ".dv-acts{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}";
  document.head.appendChild(s);
}

function build(sel) {
  const root = typeof sel === "string" ? $(sel) : sel;
  if (!root) return;
  injectStyle();
  root.innerHTML =
    '<div class="box">' +
      '<div class="drop-zone" id="dvDrop">' +
        '<div><strong>Drop a file here</strong></div>' +
        '<div>JSON, YAML, XML, CSV, TOML, SQL, HTML, Markdown, text – or any file for Hash / Base64</div>' +
        '<div><button type="button" class="big-btn" id="dvPick">Choose file</button></div>' +
      '</div>' +
      '<input type="file" id="dvFile" hidden>' +
      '<div class="dv-or">Or paste your text here:</div>' +
      '<textarea class="dv-ta" id="dvIn" spellcheck="false" placeholder="Paste JSON, YAML, XML, CSV, text ... here"></textarea>' +
      '<div class="dv-row"><span class="dv-info" id="dvInfo"></span><button type="button" class="btn alt" id="dvClear">Clear</button></div>' +
    '</div>' +
    '<div class="options-box">' +
      '<div class="dv-row"><label for="dvType">Input type:</label><select class="dv-sel" id="dvType"></select><span class="dv-info" id="dvDet"></span></div>' +
      '<div class="dv-row"><label for="dvOut">Select new format:</label><input class="dv-inp" id="dvSearch" placeholder="Search formats..." autocomplete="off"><select class="dv-sel" id="dvOut"></select></div>' +
      '<div class="dv-row">' +
        '<label for="dvInd">Indent:</label><select class="dv-sel" id="dvInd" style="min-width:0"><option value="2">2 spaces</option><option value="4">4 spaces</option><option value="tab">Tab</option></select>' +
        '<label class="dv-chk"><input type="checkbox" id="dvTypes" checked> Smart types (numbers, true/false)</label>' +
        '<label class="dv-chk"><input type="checkbox" id="dvHead" checked> First row is a header</label>' +
        '<input class="dv-inp" id="dvName" placeholder="Name (root / table / class)" style="width:220px">' +
      '</div>' +
      '<p class="dv-hint">Input type is detected for you. Change it only if the detection is wrong.</p>' +
      '<button type="button" class="convert-btn" id="dvGo">Convert</button>' +
    '</div>' +
    '<div id="dvMsg"></div>' +
    '<div class="result-area" id="dvRes" style="display:none">' +
      '<textarea class="dv-ta" id="dvResult" readonly spellcheck="false"></textarea>' +
      '<div class="dv-acts"><button type="button" class="btn" id="dvCopy">Copy</button><button type="button" class="btn" id="dvDl">Download</button><button type="button" class="btn alt" id="dvUse">Use result as input</button></div>' +
    '</div>';

  const ta = $("#dvIn", root), info = $("#dvInfo", root), det = $("#dvDet", root), typeSel = $("#dvType", root), outSel = $("#dvOut", root), msgBox = $("#dvMsg", root), res = $("#dvRes", root), resTa = $("#dvResult", root), goBtn = $("#dvGo", root), fileIn = $("#dvFile", root), drop = $("#dvDrop", root);
  const state = { file: null, name: "", bytes: null, bin: false, loaded: "", result: "", ext: ".txt" };

  typeSel.innerHTML = '<option value="auto">Auto-detect</option>' + IN_TYPES.map(a => '<option value="' + a[0] + '">' + esc(a[1]) + "</option>").join("");
  function renderOut(q) {
    q = (q || "").toLowerCase().trim();
    const keep = outSel.value; let h = "";
    GROUPS.forEach(g => {
      const items = OUTS.filter(d => d.g === g && (!q || d.label.toLowerCase().includes(q) || d.id.includes(q) || g.toLowerCase().includes(q)));
      if (items.length) h += '<optgroup label="' + esc(g) + '">' + items.map(d => '<option value="' + d.id + '">' + esc(d.label) + "</option>").join("") + "</optgroup>";
    });
    outSel.innerHTML = h || '<option value="">No match</option>';
    if (keep && outSel.querySelector('option[value="' + keep + '"]')) outSel.value = keep;
  }
  renderOut("");
  $("#dvSearch", root).addEventListener("input", e => renderOut(e.target.value));

  function msg(text, cls) { msgBox.innerHTML = text ? '<div class="msg' + (cls ? " " + cls : "") + '">' + esc(text) + "</div>" : ""; }
  function opts() {
    const i = $("#dvInd", root).value;
    return { ind: i === "tab" ? "\t" : " ".repeat(+i), types: $("#dvTypes", root).checked, header: $("#dvHead", root).checked, name: $("#dvName", root).value.trim() };
  }

  async function loadFile(f) {
    msg(""); res.style.display = "none";
    state.file = f; state.name = f.name;
    const buf = new Uint8Array(await f.arrayBuffer()); state.bytes = buf;
    let txt = null;
    try { if (!buf.subarray(0, 8192).includes(0)) txt = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch (e) { }
    if (txt === null) {
      state.bin = true; ta.value = ""; ta.disabled = true;
      ta.placeholder = "Binary file loaded. Only Hash, Base64 and Data URI work with this file.";
    } else {
      state.bin = false; ta.disabled = false; ta.placeholder = "";
      ta.value = txt.replace(/^\uFEFF/, ""); state.loaded = ta.value;
    }
    info.textContent = "File: " + f.name + " (" + fmtSize(f.size) + ")" + (state.bin ? " – binary file" : "");
    det.textContent = "";
  }
  function clearAll() {
    state.file = null; state.name = ""; state.bytes = null; state.bin = false; state.loaded = "";
    ta.disabled = false; ta.placeholder = "Paste JSON, YAML, XML, CSV, text ... here"; ta.value = "";
    info.textContent = ""; det.textContent = ""; fileIn.value = ""; msg(""); res.style.display = "none";
  }
  drop.addEventListener("click", () => fileIn.click());
  fileIn.addEventListener("change", () => { if (fileIn.files[0]) loadFile(fileIn.files[0]).catch(e => msg("Could not read this file. " + e.message, "err")); });
  ["dragover", "dragenter"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", e => { const f = e.dataTransfer.files[0]; if (f) loadFile(f).catch(er => msg("Could not read this file. " + er.message, "err")); });
  $("#dvClear", root).addEventListener("click", clearAll);
  ta.addEventListener("input", () => { if (state.file && ta.value !== state.loaded) info.textContent = "Text was edited."; });

  async function go() {
    msg("");
    const o = opts(), def = OUTS.find(d => d.id === outSel.value);
    if (!def) { msg("Please choose a format first.", "err"); return; }
    if (!state.bin && !ta.value.trim()) { msg("Add a file or paste some text first.", "err"); return; }
    const chosen = typeSel.value;
    const type = state.bin ? "text" : (chosen === "auto" ? detect(ta.value, state.name) : chosen);
    const tl = IN_TYPES.find(a => a[0] === type);
    det.textContent = chosen === "auto" && !state.bin ? (tl ? "Detected: " + tl[1] : "Detected: plain text") : "";
    const c = {
      o, type,
      text: () => { if (state.bin) throw new Error("This is a binary file. Only Hash, Base64 and Data URI can be used with it."); return ta.value; },
      bytes: () => (state.bin || (state.file && ta.value === state.loaded)) ? state.bytes : enc(ta.value),
      mime: () => state.file ? state.file.type : "",
      val: async () => { if (state.bin) throw new Error("This is a binary file. Only Hash, Base64 and Data URI can be used with it."); return getVal(type, ta.value, o); }
    };
    goBtn.disabled = true; goBtn.textContent = "Converting...";
    try {
      const r = await def.fn(c);
      if (typeof r !== "string") throw new Error("Nothing was produced.");
      state.result = r; state.ext = def.ext;
      const LIM = 2000000;
      resTa.value = r.length > LIM ? r.slice(0, LIM) : r;
      res.style.display = "";
      msg("Done. " + r.length.toLocaleString() + " characters." + (r.length > LIM ? " The preview is shortened – use Download or Copy for the full result." : ""));
    } catch (e) {
      res.style.display = "none";
      msg(e && e.message ? e.message : "Something went wrong.", "err");
    }
    goBtn.disabled = false; goBtn.textContent = "Convert";
  }
  goBtn.addEventListener("click", go);

  $("#dvCopy", root).addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(state.result); msg("Copied to clipboard."); }
    catch (e) { resTa.select(); document.execCommand("copy"); msg("Copied to clipboard."); }
  });
  $("#dvDl", root).addEventListener("click", () => {
    const base = (state.name || "converted").replace(/\.[^.]+$/, "") || "converted";
    const a = document.createElement("a"), url = URL.createObjectURL(new Blob([state.result], { type: "text/plain;charset=utf-8" }));
    a.href = url; a.download = base + state.ext; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  });
  $("#dvUse", root).addEventListener("click", () => {
    const r = state.result; clearAll(); ta.value = r; info.textContent = "Result moved to the input box."; window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
window.buildDevConverter = build;
})();
