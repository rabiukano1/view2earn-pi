import os
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

SOURCE_IMAGE_PATH = r"C:\Users\rabiukano\.gemini\antigravity-ide\brain\bd28dcba-db8c-4464-b6c8-64b2ccada8a3\media__1786119511353.png"
PROJECT_ROOT = r"d:\user\v2e\View2Earn"

def make_transparent_background(raw_img):
    w, h = raw_img.size
    bg_sample = raw_img.getpixel((5, 5))
    
    result = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    pixels = raw_img.load()
    res_pixels = result.load()
    
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            diff = abs(r - bg_sample[0]) + abs(g - bg_sample[1]) + abs(b - bg_sample[2])
            
            if diff < 35:
                # Fully transparent background
                res_pixels[x, y] = (0, 0, 0, 0)
            elif diff < 95:
                # Soft alpha falloff for smooth anti-aliased edges
                factor = (diff - 35) / 60.0
                alpha = int(255 * factor)
                res_pixels[x, y] = (r, g, b, alpha)
            else:
                res_pixels[x, y] = (r, g, b, 255)
                
    return result

def make_round_icon(image):
    size = image.size
    mask = Image.new('L', size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size[0], size[1]), fill=255)
    
    output = Image.new('RGBA', size, (0, 0, 0, 0))
    output.paste(image, (0, 0), mask)
    return output

def enhance_sharpness(img):
    # Apply unsharp mask while preserving alpha channel
    rgb = img.convert('RGB').filter(ImageFilter.UnsharpMask(radius=1.2, percent=140, threshold=2))
    enhancer = ImageEnhance.Contrast(rgb)
    rgb_enhanced = enhancer.enhance(1.05)
    
    output = Image.new('RGBA', img.size, (0, 0, 0, 0))
    output.paste(rgb_enhanced, (0, 0), img.split()[3])
    return output

def crop_emblem_tight(img):
    # Tight emblem bounding box: x=278..745, y=103..429
    crop_box = (278, 103, 745, 429)
    emblem = img.crop(crop_box)
    
    max_dim = max(emblem.width, emblem.height)
    padding = int(max_dim * 0.04) # Minimal margin
    square_size = max_dim + padding * 2
    
    # Fully transparent canvas
    square_img = Image.new('RGBA', (square_size, square_size), (0, 0, 0, 0))
    offset = ((square_size - emblem.width) // 2, (square_size - emblem.height) // 2)
    square_img.paste(emblem, offset, emblem)
    return square_img

def crop_full_logo_tight(img):
    # Full logo tight box: x=270..755, y=103..495
    crop_box = (270, 103, 755, 495)
    full_logo = img.crop(crop_box)
    
    pad_w = int(full_logo.width * 0.05)
    pad_h = int(full_logo.height * 0.08)
    
    # Fully transparent canvas
    padded = Image.new('RGBA', (full_logo.width + pad_w*2, full_logo.height + pad_h*2), (0, 0, 0, 0))
    padded.paste(full_logo, (pad_w, pad_h), full_logo)
    return padded

def main():
    if not os.path.exists(SOURCE_IMAGE_PATH):
        print(f"Error: Source image not found at {SOURCE_IMAGE_PATH}")
        sys.exit(1)
        
    raw_img = Image.open(SOURCE_IMAGE_PATH).convert('RGBA')
    print(f"Loaded source image: {raw_img.size}")
    
    # Remove background to make it transparent/clear
    src_img = make_transparent_background(raw_img)
    print("Converted image background to TRANSPARENT (clear background)")
    
    # 1. Full logo (transparent)
    full_logo = crop_full_logo_tight(src_img)
    full_logo_crisp = enhance_sharpness(full_logo)
    
    full_logo_path = os.path.join(PROJECT_ROOT, "src", "assets", "logo.png")
    full_logo_crisp.save(full_logo_path, "PNG")
    print(f"Saved transparent full logo to {full_logo_path}")
    
    pipro_logo_path = os.path.join(PROJECT_ROOT, "src", "assets", "pipro_logo.png")
    full_logo_crisp.save(pipro_logo_path, "PNG")
    
    # 2. Square emblem icon (transparent)
    icon_square = crop_emblem_tight(src_img)
    icon_crisp = enhance_sharpness(icon_square)
    src_icon_path = os.path.join(PROJECT_ROOT, "src", "assets", "icon.png")
    icon_crisp.save(src_icon_path, "PNG")
    print(f"Saved transparent emblem icon to {src_icon_path}")
    
    # 3. Android Mipmap icons (transparent PNG)
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
        
        sq_icon = icon_square.resize((size, size), Image.Resampling.LANCZOS)
        sq_icon = enhance_sharpness(sq_icon)
        
        sq_path = os.path.join(dir_path, "ic_launcher.png")
        sq_icon.save(sq_path, "PNG")
        
        rd_icon = make_round_icon(sq_icon)
        rd_path = os.path.join(dir_path, "ic_launcher_round.png")
        rd_icon.save(rd_path, "PNG")
        print(f"Updated Android {folder} ({size}x{size}) with transparent background")

    # 4. iOS App Icon set (iOS requires opaque icon, using white bg behind transparent icon)
    ios_dir = os.path.join(PROJECT_ROOT, "ios", "View2Earn", "Images.xcassets", "AppIcon.appiconset")
    os.makedirs(ios_dir, exist_ok=True)
    
    ios_sizes = [
        ("icon-40.png", 40),
        ("icon-60.png", 60),
        ("icon-58.png", 58),
        ("icon-87.png", 87),
        ("icon-80.png", 80),
        ("icon-120.png", 120),
        ("icon-180.png", 180),
        ("icon-1024.png", 1024),
    ]
    
    for name, size in ios_sizes:
        ios_rescaled = icon_square.resize((size, size), Image.Resampling.LANCZOS)
        ios_rescaled = enhance_sharpness(ios_rescaled)
        
        ios_rgb = Image.new('RGB', (size, size), (255, 255, 255))
        ios_rgb.paste(ios_rescaled, (0, 0), ios_rescaled)
        ios_path = os.path.join(ios_dir, name)
        ios_rgb.save(ios_path, "PNG")
        print(f"Saved iOS icon {name} ({size}x{size})")

    # 5. Web apps (website, admin-panel, pi-app)
    web_apps = ["website", "admin-panel", "pi-app"]
    for app in web_apps:
        pub_dir = os.path.join(PROJECT_ROOT, "apps", app, "public")
        os.makedirs(pub_dir, exist_ok=True)
        
        full_logo_crisp.save(os.path.join(pub_dir, "logo.png"), "PNG")
        
        fav_32 = icon_square.resize((32, 32), Image.Resampling.LANCZOS)
        fav_32 = enhance_sharpness(fav_32)
        fav_32.save(os.path.join(pub_dir, "favicon.ico"), format="ICO")
        
        apple_icon = icon_square.resize((180, 180), Image.Resampling.LANCZOS)
        apple_icon = enhance_sharpness(apple_icon)
        apple_icon.save(os.path.join(pub_dir, "apple-touch-icon.png"), "PNG")
        
        icon_512 = icon_square.resize((512, 512), Image.Resampling.LANCZOS)
        icon_512 = enhance_sharpness(icon_512)
        icon_512.save(os.path.join(pub_dir, "icon.png"), "PNG")
        print(f"Updated transparent public assets for app: {app}")

    print("\nALL TRANSPARENT/CLEAR LOGOS AND ICONS GENERATED SUCCESSFULLY!")

if __name__ == '__main__':
    main()
