const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const dst = path.join(__dirname, "..", "assets", "sports-images");
const names = [
  "cricket",
  "basketball",
  "football",
  "tennis",
  "volleyball",
  "badminton",
  "tabletennis",
  "pickleball",
  "baseball",
  "rugby",
  "hockey",
  "icehockey",
  "chess",
];

const OUT_W = 420;
const OUT_H = 560;
const WHITE_RATIO = 0.34; // top white zone for title

(async () => {
  for (const n of names) {
    const raw = path.join(dst, `pick-scene-${n}-raw.png`);
    if (!fs.existsSync(raw)) {
      console.error("missing", raw);
      continue;
    }

    const meta = await sharp(raw).metadata();
    const { width: w, height: h } = meta;

    // Take the bottom scene portion (skip top title area from generation)
    const cropTop = Math.round(h * 0.28);
    const cropH = h - cropTop;
    const sceneBuf = await sharp(raw)
      .extract({ left: 0, top: cropTop, width: w, height: cropH })
      .resize(OUT_W, Math.round(OUT_H * (1 - WHITE_RATIO)), { fit: "cover" })
      .jpeg({ quality: 88 })
      .toBuffer();

    const sceneMeta = await sharp(sceneBuf).metadata();
    const sceneH = sceneMeta.height;
    const topH = OUT_H - sceneH;

    const outJpg = path.join(dst, `pick-sport-${n}.jpg`);
    await sharp({
      create: {
        width: OUT_W,
        height: OUT_H,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite([{ input: sceneBuf, top: topH, left: 0 }])
      .jpeg({ quality: 85 })
      .toFile(outJpg);

    const oldPng = path.join(dst, `pick-sport-${n}.png`);
    if (fs.existsSync(oldPng)) fs.unlinkSync(oldPng);

    console.log("ok", n, Math.round(fs.statSync(outJpg).size / 1024) + "kb");
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
