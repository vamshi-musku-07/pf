"""Remove near-white edge-connected backgrounds from football scoring icons."""
from __future__ import annotations

import os
from collections import deque

import numpy as np
from PIL import Image

try:
    from scipy import ndimage
except ImportError:
    import subprocess
    import sys

    subprocess.check_call([sys.executable, "-m", "pip", "install", "scipy", "-q"])
    from scipy import ndimage

DIR = os.path.join(
    os.path.dirname(__file__),
    "..",
    "assets",
    "images",
    "football-scoring",
)


def remove_bg(path: str, thr: int = 238, soft: int = 18) -> None:
    im = Image.open(path).convert("RGB")
    arr = np.asarray(im).astype(np.int16)
    h, w = arr.shape[:2]

    near = (arr[:, :, 0] >= thr) & (arr[:, :, 1] >= thr) & (arr[:, :, 2] >= thr)
    mx = arr.max(axis=2)
    mn = arr.min(axis=2)
    near = near | ((mx >= thr - 5) & ((mx - mn) <= 12) & (mx >= 230))

    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()

    for x in range(w):
        if near[0, x]:
            q.append((0, x))
            visited[0, x] = True
        if near[h - 1, x]:
            q.append((h - 1, x))
            visited[h - 1, x] = True
    for y in range(h):
        if near[y, 0] and not visited[y, 0]:
            q.append((y, 0))
            visited[y, 0] = True
        if near[y, w - 1] and not visited[y, w - 1]:
            q.append((y, w - 1))
            visited[y, w - 1] = True

    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and near[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

    alpha = np.where(visited, 0, 255).astype(np.uint8)

    dil = ndimage.binary_dilation(visited, iterations=2)
    fringe = dil & (~visited)
    light = mx.astype(np.int16)
    sat = (mx - mn).astype(np.int16)
    fade = fringe & (light >= thr - soft) & (sat <= 20)
    if fade.any():
        t = np.clip((light.astype(np.float32) - (thr - soft)) / float(soft), 0, 1)
        a_fade = (255 * (1.0 - t)).astype(np.uint8)
        alpha = np.where(fade, np.minimum(alpha, a_fade), alpha)

    alpha[visited] = 0
    out = np.dstack([arr.astype(np.uint8), alpha])
    Image.fromarray(out, "RGBA").save(path, optimize=True)
    transparent = (alpha == 0).mean() * 100
    print(f"{os.path.basename(path)}: {transparent:.1f}% transparent")


def main() -> None:
    folder = os.path.abspath(DIR)
    for name in sorted(os.listdir(folder)):
        if name.endswith(".png"):
            remove_bg(os.path.join(folder, name))
    print("done")


if __name__ == "__main__":
    main()
