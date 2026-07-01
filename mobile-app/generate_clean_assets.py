import os
from PIL import Image

def main():
    assets_dir = 'assets'
    original_icon_path = os.path.join(assets_dir, 'icon.png')
    backup_icon_path = os.path.join(assets_dir, 'icon-original-backup.png')

    if not os.path.exists(original_icon_path):
        print(f"Error: Original icon not found at {original_icon_path}")
        return

    # 1. Back up the original logo if we haven't already
    if not os.path.exists(backup_icon_path):
        print(f"Creating a backup of the original logo: {backup_icon_path}")
        img_orig = Image.open(original_icon_path)
        img_orig.save(backup_icon_path)
    else:
        print(f"Backup already exists at {backup_icon_path}. Using backup as source.")

    # Load source image (using the backup to prevent issues if script is re-run)
    src_img = Image.open(backup_icon_path).convert("RGBA")
    
    # 2. Extract bounding box of the non-transparent logo pixels
    alpha = src_img.split()[-1]
    # Bounding box of pixels with alpha > 10 (ignores stray near-transparent pixels)
    mask = alpha.point(lambda p: 255 if p > 10 else 0)
    bbox = mask.getbbox()
    print(f"Extracted logo bounding box: {bbox} (original size: {src_img.size})")
    
    logo_cropped = src_img.crop(bbox)

    def generate_padded_asset(logo, size, bg_color, scale_factor):
        # Create new canvas
        canvas = Image.new("RGBA", (size, size), bg_color)
        
        # Calculate target size (bound it to a percentage of the canvas size)
        target_max_dim = int(size * scale_factor)
        
        # Resize logo keeping aspect ratio
        logo_resized = logo.copy()
        logo_resized.thumbnail((target_max_dim, target_max_dim), Image.Resampling.LANCZOS)
        
        # Center the logo on the canvas
        offset_x = (size - logo_resized.width) // 2
        offset_y = (size - logo_resized.height) // 2
        
        # Paste logo using its alpha channel as a mask
        canvas.paste(logo_resized, (offset_x, offset_y), logo_resized)
        return canvas

    # 3. Generate icon.png (iOS and general fallback - square 1024x1024, white bg, scaled to 60%)
    print("Generating assets/icon.png...")
    icon_img = generate_padded_asset(logo_cropped, 1024, (255, 255, 255, 255), 0.60)
    icon_img.save(os.path.join(assets_dir, 'icon.png'))

    # 4. Generate android-icon-foreground.png (Android adaptive foreground - square 512x512, transparent, scaled to 48%)
    print("Generating assets/android-icon-foreground.png...")
    fg_img = generate_padded_asset(logo_cropped, 512, (0, 0, 0, 0), 0.48)
    fg_img.save(os.path.join(assets_dir, 'android-icon-foreground.png'))

    # 5. Generate android-icon-background.png (Android adaptive background - solid white 512x512)
    print("Generating assets/android-icon-background.png...")
    bg_img = Image.new("RGBA", (512, 512), (255, 255, 255, 255))
    bg_img.save(os.path.join(assets_dir, 'android-icon-background.png'))

    # 6. Generate android-icon-monochrome.png (Android themed icon - monochrome 512x512, black with transparent background)
    print("Generating assets/android-icon-monochrome.png...")
    # Extract alpha from foreground, merge with black channels
    r, g, b, fg_alpha = fg_img.split()
    black_channel = Image.new("L", (512, 512), 0)
    mono_img = Image.merge("RGBA", (black_channel, black_channel, black_channel, fg_alpha))
    mono_img.save(os.path.join(assets_dir, 'android-icon-monochrome.png'))

    # 7. Generate splash-icon.png (Splash screen - custom image with logo & text)
    print("Generating assets/splash-icon.png (with text)...")
    import subprocess
    try:
        subprocess.run(["python3", "gen_splash.py"], check=True)
    except Exception as e:
        print(f"Error running gen_splash.py: {e}")

    # 8. Generate favicon.png (Favicon - square 48x48, transparent)
    print("Generating assets/favicon.png...")
    fav_img = generate_padded_asset(logo_cropped, 48, (0, 0, 0, 0), 0.90)
    fav_img.save(os.path.join(assets_dir, 'favicon.png'))

    # 9. Generate logo-clean.png (Clean cropped logo for in-app screens - square 512x512, transparent, scaled to 95%)
    print("Generating assets/logo-clean.png...")
    clean_logo_img = generate_padded_asset(logo_cropped, 512, (0, 0, 0, 0), 0.95)
    clean_logo_img.save(os.path.join(assets_dir, 'logo-clean.png'))

    print("Success! All clean mobile assets generated successfully.")

if __name__ == '__main__':
    main()
