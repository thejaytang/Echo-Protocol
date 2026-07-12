from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ICON_SIZES = {
    "Icon-20@2x.png": 40,
    "Icon-20@3x.png": 60,
    "Icon-29@2x.png": 58,
    "Icon-29@3x.png": 87,
    "Icon-40@2x.png": 80,
    "Icon-40@3x.png": 120,
    "Icon-60@2x.png": 120,
    "Icon-60@3x.png": 180,
    "Icon-1024.png": 1024,
}


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def render_icon(size: int) -> Image.Image:
    image = Image.new("RGB", (size, size), "#24272d")
    pixels = image.load()
    for y in range(size):
        for x in range(size):
            base = int(38 + (x / size) * 8 + (y / size) * 5)
            pixels[x, y] = (base, base + 3, base + 9)

    draw = ImageDraw.Draw(image)
    draw.ellipse(
        (int(size * 0.64), int(size * 0.10), int(size * 0.91), int(size * 0.37)),
        fill="#00aeca",
    )
    draw.ellipse(
        (int(size * -0.03), int(size * 0.63), int(size * 0.31), int(size * 0.97)),
        fill="#f59f00",
    )

    font = load_font(int(size * 0.48))
    text = "M"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    draw.text(
        ((size - text_w) / 2, (size - text_h) / 2 - int(size * 0.03)),
        text,
        fill="#ffffff",
        font=font,
    )
    return image


def main() -> None:
    output_dir = Path("ios/Mirage/Mirage/Assets.xcassets/AppIcon.appiconset")
    output_dir.mkdir(parents=True, exist_ok=True)
    for filename, size in ICON_SIZES.items():
        render_icon(size).save(output_dir / filename)


if __name__ == "__main__":
    main()
