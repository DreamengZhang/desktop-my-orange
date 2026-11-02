from collections import deque
from math import cos, pi, sin
from PIL import Image

root = __import__("pathlib").Path(__file__).resolve().parents[1]
src = root / "src" / "assets" / "my-orange.png"
webp_path = root / "src" / "assets" / "my-orange.webp"

raw = Image.open(src).convert("RGBA")
pad_y = 8
base = Image.new("RGBA", (raw.width, raw.height + pad_y * 2), (0, 0, 0, 0))
base.paste(raw, (0, pad_y))
bw, bh = base.size
bp = base.load()

iris = []
mouth = []
for y in range(bh):
    for x in range(bw):
        r, g, b, a = bp[x, y]
        if a < 200:
            continue
        if b > 90 and b > r + 35 and b > g + 15:
            iris.append((x, y))
        elif r < 55 and g < 55 and b < 55:
            mouth.append((x, y))

xs = [p[0] for p in iris]
split = (min(xs) + max(xs)) / 2
eye_points = [[p for p in iris if p[0] < split], [p for p in iris if p[0] >= split]]


def is_rim(r, g, b, a):
    return a > 180 and r > 150 and g > 140 and b > 130 and abs(r - g) < 45 and abs(g - b) < 50


def is_orange(r, g, b, a):
    return a > 180 and r > 150 and r > g + 30 and b < 130


def eye_pack(points):
    mask = set(points)
    cx = sum(p[0] for p in points) / len(points)
    cy = sum(p[1] for p in points) / len(points)
    opening = set(mask)
    queue = deque(points)
    while queue:
        x, y = queue.popleft()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nx, ny = x + dx, y + dy
                if (nx, ny) in opening or not (0 <= nx < bw and 0 <= ny < bh):
                    continue
                if abs(nx - cx) > 52 or abs(ny - cy) > 58:
                    continue
                if is_rim(*bp[nx, ny]):
                    opening.add((nx, ny))
                    queue.append((nx, ny))
    grown = set(mask)
    for x, y in mask:
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                nx, ny = x + dx, y + dy
                if (nx, ny) in opening:
                    grown.add((nx, ny))
    return {"mask": grown, "opening": opening, "cx": cx, "cy": cy}


eyes = [eye_pack(points) for points in eye_points]
face_cx = (eyes[0]["cx"] + eyes[1]["cx"]) / 2
face_cy = ((eyes[0]["cy"] + eyes[1]["cy"]) / 2 + sum(p[1] for p in mouth) / len(mouth)) / 2
face_rx, face_ry = 176, 132


def nearest_white(eye, x, y):
    for radius in range(1, 16):
        for dy in range(-radius, radius + 1):
            for dx in range(-radius, radius + 1):
                if max(abs(dx), abs(dy)) != radius:
                    continue
                nx, ny = x + dx, y + dy
                if (nx, ny) in eye["opening"] and (nx, ny) not in eye["mask"] and is_rim(*bp[nx, ny]):
                    return bp[nx, ny]
    return (236, 236, 232, 255)


for eye in eyes:
    eye["fill"] = {point: nearest_white(eye, *point) for point in eye["mask"]}


def apply_gaze(frame, dx, dy):
    if dx == 0 and dy == 0:
        return
    pixels = frame.load()
    for eye in eyes:
        moved = []
        for x, y in eye["mask"]:
            moved.append((x, y, bp[x, y]))
            pixels[x, y] = eye["fill"][(x, y)]
        for x, y, color in moved:
            nx = int(round(x + dx))
            ny = int(round(y + dy))
            if (nx, ny) in eye["opening"] and 0 <= nx < bw and 0 <= ny < bh:
                pixels[nx, ny] = color


