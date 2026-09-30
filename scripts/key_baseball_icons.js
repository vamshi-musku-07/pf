/* Remove solid near-black backgrounds via edge flood-fill. Never key light/white subject pixels. */
const fs = require("fs");
const path = require("path");

let PNG;
try {
  PNG = require("pngjs").PNG;
} catch {
  PNG = require(path.join(__dirname, "../node_modules/pngjs")).PNG;
}

const ROOT = path.join(__dirname, "../assets/images/baseball-scoring");

function isNearBlack(r, g, b, thr = 48) {
  return r <= thr && g <= thr && b <= thr;
}

function keyFile(filePath) {
  const png = PNG.sync.read(fs.readFileSync(filePath));
  const { width, height, data } = png;
  const idx = (x, y) => (y * width + x) * 4;
  const thr = 52;

  const visited = new Uint8Array(width * height);
  const queue = [];

  const trySeed = (x, y) => {
    const i = idx(x, y);
    if (!isNearBlack(data[i], data[i + 1], data[i + 2], thr)) return;
    const vi = y * width + x;
    if (visited[vi]) return;
    visited[vi] = 1;
    queue.push([x, y]);
  };

  for (let x = 0; x < width; x++) {
    trySeed(x, 0);
    trySeed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    trySeed(0, y);
    trySeed(width - 1, y);
  }

  let head = 0;
  while (head < queue.length) {
    const [x, y] = queue[head++];
    const i = idx(x, y);
    data[i + 3] = 0;
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const vi = ny * width + nx;
      if (visited[vi]) continue;
      const ni = idx(nx, ny);
      if (isNearBlack(data[ni], data[ni + 1], data[ni + 2], thr)) {
        visited[vi] = 1;
        queue.push([nx, ny]);
      }
    }
  }

  // Soften only near-black fringe next to transparent
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = idx(x, y);
      if (data[i + 3] === 0) continue;
      if (!isNearBlack(data[i], data[i + 1], data[i + 2], thr + 18)) continue;
      let touch = false;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (data[idx(x + dx, y + dy) + 3] === 0) {
          touch = true;
          break;
        }
      }
      if (touch) data[i + 3] = Math.min(data[i + 3], 70);
    }
  }

  fs.writeFileSync(filePath, PNG.sync.write(png));
  console.log("ok", path.basename(filePath), "removed", queue.length);
}

const mapping = [
  ["bb-ball-black.png", "baseball-score-ball.png"],
  ["bb-strike-black.png", "baseball-score-strike.png"],
  ["bb-foul-black.png", "baseball-score-foul.png"],
];

const srcDir = path.join(
  process.env.USERPROFILE || "",
  ".cursor/projects/c-pff/assets",
);

for (const [srcName, destName] of mapping) {
  const src = path.join(srcDir, srcName);
  if (!fs.existsSync(src)) {
    console.error("missing", src);
    continue;
  }
  for (const dir of [ROOT, path.join(ROOT, "thumbs")]) {
    const dest = path.join(dir, destName);
    fs.copyFileSync(src, dest);
    keyFile(dest);
  }
}
