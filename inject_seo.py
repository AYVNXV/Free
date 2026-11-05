#!/usr/bin/env python3
"""
Har HTML page me SEO tags (canonical, Open Graph, Twitter, manifest, icons, JSON-LD) daalta hai.
Chalane ka tareeqa:  python3 inject_seo.py https://apka-domain.com
Dobara chalane se tags duplicate nahi hote (markers use hote hain).
"""
import re, sys, json, pathlib

DOMAIN = (sys.argv[1] if len(sys.argv) > 1 else "https://yourdomain.com").rstrip("/")
SITE = "WebToolVault"
START, END = "<!-- SEO:START -->", "<!-- SEO:END -->"

# page -> (url path, breadcrumb name)
PAGES = {
    "index.html":      ("/", "Home"),
    "image.html":      ("/image.html", "Image Converter"),
    "resizer.html":    ("/resizer.html", "Image Resizer"),
    "compressor.html": ("/compressor.html", "Image Compressor"),
    "audio.html":      ("/audio.html", "Audio Converter"),
    "video.html":      ("/video.html", "Video Converter"),
    "documents.html":  ("/documents.html", "Documents"),
    "developer.html":  ("/developer.html", "Developer Tools"),
    "resources.html":  ("/resources.html", "Resources"),
    "storage.html":    ("/storage.html", "Tools Directory"),
    "more.html":       ("/more.html", "More Tools"),
    "privacy.html":    ("/privacy.html", "Privacy Policy"),
    "terms.html":      ("/terms.html", "Terms of Service"),
}
DEFAULT_DESC = {
    "more.html": "More free online tools from WebToolVault. Everything runs in your browser and nothing is uploaded.",
}

def esc(s): return s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")

def has(html, pattern): return re.search(pattern, html, re.I) is not None

for fname, (path, crumb) in PAGES.items():
    p = pathlib.Path(fname)
    if not p.exists():
        print("skip (missing):", fname); continue
    html = p.read_text(encoding="utf-8")
    html = re.sub(re.escape(START) + r".*?" + re.escape(END) + r"\s*", "", html, flags=re.S)
    nl = "\r\n" if "\r\n" in html else "\n"

    m = re.search(r"<title>(.*?)</title>", html, re.S | re.I)
    title = re.sub(r"\s+", " ", m.group(1)).strip().replace("&amp;", "&") if m else SITE
    m = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', html, re.I)
    desc = m.group(1) if m else DEFAULT_DESC.get(fname, f"{title} - free, private and runs in your browser.")
    url = DOMAIN + path
    img = DOMAIN + "/og-image.png"

    lines = [START]
    if not m:
        lines.append(f'<meta name="description" content="{esc(desc)}">')
    lines.append('<meta name="robots" content="index, follow, max-image-preview:large">') if not has(html, r'name="robots"') else None
    lines.append(f'<link rel="canonical" href="{url}">')
    og = {
        "og:site_name": SITE, "og:locale": "en_US", "og:url": url, "og:image": img,
        "og:image:width": "1200", "og:image:height": "630", "og:image:alt": f"{SITE} - free online file converters",
    }
    if not has(html, r'property="og:title"'):       og["og:title"] = title
    if not has(html, r'property="og:description"'): og["og:description"] = desc
    if not has(html, r'property="og:type"'):        og["og:type"] = "website"
    for k, v in og.items():
        lines.append(f'<meta property="{k}" content="{esc(v)}">')
    for k, v in {"twitter:card": "summary_large_image", "twitter:title": title,
                 "twitter:description": desc, "twitter:image": img}.items():
        lines.append(f'<meta name="twitter:{k.split(":")[1]}" content="{esc(v)}">')
    lines.append('<link rel="apple-touch-icon" href="/apple-touch-icon.png">')
    lines.append('<link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32.png">')
    lines.append('<link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16.png">')
    lines.append('<link rel="manifest" href="/site.webmanifest">')

    if fname == "index.html":
        data = [
            {"@context": "https://schema.org", "@type": "WebSite", "name": SITE, "url": DOMAIN + "/",
             "description": desc, "inLanguage": "en"},
            {"@context": "https://schema.org", "@type": "WebApplication", "name": SITE, "url": DOMAIN + "/",
             "applicationCategory": "UtilitiesApplication", "operatingSystem": "Any (web browser)",
             "browserRequirements": "Requires JavaScript",
             "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}},
        ]
    else:
        data = [{"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": DOMAIN + "/"},
            {"@type": "ListItem", "position": 2, "name": crumb, "item": url}]}]
    for d in data:
        lines.append('<script type="application/ld+json">' + json.dumps(d, ensure_ascii=False) + "</script>")
    lines.append(END)

    block = nl.join(l for l in lines if l) + nl
    if "</head>" not in html:
        print("no </head> in", fname); continue
    html = html.replace("</head>", block + "</head>", 1)
    p.write_text(html, encoding="utf-8")
    print("ok:", fname)

# Domain placeholder baqi files me bhi badal do
for f in ["robots.txt", "sitemap.xml", ".well-known/security.txt"]:
    fp = pathlib.Path(f)
    if fp.exists():
        t = fp.read_text()
        t = re.sub(r"https://[a-z0-9.\-]+(?=/(sitemap\.xml|\.well-known|[a-z0-9\-]*\.html|<|\s|$))", DOMAIN, t) if DOMAIN != "https://yourdomain.com" else t
        fp.write_text(t)
print("Done. Domain =", DOMAIN)