def soft_lids(frame, cover):
    pixels = frame.load()
    lid = (42, 28, 24, 255)
    for eye in eyes:
        ys = [y for _, y in eye["mask"]]
        xs = [x for x, _ in eye["mask"]]
        top, bottom = min(ys), max(ys)
        cutoff = top + (bottom - top) * cover
        samples = [bp[x, y] for x, y in eye["opening"] if (x, y) not in eye["mask"] and is_rim(*bp[x, y])]
        white = (
            tuple(sum(color[i] for color in samples) // len(samples) for i in range(4))
            if samples
            else (236, 236, 232, 255)
        )
        for x, y in eye["mask"]:
            if y <= cutoff:
                pixels[x, y] = white
        if cover < 0.95:
            yy = int(cutoff)
            for x in range(min(xs), max(xs) + 1):
                if pixels[x, yy][3] > 0 and (x, yy) in eye["opening"]:
                    pixels[x, yy] = lid
            continue
        half = (max(xs) - min(xs)) / 2 or 1
        mid = (min(xs) + max(xs)) / 2
        lid_y = (top + bottom) / 2
        for x in range(min(xs), max(xs) + 1):
            t = (x - mid) / half
            yy = int(round(lid_y + t * t * 4))
            for dy in (0, 1):
                py = yy + dy
                if (x, py) in eye["opening"]:
                    pixels[x, py] = lid


def face_weight(x, y):
    dx = (x - face_cx) / face_rx
    dy = (y - face_cy) / face_ry
    t = dx * dx + dy * dy
    if t >= 1:
        return 0.0
    u = 1 - t
    return u * u * (3 - 2 * u)


def sample(pixels, x, y):
    if x < 0 or y < 0 or x >= bw - 1 or y >= bh - 1:
        xi = min(bw - 1, max(0, int(x)))
        yi = min(bh - 1, max(0, int(y)))
        return pixels[xi, yi]
    x0 = int(x)
    y0 = int(y)
    fx = x - x0
    fy = y - y0
    c00 = pixels[x0, y0]
    c10 = pixels[x0 + 1, y0]
    c01 = pixels[x0, y0 + 1]
    c11 = pixels[x0 + 1, y0 + 1]

    def channel(index):
        return int(
            c00[index] * (1 - fx) * (1 - fy)
            + c10[index] * fx * (1 - fy)
            + c01[index] * (1 - fx) * fy
            + c11[index] * fx * fy
        )

    return (channel(0), channel(1), channel(2), channel(3))


def warp_face(frame, dx, dy):
    if dx == 0 and dy == 0:
        return frame
    pixels = frame.load()
    out = frame.copy()
    dest = out.load()
    x0 = max(0, int(face_cx - face_rx))
    x1 = min(bw - 1, int(face_cx + face_rx))
    y0 = max(0, int(face_cy - face_ry))
    y1 = min(bh - 1, int(face_cy + face_ry))
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            weight = face_weight(x, y)
            if weight <= 0:
                continue
            dest[x, y] = sample(pixels, x - dx * weight, y - dy * weight)
    return out


def apply_bob(frame, amount):
    if amount == 0:
        return frame
    moved = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    moved.paste(frame, (0, amount))
    return moved


rows = [
    {"bob": 0, "blink": 0},
    {"bob": 3, "blink": 0},
    {"bob": 6, "blink": 0},
    {"bob": 3, "blink": 0},
    {"bob": 1, "blink": 1},
    {"bob": 0, "blink": 2},
]
shift = 5
gazes = [(0, 0)]
for step in range(8):
    angle = -pi / 2 + step * (pi / 4)
    gazes.append((round(cos(angle) * shift), round(sin(angle) * shift)))

sheet = Image.new("RGBA", (bw * len(gazes), bh * len(rows)), (0, 0, 0, 0))
for row, spec in enumerate(rows):
    body = apply_bob(base.copy(), spec["bob"])
    for col, (dx, dy) in enumerate(gazes):
        frame = body.copy()
        if spec["blink"] < 2:
            apply_gaze(frame, dx, dy)
        if spec["blink"]:
            soft_lids(frame, 0.62 if spec["blink"] == 1 else 1)
        frame = warp_face(frame, round(dx / shift * 14) if dx else 0, round(dy / shift * 8) if dy else 0)
        sheet.paste(frame, (col * bw, row * bh))
    print("row", row)

sheet.save(webp_path, "WEBP", quality=82, method=4)
print("saved", sheet.size, "frame", bw, bh, "face", round(face_cx), round(face_cy))
