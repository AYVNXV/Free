/* WebToolVault – Image Converter
   Everything runs in the browser. No file is uploaded.
   HEIC/HEIF and TIFF input load a small open-source library from jsDelivr, only when needed. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var CDN = {
    heic: 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js',
    tiff: 'https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.js'
  };
  var READABLE = /\.(jpe?g|jfif|jpe|png|apng|webp|avif|gif|bmp|dib|ico|cur|svg|heic|heif|tiff?)$/i;
  var MAX_PIXELS = 100e6;

  /* ---------- small helpers ---------- */
  function base(n) { return n.replace(/\.[^.]+$/, '') || 'image'; }
  function size(n) { return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB'; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  function tb(c, mime, q) {
    return new Promise(function (res, rej) {
      c.toBlob(function (b) {
        if (!b || b.type !== mime) rej(new Error('Your browser cannot create this format. Try Chrome or Edge.'));
        else res(b);
      }, mime, q);
    });
  }
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res;
      s.onerror = function () { rej(new Error('Could not load the helper library. Check your internet connection.')); };
      document.head.appendChild(s);
    });
  }
  function need(key, globalName) {
    if (window[globalName]) return Promise.resolve();
    return loadScript(CDN[key]).then(function () {
      if (!window[globalName]) throw new Error('Helper library did not start.');
    });
  }
  function canAvif() {
    try { var c = document.createElement('canvas'); c.width = c.height = 1; return c.toDataURL('image/avif').indexOf('data:image/avif') === 0; }
    catch (e) { return false; }
  }

  /* ---------- encoders (each returns a Blob) ---------- */
  function bmp(d, w, h) {
    var rs = (w * 3 + 3) & ~3, total = 54 + rs * h, b = new Uint8Array(total), v = new DataView(b.buffer);
    b[0] = 66; b[1] = 77;
    v.setUint32(2, total, true); v.setUint32(10, 54, true); v.setUint32(14, 40, true);
    v.setInt32(18, w, true); v.setInt32(22, h, true); v.setUint16(26, 1, true); v.setUint16(28, 24, true);
    v.setUint32(34, rs * h, true); v.setInt32(38, 2835, true); v.setInt32(42, 2835, true);
    for (var y = 0; y < h; y++) {
      var o = 54 + (h - 1 - y) * rs, s = y * w * 4;
      for (var x = 0; x < w; x++, s += 4, o += 3) { b[o] = d[s + 2]; b[o + 1] = d[s + 1]; b[o + 2] = d[s]; }
    }
    return new Blob([b], { type: 'image/bmp' });
  }

  function tiff(d, w, h) {
    var n = w * h * 4, off = 154, b = new Uint8Array(off + n), v = new DataView(b.buffer);
    b[0] = 73; b[1] = 73; v.setUint16(2, 42, true); v.setUint32(4, 8, true); v.setUint16(8, 11, true);
    var e = [[256, 4, 1, w], [257, 4, 1, h], [258, 3, 4, 146], [259, 3, 1, 1], [262, 3, 1, 2], [273, 4, 1, off],
             [277, 3, 1, 4], [278, 4, 1, h], [279, 4, 1, n], [284, 3, 1, 1], [338, 3, 1, 2]];
    for (var i = 0; i < e.length; i++) {
      var p = 10 + i * 12;
      v.setUint16(p, e[i][0], true); v.setUint16(p + 2, e[i][1], true); v.setUint32(p + 4, e[i][2], true);
      if (e[i][1] === 3 && e[i][0] !== 258) v.setUint16(p + 8, e[i][3], true); else v.setUint32(p + 8, e[i][3], true);
    }
    for (var k = 0; k < 4; k++) v.setUint16(146 + k * 2, 8, true);
    b.set(d, off);
    return new Blob([b], { type: 'image/tiff' });
  }

  function tga(d, w, h) {
    var b = new Uint8Array(18 + w * h * 4), v = new DataView(b.buffer);
    b[2] = 2; v.setUint16(12, w, true); v.setUint16(14, h, true); b[16] = 32; b[17] = 40;
    for (var i = 0, o = 18; i < d.length; i += 4, o += 4) { b[o] = d[i + 2]; b[o + 1] = d[i + 1]; b[o + 2] = d[i]; b[o + 3] = d[i + 3]; }
    return new Blob([b], { type: 'image/x-tga' });
  }

  function pnm(d, w, h, gray) {
    var hd = new TextEncoder().encode((gray ? 'P5' : 'P6') + '\n' + w + ' ' + h + '\n255\n'), n = w * h;
    var b = new Uint8Array(hd.length + n * (gray ? 1 : 3)), o = hd.length;
    b.set(hd);
    for (var i = 0, s = 0; i < n; i++, s += 4) {
      if (gray) b[o++] = (d[s] * 299 + d[s + 1] * 587 + d[s + 2] * 114) / 1000;
      else { b[o++] = d[s]; b[o++] = d[s + 1]; b[o++] = d[s + 2]; }
    }
    return new Blob([b], { type: 'image/x-portable-anymap' });
  }

  function qoi(d, w, h) {
    var out = new Uint8Array(14 + w * h * 5 + 8), o = 0, v = new DataView(out.buffer);
    out[0] = 113; out[1] = 111; out[2] = 105; out[3] = 102;
    v.setUint32(4, w); v.setUint32(8, h); out[12] = 4; out[13] = 0; o = 14;
    var idx = new Uint8Array(256), pr = 0, pg = 0, pb = 0, pa = 255, run = 0, n = w * h;
    for (var i = 0; i < n; i++) {
      var s = i * 4, r = d[s], g = d[s + 1], b = d[s + 2], a = d[s + 3];
      if (r === pr && g === pg && b === pb && a === pa) {
        run++;
        if (run === 62 || i === n - 1) { out[o++] = 0xC0 | (run - 1); run = 0; }
      } else {
        if (run > 0) { out[o++] = 0xC0 | (run - 1); run = 0; }
        var hi = ((r * 3 + g * 5 + b * 7 + a * 11) % 64) * 4;
        if (idx[hi] === r && idx[hi + 1] === g && idx[hi + 2] === b && idx[hi + 3] === a) {
          out[o++] = hi / 4;
        } else {
          idx[hi] = r; idx[hi + 1] = g; idx[hi + 2] = b; idx[hi + 3] = a;
          if (a === pa) {
            var dr = ((r - pr + 128) & 255) - 128, dg = ((g - pg + 128) & 255) - 128, db = ((b - pb + 128) & 255) - 128;
            var gr = dr - dg, gb = db - dg;
            if (dr >= -2 && dr <= 1 && dg >= -2 && dg <= 1 && db >= -2 && db <= 1) {
              out[o++] = 0x40 | ((dr + 2) << 4) | ((dg + 2) << 2) | (db + 2);
            } else if (dg >= -32 && dg <= 31 && gr >= -8 && gr <= 7 && gb >= -8 && gb <= 7) {
              out[o++] = 0x80 | (dg + 32); out[o++] = ((gr + 8) << 4) | (gb + 8);
            } else { out[o++] = 0xFE; out[o++] = r; out[o++] = g; out[o++] = b; }
          } else { out[o++] = 0xFF; out[o++] = r; out[o++] = g; out[o++] = b; out[o++] = a; }
        }
      }
      pr = r; pg = g; pb = b; pa = a;
    }
    out[o + 7] = 1; o += 8;
    return new Blob([out.subarray(0, o)], { type: 'image/qoi' });
  }

  /* GIF: single frame, median-cut palette, LZW */
  function lzw(idx) {
    var out = [], cur = 0, bits = 0, cs = 9, next = 258, dict = new Map();
    function put(c) { cur |= c << bits; bits += cs; while (bits >= 8) { out.push(cur & 255); cur >>>= 8; bits -= 8; } }
    put(256);
    var p = idx[0];
    for (var i = 1; i < idx.length; i++) {
      var k = idx[i], key = p * 256 + k, e = dict.get(key);
      if (e !== undefined) { p = e; }
      else {
        put(p);
        if (next < 4096) { dict.set(key, next++); if (next > (1 << cs) && cs < 12) cs++; }
        else { put(256); dict.clear(); next = 258; cs = 9; }
        p = k;
      }
    }
    put(p); put(257);
    if (bits > 0) out.push(cur & 255);
    return out;
  }
  function gif(d, w, h) {
    var n = w * h, hasT = false, i, hist = new Uint32Array(32768);
    for (i = 0; i < n; i++) {
      var s = i * 4;
      if (d[s + 3] < 128) { hasT = true; continue; }
      hist[((d[s] >> 3) << 10) | ((d[s + 1] >> 3) << 5) | (d[s + 2] >> 3)]++;
    }
    var maxc = hasT ? 255 : 256, cols = [];
    for (i = 0; i < 32768; i++) if (hist[i]) cols.push(i);
    var comp = function (k, ch) { return ch === 0 ? k >> 10 : ch === 1 ? (k >> 5) & 31 : k & 31; };
    var boxes = [cols];
    while (boxes.length < maxc) {
      var bi = -1, bs = 1;
      for (i = 0; i < boxes.length; i++) if (boxes[i].length > bs) { bs = boxes[i].length; bi = i; }
      if (bi < 0) break;
      var box = boxes[bi], ch = 0, best = -1;
      for (var c = 0; c < 3; c++) {
        var mn = 99, mx = -1;
        for (i = 0; i < box.length; i++) { var cv = comp(box[i], c); if (cv < mn) mn = cv; if (cv > mx) mx = cv; }
        if (mx - mn > best) { best = mx - mn; ch = c; }
      }
      box.sort(function (a, b) { return comp(a, ch) - comp(b, ch); });
      var tot = 0, acc = 0, cut = 1;
      for (i = 0; i < box.length; i++) tot += hist[box[i]];
      for (i = 0; i < box.length - 1; i++) { acc += hist[box[i]]; cut = i + 1; if (acc >= tot / 2) break; }
      boxes.splice(bi, 1, box.slice(0, cut), box.slice(cut));
    }
    var off = hasT ? 1 : 0, pal = new Uint8Array(768), lut = new Int16Array(32768);
    boxes.forEach(function (bx, j) {
      var rs = 0, gs = 0, bsum = 0, cnt = 0;
      bx.forEach(function (k) { var q = hist[k]; rs += (k >> 10) * q; gs += ((k >> 5) & 31) * q; bsum += (k & 31) * q; cnt += q; lut[k] = j + off; });
      var r5 = Math.round(rs / cnt), g5 = Math.round(gs / cnt), b5 = Math.round(bsum / cnt);
      pal[(j + off) * 3] = (r5 << 3) | (r5 >> 2); pal[(j + off) * 3 + 1] = (g5 << 3) | (g5 >> 2); pal[(j + off) * 3 + 2] = (b5 << 3) | (b5 >> 2);
    });
    var px = new Uint8Array(n);
    for (i = 0; i < n; i++) {
      var t = i * 4;
      px[i] = d[t + 3] < 128 ? 0 : lut[((d[t] >> 3) << 10) | ((d[t + 1] >> 3) << 5) | (d[t + 2] >> 3)];
    }
    var out = [71, 73, 70, 56, 57, 97, w & 255, w >> 8, h & 255, h >> 8, 0xF7, 0, 0];
    for (i = 0; i < 768; i++) out.push(pal[i]);
    if (hasT) out.push(0x21, 0xF9, 4, 1, 0, 0, 0, 0);
    out.push(0x2C, 0, 0, 0, 0, w & 255, w >> 8, h & 255, h >> 8, 0, 8);
    var data = lzw(px);
    for (var p = 0; p < data.length; p += 255) {
      var len = Math.min(255, data.length - p);
      out.push(len);
      for (var q2 = 0; q2 < len; q2++) out.push(data[p + q2]);
    }
    out.push(0, 0x3B);
    return new Blob([new Uint8Array(out)], { type: 'image/gif' });
  }

  /* ICO / CUR / ICNS: a PNG stored inside the icon container */
  function scaled(c, maxSide, square) {
    var s = Math.min(1, maxSide / Math.max(c.width, c.height)), w = Math.max(1, Math.round(c.width * s)), h = Math.max(1, Math.round(c.height * s));
    var t = document.createElement('canvas'), x;
    if (square) { t.width = t.height = maxSide; x = t.getContext('2d'); var f = maxSide / Math.max(c.width, c.height); w = Math.round(c.width * f); h = Math.round(c.height * f); x.drawImage(c, (maxSide - w) / 2, (maxSide - h) / 2, w, h); }
    else { t.width = w; t.height = h; t.getContext('2d').drawImage(c, 0, 0, w, h); }
    return t;
  }
  function pngBytes(c) { return tb(c, 'image/png').then(function (b) { return b.arrayBuffer(); }).then(function (a) { return new Uint8Array(a); }); }
  function icon(c, type) {
    var t = scaled(c, 256, false);
    return pngBytes(t).then(function (png) {
      var b = new Uint8Array(22 + png.length), v = new DataView(b.buffer);
      v.setUint16(2, type, true); v.setUint16(4, 1, true);
      b[6] = t.width >= 256 ? 0 : t.width; b[7] = t.height >= 256 ? 0 : t.height;
      v.setUint16(10, type === 1 ? 1 : 0, true); v.setUint16(12, type === 1 ? 32 : 0, true);
      v.setUint32(14, png.length, true); v.setUint32(18, 22, true);
      b.set(png, 22);
      return new Blob([b], { type: type === 1 ? 'image/x-icon' : 'image/x-win-bitmap' });
    });
  }
  function icns(c) {
    return pngBytes(scaled(c, 256, true)).then(function (png) {
      var b = new Uint8Array(16 + png.length), v = new DataView(b.buffer);
      b.set([105, 99, 110, 115], 0); v.setUint32(4, b.length);
      b.set([105, 99, 48, 56], 8); v.setUint32(12, 8 + png.length);
      b.set(png, 16);
      return new Blob([b], { type: 'image/icns' });
    });
  }

  function svg(c) {
    var u = c.toDataURL('image/png'), w = c.width, h = c.height;
    var s = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"><image width="' + w + '" height="' + h + '" href="' + u + '" xlink:href="' + u + '"/></svg>';
    return new Blob([s], { type: 'image/svg+xml' });
  }

  function pdf(c, q) {
    return tb(c, 'image/jpeg', q).then(function (b) { return b.arrayBuffer(); }).then(function (ab) {
      var jpg = new Uint8Array(ab), w = c.width, h = c.height, enc = new TextEncoder(), parts = [], len = 0, offs = [];
      var k = Math.min(0.75, 14400 / Math.max(w, h));
      var pw = (w * k).toFixed(2), ph = (h * k).toFixed(2);
      function add(x) { var u = typeof x === 'string' ? enc.encode(x) : x; parts.push(u); len += u.length; }
      add('%PDF-1.4\n');
      offs[1] = len; add('1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n');
      offs[2] = len; add('2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n');
      offs[3] = len; add('3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 ' + pw + ' ' + ph + ']/Resources<</XObject<</Im0 4 0 R>>>>/Contents 5 0 R>>\nendobj\n');
      offs[4] = len; add('4 0 obj\n<</Type/XObject/Subtype/Image/Width ' + w + '/Height ' + h + '/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ' + jpg.length + '>>\nstream\n');
      add(jpg); add('\nendstream\nendobj\n');
      var cs = 'q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /Im0 Do Q';
      offs[5] = len; add('5 0 obj\n<</Length ' + cs.length + '>>\nstream\n' + cs + '\nendstream\nendobj\n');
      var xr = len; add('xref\n0 6\n0000000000 65535 f \n');
      for (var i = 1; i <= 5; i++) add(('0000000000' + offs[i]).slice(-10) + ' 00000 n \n');
      add('trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n' + xr + '\n%%EOF');
      return new Blob(parts, { type: 'application/pdf' });
    });
  }

  /* ---------- formats ---------- */
  function px(c, x) { return x.getImageData(0, 0, c.width, c.height).data; }
  var FORMATS = {
    jpg:  { ext: 'jpg',  flat: 1, q: 1, note: 'Best for photos. Transparent areas become white. Quality slider works.',
            enc: function (c, x, o) { return tb(c, 'image/jpeg', o.q); } },
    png:  { ext: 'png',  note: 'Lossless. Keeps transparency.',
            enc: function (c) { return tb(c, 'image/png'); } },
    webp: { ext: 'webp', q: 1, note: 'Small files with good quality. Keeps transparency. Quality slider works.',
            enc: function (c, x, o) { return tb(c, 'image/webp', o.q); } },
    avif: { ext: 'avif', q: 1, note: 'Very small files. Works only in browsers that can create AVIF. Quality slider works.',
            enc: function (c, x, o) { return tb(c, 'image/avif', o.q); } },
    gif:  { ext: 'gif',  note: 'One frame, up to 256 colours. An animated GIF keeps only its first frame.',
            enc: function (c, x) { return gif(px(c, x), c.width, c.height); } },
    bmp:  { ext: 'bmp',  flat: 1, note: 'Uncompressed Windows bitmap. Files can be large. Transparent areas become white.',
            enc: function (c, x) { return bmp(px(c, x), c.width, c.height); } },
    ico:  { ext: 'ico',  note: 'Windows icon. Images larger than 256 px are scaled down.',
            enc: function (c) { return icon(c, 1); } },
    cur:  { ext: 'cur',  note: 'Windows cursor (PNG inside, works on Windows Vista and newer). Images larger than 256 px are scaled down.',
            enc: function (c) { return icon(c, 2); } },
    icns: { ext: 'icns', note: 'Mac icon, 256 × 256 px. The picture is fitted inside the square.',
            enc: function (c) { return icns(c); } },
    tiff: { ext: 'tiff', note: 'Uncompressed TIFF with transparency. Files can be large.',
            enc: function (c, x) { return tiff(px(c, x), c.width, c.height); } },
    tga:  { ext: 'tga',  note: 'Uncompressed Targa with transparency. Files can be large.',
            enc: function (c, x) { return tga(px(c, x), c.width, c.height); } },
    ppm:  { ext: 'ppm',  flat: 1, note: 'Simple colour PNM image. Files can be large. Transparent areas become white.',
            enc: function (c, x) { return pnm(px(c, x), c.width, c.height, false); } },
    pgm:  { ext: 'pgm',  flat: 1, note: 'Simple grey PNM image (black and white). Transparent areas become white.',
            enc: function (c, x) { return pnm(px(c, x), c.width, c.height, true); } },
    qoi:  { ext: 'qoi',  note: 'Fast lossless format. Keeps transparency.',
            enc: function (c, x) { return qoi(px(c, x), c.width, c.height); } },
    svg:  { ext: 'svg',  note: 'Puts your picture inside an SVG file. It does not trace photos into vector art.',
            enc: function (c) { return svg(c); } },
    pdf:  { ext: 'pdf',  flat: 1, q: 1, note: 'One PDF per image. The page has the same size as the image. Quality slider works.',
            enc: function (c, x, o) { return pdf(c, o.q); } }
  };

  /* ---------- reading input files ---------- */
  function loadImg(b) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(b), im = new Image();
      im.onload = function () { URL.revokeObjectURL(u); res({ src: im, w: im.naturalWidth || 1024, h: im.naturalHeight || 1024 }); };
      im.onerror = function () { URL.revokeObjectURL(u); rej(new Error('Your browser cannot read this file.')); };
      im.src = u;
    });
  }
  function decode(f) {
    var n = f.name.toLowerCase(), t = (f.type || '').toLowerCase();
    if (/\.(heic|heif)$/.test(n) || /heic|heif/.test(t)) {
      return need('heic', 'heic2any').then(function () { return window.heic2any({ blob: f, toType: 'image/png' }); })
        .then(function (r) { return loadImg(Array.isArray(r) ? r[0] : r); });
    }
    if (/\.tiff?$/.test(n) || /tiff/.test(t)) {
      return need('tiff', 'UTIF').then(function () { return f.arrayBuffer(); }).then(function (buf) {
        var ifds = window.UTIF.decode(buf);
        if (!ifds.length) throw new Error('This TIFF file is empty or damaged.');
        window.UTIF.decodeImage(buf, ifds[0]);
        var p = ifds[0], rgba = new Uint8ClampedArray(window.UTIF.toRGBA8(p));
        var c = document.createElement('canvas'); c.width = p.width; c.height = p.height;
        c.getContext('2d').putImageData(new ImageData(rgba, p.width, p.height), 0, 0);
        return { src: c, w: p.width, h: p.height };
      });
    }
    return loadImg(f);
  }

  /* ---------- page state ---------- */
  var files = [], thumbs = [], urls = [];
  var drop = $('drop'), pick = $('pickBtn'), input = $('fileInput'), list = $('fileList'),
      fmt = $('format'), btn = $('convertBtn'), result = $('result'), note = $('fmtNote'), quality = $('quality');

  function options() {
    var mode = document.querySelector('input[name="resize"]:checked').value;
    return {
      mode: mode, w: parseInt($('w').value, 10) || 0, h: parseInt($('h').value, 10) || 0,
      keep: $('keepRatio').checked, pct: parseFloat($('pct').value) || 100, q: parseFloat(quality.value) || 0.92
    };
  }
  function target(w, h, o) {
    var tw = w, th = h, s;
    if (o.mode === 'percent') { s = o.pct / 100; tw = Math.round(w * s); th = Math.round(h * s); }
    else if (o.mode === 'pixels' && (o.w || o.h)) {
      if (o.keep) {
        if (o.w && o.h) { s = Math.min(o.w / w, o.h / h); tw = Math.round(w * s); th = Math.round(h * s); }
        else if (o.w) { tw = o.w; th = Math.round(h * o.w / w); }
        else { th = o.h; tw = Math.round(w * o.h / h); }
      } else { tw = o.w || w; th = o.h || h; }
    }
    tw = Math.max(1, tw); th = Math.max(1, th);
    if (tw * th > MAX_PIXELS) throw new Error('This size is too large for your browser. Choose a smaller size.');
    return { w: tw, h: th };
  }

  function convertOne(f, F, o) {
    return decode(f).then(function (dec) {
      var sz = target(dec.w, dec.h, o), c = document.createElement('canvas');
      c.width = sz.w; c.height = sz.h;
      var x = c.getContext('2d', { willReadFrequently: true });
      if (F.flat) { x.fillStyle = '#ffffff'; x.fillRect(0, 0, sz.w, sz.h); }
      x.imageSmoothingQuality = 'high';
      x.drawImage(dec.src, 0, 0, sz.w, sz.h);
      return F.enc(c, x, o);
    });
  }

  /* ---------- ZIP (store only) ---------- */
  var CRC = (function () { var t = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u) { var c = -1; for (var i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
  function makeZip(items) {
    var enc = new TextEncoder(), parts = [], cd = [], off = 0, chain = Promise.resolve();
    items.forEach(function (it) {
      chain = chain.then(function () { return it.blob.arrayBuffer(); }).then(function (ab) {
        var nm = enc.encode(it.name), data = new Uint8Array(ab), crc = crc32(data);
        var lh = new DataView(new ArrayBuffer(30));
        lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(12, 33, true);
        lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nm.length, true);
        parts.push(lh.buffer, nm, data);
        var ch = new DataView(new ArrayBuffer(46));
        ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(14, 33, true);
        ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
        cd.push(ch.buffer, nm);
        off += 30 + nm.length + data.length;
      });
    });
    return chain.then(function () {
      var size = 0; cd.forEach(function (p) { size += p.byteLength; });
      var end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true); end.setUint16(8, items.length, true); end.setUint16(10, items.length, true);
      end.setUint32(12, size, true); end.setUint32(16, off, true);
      return new Blob(parts.concat(cd, [end.buffer]), { type: 'application/zip' });
    });
  }

  /* ---------- UI ---------- */
  function clearResult() { urls.forEach(URL.revokeObjectURL); urls = []; result.textContent = ''; }
  function say(text, cls) { result.textContent = ''; result.appendChild(el('div', 'msg' + (cls ? ' ' + cls : ''), text)); }
  function save(blob, name) {
    var a = document.createElement('a'), u = URL.createObjectURL(blob);
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  }

  function renderList() {
    thumbs.forEach(URL.revokeObjectURL); thumbs = [];
    list.textContent = '';
    list.style.display = files.length ? 'block' : 'none';
    files.forEach(function (f, i) {
      var row = el('div', 'item');
      if (!/\.(heic|heif|tiff?)$/i.test(f.name)) {
        var im = el('img'), u = URL.createObjectURL(f); thumbs.push(u);
        im.src = u; im.alt = ''; im.onerror = function () { im.remove(); };
        row.appendChild(im);
      }
      row.appendChild(el('span', 'name', f.name + '  (' + size(f.size) + ')'));
      var rm = el('button', 'rm', '✕'); rm.type = 'button'; rm.setAttribute('aria-label', 'Remove ' + f.name);
      rm.onclick = function () { files.splice(i, 1); renderList(); };
      row.appendChild(rm);
      list.appendChild(row);
    });
    btn.disabled = !files.length;
  }
  function addFiles(fl) {
    var skipped = 0;
    Array.prototype.forEach.call(fl, function (f) {
      if ((f.type || '').indexOf('image/') === 0 || READABLE.test(f.name)) files.push(f); else skipped++;
    });
    renderList();
    clearResult();
    if (skipped) say(skipped + ' file(s) skipped because they are not supported image types.', 'warn');
  }

  function showResult(out, errs) {
    result.textContent = '';
    if (out.length) {
      result.appendChild(el('div', 'msg', 'Done. Converted ' + out.length + ' file' + (out.length > 1 ? 's' : '') + '.'));
      var box = el('div', 'file-list');
      out.forEach(function (it) {
        var row = el('div', 'item'), u = URL.createObjectURL(it.blob); urls.push(u);
        row.appendChild(el('span', 'name', it.name + '  (' + size(it.blob.size) + ')'));
        var a = el('a', 'btn', 'Download'); a.href = u; a.download = it.name;
        row.appendChild(a); box.appendChild(row);
      });
      result.appendChild(box);
      if (out.length > 1) {
        var z = el('button', 'btn', 'Download all (ZIP)'); z.type = 'button';
        z.onclick = function () { z.disabled = true; makeZip(out).then(function (b) { save(b, 'converted-images.zip'); z.disabled = false; }); };
        result.appendChild(z);
      }
    }
    errs.forEach(function (m) { result.appendChild(el('div', 'msg err', m)); });
  }

  btn.addEventListener('click', function () {
    if (!files.length) return;
    var F = FORMATS[fmt.value], o = options(), out = [], errs = [], used = {}, i = 0;
    btn.disabled = true; clearResult();
    function next() {
      if (i >= files.length) { showResult(out, errs); btn.disabled = !files.length; return; }
      var f = files[i++];
      say('Converting ' + i + ' of ' + files.length + ': ' + f.name + ' …');
      convertOne(f, F, o).then(function (blob) {
        var nm = base(f.name) + '.' + F.ext, k = 1;
        while (used[nm]) nm = base(f.name) + '-' + (k++) + '.' + F.ext;
        used[nm] = 1; out.push({ name: nm, blob: blob });
      }).catch(function (e) {
        errs.push(f.name + ': ' + (e && e.message ? e.message : 'Conversion failed.'));
      }).then(next);
    }
    next();
  });

  /* format dropdown, notes, resize options, quality */
  function updateFormat() {
    var F = FORMATS[fmt.value];
    note.textContent = F.note;
    quality.disabled = !F.q;
    quality.style.opacity = F.q ? '1' : '0.4';
  }
  fmt.addEventListener('change', updateFormat);
  if (!canAvif()) {
    var ao = fmt.querySelector('option[value="avif"]');
    if (ao) { ao.disabled = true; ao.textContent += ' (not supported in this browser)'; }
  }
  updateFormat();

  Array.prototype.forEach.call(document.querySelectorAll('input[name="resize"]'), function (r) {
    r.addEventListener('change', function () {
      var m = document.querySelector('input[name="resize"]:checked').value;
      $('pixelOpts').style.display = m === 'pixels' ? 'block' : 'none';
      $('percentOpts').style.display = m === 'percent' ? 'block' : 'none';
    });
  });
  quality.addEventListener('input', function () { $('qVal').textContent = parseFloat(quality.value).toFixed(2); });

  /* picking and dropping files */
  pick.addEventListener('click', function (e) { e.stopPropagation(); input.click(); });
  drop.addEventListener('click', function () { input.click(); });
  input.addEventListener('change', function () { addFiles(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
  });
  drop.addEventListener('drop', function (e) { addFiles(e.dataTransfer.files); });

  renderList();
})();