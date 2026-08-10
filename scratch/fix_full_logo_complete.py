import os
from PIL import Image, ImageEnhance, ImageFilter

SOURCE_IMAGE_PATH = r"C:\Users\rabiukano\.gemini\antigravity-ide\brain\bd28dcba-db8c-4464-b6c8-64b2ccada8a3\media__1786119511353.png"
PROJECT_ROOT = r"d:\user\v2e\View2Earn"

def crop_full_logo_complete(raw_img):
    w, h = raw_img.size
    bg_sample = raw_img.getpixel((5, 5))
    
    # Exact full logo bounding box covering both emblem AND full "View2Earn" text with safe margins
    # Full logo span: X: 290..953, Y: 115..488
    # Using crop_box: X: 265..975, Y: 95..510 for zero clipping!
    crop_box = (265, 95, 975, 510)
    cropped = raw_img.crop(crop_box)
    
    cw, ch = cropped.size
    result = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    c_pixels = cropped.load()
    res_pixels = result.load()
    
    for y in range(ch):
        for x in range(cw):
            r, g, b, a = c_pixels[x, y]
            diff = abs(r - bg_sample[0]) + abs(g - bg_sample[1]) + abs(b - bg_sample[2])
            
            if diff < 28:
                # Background -> Transparent
                res_pixels[x, y] = (0, 0, 0, 0)
            elif diff < 90:
                # Anti-aliased edge smoothing
                alpha = int(255 * ((diff - 28) / 62.0))
                res_pixels[x, y] = (r, g, b, alpha)
            else:
                # Solid logo pixel
                res_pixels[x, y] = (r, g, b, 255)
                
    # Canvas sizing: preserve aspect ratio cleanly
    max_dim = max(cw, ch)
    target_w = 1024
    target_h = int((ch / float(cw)) * 1024)
    
    scaled = result.resize((1024, target_h), Image.Resampling.LANCZOS)
    scaled_sharp = scaled.filter(ImageFilter.UnsharpMask(radius=1.4, percent=145, threshold=2))
    
    # Square 1024x1024 canvas with padding around the full logo
    square_canvas = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    pad_y = (1024 - target_h) // 2
    square_canvas.paste(scaled_sharp, (0, pad_y), scaled_sharp)
    
    return square_canvas

def main():
    if not os.path.exists(SOURCE_IMAGE_PATH):
        print("Source image not found")
        return
        
    raw = Image.open(SOURCE_IMAGE_PATH).convert('RGBA')
    full_logo = crop_full_logo_complete(raw)
    
    # 1. Save React Native Assets
    assets_dir = os.path.join(PROJECT_ROOT, "src", "assets")
    os.makedirs(assets_dir, exist_ok=True)
    
    full_logo.save(os.path.join(assets_dir, "logo.png"), "PNG")
    full_logo.save(os.path.join(assets_dir, "icon.png"), "PNG")
    full_logo.save(os.path.join(assets_dir, "pipro_logo.png"), "PNG")
    
    pipro_jpg_path = os.path.join(assets_dir, "pipro_logo.jpg")
    jpg_bg = Image.new('RGB', full_logo.size, (255, 255, 255))
    jpg_bg.paste(full_logo, (0, 0), full_logo)
    jpg_bg.save(pipro_jpg_path, "JPEG")
    
    # 2. Save Android Launcher Icons
    android_res = os.path.join(PROJECT_ROOT, "android", "app", "src", "main", "res")
    android_sizes = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    for folder, size in android_sizes.items():
        dir_path = os.path.join(android_res, folder)
        os.makedirs(dir_path, exist_ok=True)
        sq_icon = full_logo.resize((size, size), Image.Resampling.LANCZOS)
        sq_icon.save(os.path.join(dir_path, "ic_launcher.png"), "PNG")
        sq_icon.save(os.path.join(dir_path, "ic_launcher_round.png"), "PNG")
        
    # 3. Save iOS App Icons
    ios_dir = os.path.join(PROJECT_ROOT, "ios", "View2Earn", "Images.xcassets", "AppIcon.appiconset")
    os.makedirs(ios_dir, exist_ok=True)
    ios_sizes = [40, 58, 60, 80, 87, 120, 180, 1024]
    for size in ios_sizes:
        ios_icon = full_logo.resize((size, size), Image.Resampling.LANCZOS)
        ios_rgb = Image.new('RGB', (size, size), (255, 255, 255))
        ios_rgb.paste(ios_icon, (0, 0), ios_icon)
        ios_rgb.save(os.path.join(ios_dir, f"icon-{size}.png"), "PNG")

    # 4. Web apps public assets
    web_apps = ["website", "admin-panel", "pi-app"]
    for app in web_apps:
        pub_dir = os.path.join(PROJECT_ROOT, "apps", app, "public")
        os.makedirs(pub_dir, exist_ok=True)
        full_logo.save(os.path.join(pub_dir, "logo.png"), "PNG")
        full_logo.save(os.path.join(pub_dir, "icon.png"), "PNG")

    print("\nREGENERATED ALL FULL LOGO IMAGES WITH ZERO CLIPPING!")

if __name__ == '__main__':
    main()
