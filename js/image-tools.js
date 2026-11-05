/* WebToolVault – Image Compressor and Image Resizer
   One script for both pages. The page sets <body data-tool="compress"> or <body data-tool="resize">.
   The output always keeps the original format (ICO stays ICO, PNG stays PNG, and so on).
   Everything runs in the browser. Only TIFF files load a small helper library, on demand. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var COMPRESS = document.body.getAttribute('data-tool') !== 'resize';
  var CDN_TIFF = 'https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.js';
  var MAX_PIXELS = 100e6;

  /* ---------- helpers ---------- */
  function base(n) { return n.replace(/\.[^.]+$/, '') || 'image'; }
  function extOf(n) { var m = /\.([^.]+)$/.exec(n); return m ? m[1].toLowerCase() : ''; }
  function size(n) { return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB'; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  function skip(msg) { var e = new Error(msg); e.warn = true; return e; }
  function tb(c, mime, q) {
    return new Promise(function (res, rej) {
      c.toBlob(function (b) {
        if (!b || b.type !== mime) rej(new Error('Your browser cannot save this format. Try Chrome or Edge.'));
        else res(b);
      }, mime, q);
    });
  }
  function px(c, x) { return x.getImageData(0, 0, c.width, c.height).data; }
  function colorsFor(q) { return Math.max(16, Math.min(256, Math.round(32 + (q - 0.1) / 0.85 * 224))); }
  function has(u, s, from, to) {
    var n = s.length, end = Math.min(u.length - n, to);
    for (var i = from; i <= end; i++) {
      var ok = true;
      for (var j = 0; j < n; j++) if (u[i + j] !== s.charCodeAt(j)) { ok = false; break; }
      if (ok) return true;
    }
    return false;
  }

  /* ---------- which format is this file? ---------- */
  function kind(f) {
    var e = extOf(f.name), t = (f.type || '').toLowerCase();
    if (/^(jpe?g|jfif|jpe)$/.test(e) || t === 'image/jpeg') return 'jpeg';
    if (e === 'png' || e === 'apng' || t === 'image/png') return 'png';
    if (e === 'webp' || t === 'image/webp') return 'webp';
    if (e === 'gif' || t === 'image/gif') return 'gif';
    if (e === 'bmp' || t === 'image/bmp') return 'bmp';
    if (e === 'ico' || /icon/.test(t)) return 'ico';
    if (e === 'cur') return 'cur';
    if (e === 'svg' || t === 'image/svg+xml') return 'svg';
    if (e === 'avif' || t === 'image/avif') return 'avif';
    if (/^tiff?$/.test(e) || t === 'image/tiff') return 'tiff';
    return null;
  }

  /* ---------- animation check (animated files would lose their animation) ---------- */
  function gifFrames(u) {
    if (u.length < 13) return 1;
    var p = 13, n = 0;
    if (u[10] & 0x80) p += 3 * (1 << ((u[10] & 7) + 1));
    while (p < u.length) {
      var b = u[p++];
      if (b === 0x3B) break;
      if (b === 0x21) { p++; while (p < u.length && u[p]) p += u[p] + 1; p++; }
      else if (b === 0x2C) {
        n++; var fl = u[p + 8]; p += 9;
        if (fl & 0x80) p += 3 * (1 << ((fl & 7) + 1));
        p++; while (p < u.length && u[p]) p += u[p] + 1; p++;
      } else break;
    }
    return n;
  }
  function animated(u, k) {
    if (k === 'gif') return gifFrames(u) > 1;
    if (k === 'png') return has(u, 'acTL', 8, 400);
    if (k === 'webp') return has(u, 'VP8X', 12, 12) && (u[20] & 2) !== 0;
    if (k === 'avif') return has(u, 'avis', 4, 64);
    return false;
  }

  /* ---------- decoding ---------- */
  function loadImg(b) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(b), im = new Image();
      im.onload = function () { URL.revokeObjectURL(u); res({ src: im, w: im.naturalWidth || 1024, h: im.naturalHeight || 1024 }); };
      im.onerror = function () { URL.revokeObjectURL(u); rej(new Error('Your browser cannot read this file.')); };
      im.src = u;
    });
  }
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res;
      s.onerror = function () { rej(new Error('Could not load the TIFF helper. Check your internet connection.')); };
      document.head.appendChild(s);
    });
  }
  function decode(f, k, ab) {
    if (k === 'tiff') {
      var ready = window.UTIF ? Promise.resolve() : loadScript(CDN_TIFF);
      return ready.then(function () {
        var ifds = window.UTIF.decode(ab);
        if (!ifds.length) throw new Error('This TIFF file is empty or damaged.');
        window.UTIF.decodeImage(ab, ifds[0]);
        var p = ifds[0], rgba = new Uint8ClampedArray(window.UTIF.toRGBA8(p));
        var c = document.createElement('canvas'); c.width = p.width; c.height = p.height;
        c.getContext('2d').putImageData(new ImageData(rgba, p.width, p.height), 0, 0);
        return { src: c, w: p.width, h: p.height };
      });
    }
    if (k === 'ico' || k === 'cur') return loadImg(new Blob([ab], { type: 'image/x-icon' }));
    return loadImg(f);
  }

  /* ---------- encoders ---------- */
  var CRC = (function () { var t = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u) { var c = -1; for (var i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }

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

  /* median-cut colour reduction, shared by GIF and PNG */
  function quantize(d, w, h, maxc) {
    var n = w * h, hasT = false, i, hist = new Uint32Array(32768);
    for (i = 0; i < n; i++) {
      var s = i * 4;
      if (d[s + 3] < 128) { hasT = true; continue; }
      hist[((d[s] >> 3) << 10) | ((d[s + 1] >> 3) << 5) | (d[s + 2] >> 3)]++;
    }
    var cap = hasT ? maxc - 1 : maxc, cols = [];
    for (i = 0; i < 32768; i++) if (hist[i]) cols.push(i);
    var comp = function (k, ch) { return ch === 0 ? k >> 10 : ch === 1 ? (k >> 5) & 31 : k & 31; };
    var boxes = [cols];
    while (boxes.length < cap) {
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
      if (!cnt) return;
      var r5 = Math.round(rs / cnt), g5 = Math.round(gs / cnt), b5 = Math.round(bsum / cnt);
      pal[(j + off) * 3] = (r5 << 3) | (r5 >> 2); pal[(j + off) * 3 + 1] = (g5 << 3) | (g5 >> 2); pal[(j + off) * 3 + 2] = (b5 << 3) | (b5 >> 2);
    });
    var out = new Uint8Array(n);
    for (i = 0; i < n; i++) {
      var t = i * 4;
      out[i] = d[t + 3] < 128 ? 0 : lut[((d[t] >> 3) << 10) | ((d[t + 1] >> 3) << 5) | (d[t + 2] >> 3)];
    }
    return { pal: pal, px: out, hasT: hasT, count: boxes.length + off };
  }

  function lzw(idx, mc) {
    var out = [], cur = 0, bits = 0, cs = mc + 1, clear = 1 << mc, next = clear + 2, dict = new Map();
    function put(c) { cur |= c << bits; bits += cs; while (bits >= 8) { out.push(cur & 255); cur >>>= 8; bits -= 8; } }
    put(clear);
    var p = idx[0];
    for (var i = 1; i < idx.length; i++) {
      var k = idx[i], key = p * 256 + k, e = dict.get(key);
      if (e !== undefined) { p = e; }
      else {
        put(p);
        if (next < 4096) { dict.set(key, next++); if (next > (1 << cs) && cs < 12) cs++; }
        else { put(clear); dict.clear(); next = clear + 2; cs = mc + 1; }
        p = k;
      }
    }
    put(p); put(clear + 1);
    if (bits > 0) out.push(cur & 255);
    return out;
  }
  function gif(d, w, h, maxc) {
    var q = quantize(d, w, h, maxc), nb = 2;
    while ((1 << nb) < q.count) nb++;
    var out = [71, 73, 70, 56, 57, 97, w & 255, w >> 8, h & 255, h >> 8, 0xF0 | (nb - 1), 0, 0], i;
    for (i = 0; i < (3 << nb); i++) out.push(q.pal[i] || 0);
    if (q.hasT) out.push(0x21, 0xF9, 4, 1, 0, 0, 0, 0);
    out.push(0x2C, 0, 0, 0, 0, w & 255, w >> 8, h & 255, h >> 8, 0, nb);
    var data = lzw(q.px, nb);
    for (var p = 0; p < data.length; p += 255) {
      var len = Math.min(255, data.length - p);
      out.push(len);
      for (var j = 0; j < len; j++) out.push(data[p + j]);
    }
    out.push(0, 0x3B);
    return new Blob([new Uint8Array(out)], { type: 'image/gif' });
  }

  /* smaller PNG: fewer colours (indexed PNG). Returns null when the image has soft transparency. */
  function deflate(u8) {
    var cs = new CompressionStream('deflate'), w = cs.writable.getWriter();
    w.write(u8); w.close();
    return new Response(cs.readable).arrayBuffer().then(function (a) { return new Uint8Array(a); });
  }
  function chunk(type, data) {
    var t = new TextEncoder().encode(type), b = new Uint8Array(12 + data.length), v = new DataView(b.buffer), c = new Uint8Array(4 + data.length);
    v.setUint32(0, data.length); b.set(t, 4); b.set(data, 8);
    c.set(t, 0); c.set(data, 4); v.setUint32(8 + data.length, crc32(c));
    return b;
  }
  function pngIndexed(d, w, h, maxc) {
    for (var i = 3; i < d.length; i += 4) if (d[i] !== 0 && d[i] !== 255) return Promise.resolve(null);
    var q = quantize(d, w, h, maxc), raw = new Uint8Array((w + 1) * h);
    for (var y = 0; y < h; y++) raw.set(q.px.subarray(y * w, (y + 1) * w), y * (w + 1) + 1);
    var ihdr = new Uint8Array(13), v = new DataView(ihdr.buffer);
    v.setUint32(0, w); v.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 3;
    return deflate(raw).then(function (z) {
      var parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('PLTE', q.pal.slice(0, q.count * 3))];
      if (q.hasT) parts.push(chunk('tRNS', new Uint8Array([0])));
      parts.push(chunk('IDAT', z), chunk('IEND', new Uint8Array(0)));
      return new Blob(parts, { type: 'image/png' });
    });
  }
  function pngBlob(c, x, o) {
    return tb(c, 'image/png').then(function (lossless) {
      if (!COMPRESS || o.q >= 0.95 || typeof CompressionStream === 'undefined') return lossless;
      return pngIndexed(px(c, x), c.width, c.height, colorsFor(o.q)).then(function (p) { return p && p.size < lossless.size ? p : lossless; });
    });
  }

  /* ICO / CUR with a PNG inside (max 256 px) */
  function icon(c, type, hot, o, scale) {
    var s = Math.min(1, 256 / Math.max(c.width, c.height)), t = document.createElement('canvas');
    t.width = Math.max(1, Math.round(c.width * s)); t.height = Math.max(1, Math.round(c.height * s));
    var x = t.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, t.width, t.height);
    return pngBlob(t, x, o).then(function (b) { return b.arrayBuffer(); }).then(function (ab) {
      var png = new Uint8Array(ab), b = new Uint8Array(22 + png.length), v = new DataView(b.buffer);
      v.setUint16(2, type, true); v.setUint16(4, 1, true);
      b[6] = t.width >= 256 ? 0 : t.width; b[7] = t.height >= 256 ? 0 : t.height;
      if (type === 1) { v.setUint16(10, 1, true); v.setUint16(12, 32, true); }
      else {
        v.setUint16(10, Math.min(t.width - 1, Math.round(hot[0] * scale)), true);
        v.setUint16(12, Math.min(t.height - 1, Math.round(hot[1] * scale)), true);
      }
      v.setUint32(14, png.length, true); v.setUint32(18, 22, true);
      b.set(png, 22);
      return new Blob([b], { type: type === 1 ? 'image/x-icon' : 'image/x-win-bitmap' });
    });
  }

  /* SVG: stays a real vector file. Resize changes width/height. Compress removes extra code. */
  function num(v) { return v && !/%/.test(v) ? parseFloat(v) : NaN; }
  function svgProcess(text, o) {
    var doc = new DOMParser().parseFromString(text, 'image/svg+xml'), root = doc.documentElement;
    if (!root || doc.querySelector('parsererror') || root.nodeName.toLowerCase() !== 'svg') throw new Error('This SVG file is not valid.');
    if (o.mode !== 'none') {
      var vb = root.getAttribute('viewBox'), w = num(root.getAttribute('width')), h = num(root.getAttribute('height')), bw, bh;
      if (vb) { var p = vb.trim().split(/[\s,]+/).map(Number); bw = p[2]; bh = p[3]; }
      if (!(w > 0)) w = bw; if (!(h > 0)) h = bh;
      if (!(w > 0 && h > 0)) throw new Error('This SVG has no size, so it cannot be resized.');
      if (!vb) root.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      var sz = target(w, h, o);
      root.setAttribute('width', sz.w); root.setAttribute('height', sz.h);
    }
    if (COMPRESS) Array.prototype.slice.call(doc.querySelectorAll('metadata')).forEach(function (m) { m.remove(); });
    var out = new XMLSerializer().serializeToString(doc);
    if (COMPRESS) out = out.replace(/<!--[\s\S]*?-->/g, '').replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim();
    return new Blob([out], { type: 'image/svg+xml' });
  }

  /* ---------- options and sizing ---------- */
  var files = [], thumbs = [], urls = [];
  var drop = $('drop'), pick = $('pickBtn'), input = $('fileInput'), list = $('fileList'),
      btn = $('convertBtn'), result = $('result'), quality = $('quality');

  function options() {
    return {
      mode: document.querySelector('input[name="resize"]:checked').value,
      w: parseInt($('w').value, 10) || 0, h: parseInt($('h').value, 10) || 0,
      keep: $('keepRatio').checked, pct: parseFloat($('pct').value) || 100, q: parseFloat(quality.value) || 0.8
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

  /* ---------- one file: same format in, same format out ---------- */
  function processFile(f, k, o) {
    return f.arrayBuffer().then(function (ab) {
      var u = new Uint8Array(ab);
      if (k === 'svg') return { blob: svgProcess(new TextDecoder().decode(u), o), note: '' };
      if (animated(u, k)) throw skip('Animated file skipped. Compressing or resizing it here would remove the animation, so it was left unchanged.');
      var hot = [0, 0];
      if (k === 'cur' && u.length > 14) { var dv = new DataView(ab); hot = [dv.getUint16(10, true), dv.getUint16(12, true)]; }
      return decode(f, k, ab).then(function (dec) {
        var sz = target(dec.w, dec.h, o), note = '';
        if ((k === 'ico' || k === 'cur') && Math.max(sz.w, sz.h) > 256) note = 'Icons can be at most 256 px, so the size was limited.';
        var c = document.createElement('canvas'); c.width = sz.w; c.height = sz.h;
        var x = c.getContext('2d', { willReadFrequently: true });
        if (k === 'jpeg' || k === 'bmp') { x.fillStyle = '#ffffff'; x.fillRect(0, 0, sz.w, sz.h); }
        x.imageSmoothingQuality = 'high';
        x.drawImage(dec.src, 0, 0, sz.w, sz.h);
        var p;
        if (k === 'jpeg') p = tb(c, 'image/jpeg', o.q);
        else if (k === 'webp') p = tb(c, 'image/webp', o.q);
        else if (k === 'avif') p = tb(c, 'image/avif', o.q);
        else if (k === 'png') p = pngBlob(c, x, o);
        else if (k === 'gif') p = Promise.resolve(gif(px(c, x), c.width, c.height, COMPRESS ? colorsFor(o.q) : 256));
        else if (k === 'bmp') p = Promise.resolve(bmp(px(c, x), c.width, c.height));
        else if (k === 'tiff') p = Promise.resolve(tiff(px(c, x), c.width, c.height));
        else p = icon(c, k === 'ico' ? 1 : 2, hot, o, sz.w / dec.w);
        return p.then(function (blob) { return { blob: blob, note: note }; });
      });
    });
  }

  /* ---------- ZIP (store only) ---------- */
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
      var total = 0; cd.forEach(function (p) { total += p.byteLength; });
      var end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true); end.setUint16(8, items.length, true); end.setUint16(10, items.length, true);
      end.setUint32(12, total, true); end.setUint32(16, off, true);
      return new Blob(parts.concat(cd, [end.buffer]), { type: 'application/zip' });
    });
  }

  /* ---------- page UI ---------- */
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
      if (!/^tiff?$/.test(extOf(f.name))) {
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
    var bad = [];
    Array.prototype.forEach.call(fl, function (f) { if (kind(f)) files.push(f); else bad.push(f.name); });
    renderList(); clearResult();
    if (bad.length) say('Not supported here: ' + bad.join(', ') + '. This tool keeps the original format, so it only works with JPG, PNG, WEBP, GIF, BMP, ICO, CUR, SVG, AVIF and TIFF. For other types (for example HEIC), use the Image Converter first.', 'warn');
  }

  function showResult(out, msgs) {
    result.textContent = '';
    if (out.length) {
      result.appendChild(el('div', 'msg', 'Done. ' + out.length + ' file' + (out.length > 1 ? 's' : '') + ' ready. The format of each file was not changed.'));
      var box = el('div', 'file-list');
      out.forEach(function (it) {
        var row = el('div', 'item'), u = URL.createObjectURL(it.blob); urls.push(u);
        var diff = it.before ? Math.round((1 - it.blob.size / it.before) * 100) : 0;
        var txt = it.name + '  (' + size(it.before) + ' → ' + size(it.blob.size) + (diff > 0 ? ', ' + diff + '% smaller' : diff < 0 ? ', ' + (-diff) + '% larger' : '') + ')';
        if (it.note) txt += ' – ' + it.note;
        row.appendChild(el('span', 'name', txt));
        row.lastChild.style.whiteSpace = 'normal';
        var a = el('a', 'btn', 'Download'); a.href = u; a.download = it.name;
        row.appendChild(a); box.appendChild(row);
      });
      result.appendChild(box);
      if (out.length > 1) {
        var z = el('button', 'btn', 'Download all (ZIP)'); z.type = 'button';
        z.onclick = function () { z.disabled = true; makeZip(out).then(function (b) { save(b, (COMPRESS ? 'compressed' : 'resized') + '-images.zip'); z.disabled = false; }); };
        result.appendChild(z);
      }
    }
    msgs.forEach(function (m) { result.appendChild(el('div', 'msg ' + (m.warn ? 'warn' : 'err'), m.text)); });
  }

  btn.addEventListener('click', function () {
    if (!files.length) return;
    var o = options(), out = [], msgs = [], used = {}, i = 0, tag = COMPRESS ? '-compressed' : '-resized';
    btn.disabled = true; clearResult();
    function next() {
      if (i >= files.length) { showResult(out, msgs); btn.disabled = !files.length; return; }
      var f = files[i++], k = kind(f);
      say((COMPRESS ? 'Compressing ' : 'Resizing ') + i + ' of ' + files.length + ': ' + f.name + ' …');
      processFile(f, k, o).then(function (r) {
        var blob = r.blob, note = r.note;
        if (COMPRESS && o.mode === 'none' && blob.size >= f.size) { blob = f; note = 'Already small. This format cannot get smaller without a change, so the original was kept.'; }
        var ext = extOf(f.name) || 'img', nm = base(f.name) + tag + '.' + ext, n = 1;
        while (used[nm]) nm = base(f.name) + tag + '-' + (n++) + '.' + ext;
        used[nm] = 1; out.push({ name: nm, blob: blob, before: f.size, note: note });
      }).catch(function (e) {
        msgs.push({ warn: !!(e && e.warn), text: f.name + ': ' + (e && e.message ? e.message : 'Something went wrong.') });
      }).then(next);
    }
    next();
  });

  Array.prototype.forEach.call(document.querySelectorAll('input[name="resize"]'), function (r) {
    r.addEventListener('change', function () {
      var m = document.querySelector('input[name="resize"]:checked').value;
      $('pixelOpts').style.display = m === 'pixels' ? 'block' : 'none';
      $('percentOpts').style.display = m === 'percent' ? 'block' : 'none';
    });
  });
  quality.addEventListener('input', function () { $('qVal').textContent = parseFloat(quality.value).toFixed(2); });

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