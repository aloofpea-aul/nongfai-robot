# สร้าง dwg-index.json จากคลังแบบมาตรฐาน (repo pea-drawings) — รัน: python3 scripts/build-dwg-index.py <path-to-pea-drawings>
import re, json, html, os, sys
root = sys.argv[1] if len(sys.argv) > 1 else '../pea-drawings'
s = open(os.path.join(root, 'index.html'), encoding='utf8').read()
g = lambda n: json.loads(re.search(r'const ' + n + r'=(.*?);\s*(?:\n|const )', s).group(1))
items, pdf, det, ser = g('ITEMS'), g('PDF'), g('DETAIL'), g('SERIES')
sern = {x['c']: x['th'] for x in ser}
out, seen = [], set()
for x in items:
    page = det.get(x['id'], '')
    key = page or x['id']
    if key in seen: continue
    seen.add(key)
    t, parts = x['th'], ''
    if page and os.path.exists(os.path.join(root, page)):
        h = open(os.path.join(root, page), encoding='utf8').read()
        m = re.search(r'<title>([^<]*)', h)
        if m: t = html.unescape(m.group(1)).strip()
        parts = ' '.join(sorted(set(re.findall(r'"th":"([^"]{2,40})"', h))))[:300]
    out.append({'t': t, 'en': x['en'], 's': sern.get(x['c'], ''), 'p': page, 'f': pdf.get(x['id'], ''), 'w': parts})
json.dump(out, open('dwg-index.json', 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
print(len(out), os.path.getsize('dwg-index.json'))
