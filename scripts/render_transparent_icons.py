import subprocess
import os
from PIL import Image

chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
html_path = r"F:\LiveSpeak\assets\render_pure_wave.html"
master_png = r"F:\LiveSpeak\assets\logo_transparent.png"

# Render transparent 1024x1024 master
cmd = [
    chrome,
    "--headless=new",
    "--disable-gpu",
    f"--screenshot={master_png}",
    "--window-size=1024,1024",
    "--default-background-color=00000000",
    f"file:///{html_path.replace(os.sep, '/')}"
]
res = subprocess.run(cmd, capture_output=True, text=True)
print("Render exit code:", res.returncode)

im = Image.open(master_png)
print("Image size:", im.size, "bbox:", im.getbbox())

# Save main master transparent logo
im.save(r"F:\LiveSpeak\assets\taskbar_app_logo_transparent.png", "PNG", optimize=True)

# Update desktop tauri icons directory
icons_dir = r"F:\LiveSpeak\apps\desktop\src-tauri\icons"
icon_files = {
    "32x32.png": (32, 32),
    "64x64.png": (64, 64),
    "128x128.png": (128, 128),
    "128x128@2x.png": (256, 256),
    "icon.png": (512, 512),
    "logo.png": (1024, 1024),
    "Square30x30Logo.png": (30, 30),
    "Square44x44Logo.png": (44, 44),
    "Square71x71Logo.png": (71, 71),
    "Square89x89Logo.png": (89, 89),
    "Square107x107Logo.png": (107, 107),
    "Square142x142Logo.png": (142, 142),
    "Square150x150Logo.png": (150, 150),
    "Square284x284Logo.png": (284, 284),
    "Square310x310Logo.png": (310, 310),
    "StoreLogo.png": (50, 50)
}

for filename, size in icon_files.items():
    dest = os.path.join(icons_dir, filename)
    resized = im.resize(size, Image.Resampling.LANCZOS)
    resized.save(dest, "PNG", optimize=True)
    print(f"Updated icon: {filename}")

# Generate multi-size Windows icon.ico
ico_dest = os.path.join(icons_dir, "icon.ico")
im.save(ico_dest, format="ICO", sizes=[(16,16), (24,24), (32,32), (48,48), (64,64), (128,128), (256,256)])
print(f"Updated ICO: {ico_dest}")

# Also update tray resources in desktop
resources_dir = r"F:\LiveSpeak\apps\desktop\src-tauri\resources"
tray_idle = os.path.join(resources_dir, "tray_idle.png")
im.resize((64, 64), Image.Resampling.LANCZOS).save(tray_idle, "PNG", optimize=True)
tray_idle_dark = os.path.join(resources_dir, "tray_idle_dark.png")
im.resize((64, 64), Image.Resampling.LANCZOS).save(tray_idle_dark, "PNG", optimize=True)
print("Updated tray icons!")
