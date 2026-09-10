import os
from PIL import Image, ImageEnhance, ImageFilter

SOURCE_IMAGE_PATH = r"C:\Users\rabiukano\.gemini\antigravity-ide\brain\bd28dcba-db8c-4464-b6c8-64b2ccada8a3\media__1786119511353.png"
PROJECT_ROOT = r"d:\user\v2e\View2Earn"

def clean_hd_emblem(raw_img):
    w, h = raw_img.size
    bg_sample = raw_img.getpixel((5, 5))
    
    # Bounding box for emblem graphic only (excluding text below)
    # x=280..745, y=103..428
    crop_box = (280, 103, 745, 428)
    cropped = raw_img.crop(crop_box)
    
    cw, ch = cropped.size
    result = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    c_pixels = cropped.load()
    res_pixels = result.load()
    
    for y in range(ch):
        for x in range(cw):
            r, g, b, a = c_pixels[x, y]
            diff = abs(r - bg_sample[0]) + abs(g - bg_sample[1]) + abs(b - bg_sample[2])
            
            if diff < 25:
                # Background -> Transparent
                res_pixels[x, y] = (0, 0, 0, 0)
            elif diff < 85:
                # Anti-aliased edge smoothing
                alpha = int(255 * ((diff - 25) / 60.0))
                res_pixels[x, y] = (r, g, b, alpha)
            else:
                # Emblem pixel -> 100% solid opacity
                res_pixels[x, y] = (r, g, b, 255)
                
    # Place on 1024x1024 canvas for crisp high-resolution rendering
    max_dim = max(cw, ch)
    target_dim = 1024
    scale = target_dim / float(max_dim)
    
    new_w = int(cw * scale * 0.85)
    new_h = int(ch * scale * 0.85)
    
    scaled = result.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # Unsharp mask for high-definition sharpness
    scaled_sharp = scaled.filter(ImageFilter.UnsharpMask(radius=1.5, percent=150, threshold=2))
    
    final_canvas = Image.new('RGBA', (target_dim, target_dim), (0, 0, 0, 0))
    offset = ((target_dim - new_w) // 2, (target_dim - new_h) // 2)
    final_canvas.paste(scaled_sharp, offset, scaled_sharp)
    
    return final_canvas

def main():
    if not os.path.exists(SOURCE_IMAGE_PATH):
        print("Source image not found")
        return
        
    raw = Image.open(SOURCE_IMAGE_PATH).convert('RGBA')
    hd_logo = clean_hd_emblem(raw)
    
    # Save HD transparent logos
    assets_dir = os.path.join(PROJECT_ROOT, "src", "assets")
    os.makedirs(assets_dir, exist_ok=True)
    
    hd_logo.save(os.path.join(assets_dir, "logo.png"), "PNG")
    hd_logo.save(os.path.join(assets_dir, "icon.png"), "PNG")
    hd_logo.save(os.path.join(assets_dir, "pipro_logo.png"), "PNG")
    print("Saved ultra HD 1024x1024 transparent logos successfully!")

if __name__ == '__main__':
    main()
