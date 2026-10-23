import subprocess
import os
from PIL import Image

chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

def render_html_to_png(html_file, png_out):
    cmd = [
        chrome,
        "--headless=new",
        "--disable-gpu",
        f"--screenshot={png_out}",
        "--window-size=512,512",
        "--default-background-color=00000000",
        f"file:///{html_file.replace(os.sep, '/')}"
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    print(f"Rendered {png_out}, exit code: {res.returncode}")

dark_html = r"F:\LiveSpeak\assets\render_dark.html"
light_html = r"F:\LiveSpeak\assets\render_light.html"
dark_512 = r"F:\LiveSpeak\assets\logo_dark_512.png"
light_512 = r"F:\LiveSpeak\assets\logo_light_512.png"

render_html_to_png(dark_html, dark_512)
render_html_to_png(light_html, light_512)

# Generate various taskbar and app sizes
def create_variants(src_512, prefix):
    im = Image.open(src_512)
    sizes = [256, 128, 64, 48, 32, 16]
    for s in sizes:
        resized = im.resize((s, s), Image.Resampling.LANCZOS)
        out_path = rf"F:\LiveSpeak\assets\{prefix}_{s}x{s}.png"
        resized.save(out_path, "PNG", optimize=True)
        print("Saved", out_path)
    
    # 256x256 primary taskbar png
    im.resize((256, 256), Image.Resampling.LANCZOS).save(rf"F:\LiveSpeak\assets\{prefix}.png", "PNG", optimize=True)
    
    # Windows taskbar .ico
    im.save(rf"F:\LiveSpeak\assets\{prefix}.ico", format="ICO", sizes=[(16,16), (32,32), (48,48), (64,64), (128,128), (256,256)])
    print("Saved ICO:", f"{prefix}.ico")

create_variants(dark_512, "logo_dark")
create_variants(light_512, "logo_light")

# Also produce the canonical app icon for Tauri desktop app
Image.open(dark_512).resize((256, 256), Image.Resampling.LANCZOS).save(r"F:\LiveSpeak\assets\taskbar_icon.png", "PNG", optimize=True)
print("Done all icon generations!")
