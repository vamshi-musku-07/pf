from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path
from collections import deque

src_dir = Path(r"C:\Users\eagle\.cursor\projects\c-pff\assets")
out_dir = Path(r"C:\pff\play_flash_application\app\assets\role-badges")
out_dir.mkdir(parents=True, exist_ok=True)

names = [
    "role-player.png",
    "role-coach.png",
    "role-parent.png",
    "role-referee.png",
    "role-organizer.png",
    "role-club-admin.png",
    "role-volunteer.png",
    "role-media.png",
    "role-physio.png",
    "role-trainer.png",
    "role-fan.png",
    "role-all-rounder.png",
]


def color_dist(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def flood_clear_background(im, thresh=55):
    """Clear square canvas by flood-filling from corners; keeps white sticker rim."""
    w, h = im.size
    px = im.load()
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    visited = [[False] * w for _ in range(h)]
    q = deque()

    for sx, sy in seeds:
        bg = px[sx, sy][:3]
        q.append((sx, sy, bg))
        visited[sy][sx] = True

    while q:
        x, y, bg = q.popleft()
        r, g, b, a = px[x, y]
        if color_dist((r, g, b), bg) > thresh:
            continue
        px[x, y] = (r, g, b, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                visited[ny][nx] = True
                nr, ng, nb, na = px[nx, ny]
                if color_dist((nr, ng, nb), bg) <= thresh:
                    q.append((nx, ny, bg))


def process(path, out_path):
    im = Image.open(path).convert("RGBA")
    flood_clear_background(im)

    bbox = im.getbbox()
    if not bbox:
        im.save(out_path)
        return

    im = im.crop(bbox)
    # tight pad for soft shadow
    pad = max(8, min(im.size) // 25)
    padded = Image.new("RGBA", (im.size[0] + pad * 2, im.size[1] + pad * 2), (0, 0, 0, 0))
    padded.paste(im, (pad, pad), im)
    im = padded

    side = max(im.size)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ox = (side - im.size[0]) // 2
    oy = (side - im.size[1]) // 2
    sq.paste(im, (ox, oy), im)

    # Soft circular mask — kills any leftover square corners
    mask = Image.new("L", (side, side), 0)
    draw = ImageDraw.Draw(mask)
    inset = max(2, side // 80)
    draw.ellipse((inset, inset, side - 1 - inset, side - 1 - inset), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=max(1.0, side / 280)))

    r, g, b, a = sq.split()
    a = Image.composite(a, Image.new("L", (side, side), 0), mask)
    out = Image.merge("RGBA", (r, g, b, a))
    out = out.resize((512, 512), Image.Resampling.LANCZOS)
    out.save(out_path, "PNG")
    print(f"OK {out_path.name}")


for name in names:
    src = src_dir / name
    if not src.exists():
        print("MISSING", src)
        continue
    process(src, out_dir / name)

print("done")
