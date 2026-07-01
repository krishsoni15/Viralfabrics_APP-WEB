from PIL import Image, ImageDraw, ImageFont

# 1. Open their logo
try:
    logo = Image.open('assets/logo-clean.png').convert("RGBA")
except Exception as e:
    print("Error opening icon:", e)
    exit(1)

# 2. Create a new square image for the splash screen icon (1152x1152)
# Android 12+ scales the splash icon image to fit a 288dp square in the center.
# Making it square ensures it fills the center area and looks large and premium.
splash = Image.new("RGBA", (1152, 1152), (0, 0, 0, 0))

# 3. Resize logo to 920x920 (scale up keeping aspect ratio)
ratio = min(920 / logo.width, 920 / logo.height)
new_size = (int(logo.width * ratio), int(logo.height * ratio))
logo = logo.resize(new_size, Image.Resampling.LANCZOS)
logo_w, logo_h = logo.size

# 4. Center the logo perfectly in the square canvas
offset_x = (1152 - logo_w) // 2
offset_y = (1152 - logo_h) // 2
splash.paste(logo, (offset_x, offset_y), logo)

# 5. Save as splash-icon.png
splash.save("assets/splash-icon.png")
print("Generated custom splash-icon.png (logo-only)!")
