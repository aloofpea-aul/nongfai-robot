# ถ่ายภาพ 2D (#elev) ของหน้าแบบใน pea-drawings เป็น PNG — ใช้กับเซิร์ฟเวอร์ local ที่วาง pea-drawings ไว้ใต้ /pea-drawings/ และ /pea-hub.js ว่าง
# python3 scripts/make-thumbs.py <out-dir> d/xxx.html ... แล้วย่อด้วย ImageMagick: convert x.png -trim -resize 300x220 -background white -gravity center -extent 300x220 -quality 70 thumbs/x.jpg
import asyncio, sys, json
from playwright.async_api import async_playwright
pages = sys.argv[2:]
out = sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 900, 'height': 900}, device_scale_factor=1)
        await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await pg.route('**/fonts.gstatic.com/**', lambda r: r.abort())
        for f in pages:
            try:
                await pg.goto('http://localhost:8765/pea-drawings/' + f, wait_until='load', timeout=20000)
                await pg.add_style_tag(content='*{animation:none!important}'); await pg.evaluate("document.querySelectorAll('body *').forEach(e=>{if(getComputedStyle(e).position==='fixed')e.style.display='none'})"); await pg.wait_for_timeout(300)
                el = await pg.query_selector('#elev svg') or await pg.query_selector('#elev') or await pg.query_selector('svg')
                name = f.split('/')[-1].replace('.html', '')
                if el: await el.screenshot(path=f'{out}/{name}.png')
                else: print('noel', f)
            except Exception as e: print('err', f, e)
        await b.close()
asyncio.run(main())
