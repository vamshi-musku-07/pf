const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const srcDir = "C:\\Users\\eagle\\.cursor\\projects\\c-pff\\assets";
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
const BLACK_RATIO = 0.34;

(async () => {
  for (const n of names) {
    const rawIn = path.join(srcDir, `pick-dark-${n}.png`);
    if (!fs.existsSync(rawIn)) {
      console.error("missing", rawIn);
      continue;
    }

    const meta = await sharp(rawIn).metadata();
    const { width: w, height: h } = meta;

    // Skip generated title/light top; keep bottom scene
    const cropTop = Math.round(h * 0.3);
    const cropH = h - cropTop;
    const sceneBuf = await sharp(rawIn)
      .extract({ left: 0, top: cropTop, width: w, height: cropH })
      .resize(OUT_W, Math.round(OUT_H * (1 - BLACK_RATIO)), { fit: "cover" })
      .jpeg({ quality: 88 })
      .toBuffer();

    const sceneMeta = await sharp(sceneBuf).metadata();
    const sceneH = sceneMeta.height;
    const topH = OUT_H - sceneH;

    const outJpg = path.join(dst, `pick-sport-dark-${n}.jpg`);
    await sharp({
      create: {
        width: OUT_W,
        height: OUT_H,
        channels: 3,
        background: { r: 0, g: 0, b: 0 }, // pure black — matches dark card + image sky
      },
    })
      .composite([{ input: sceneBuf, top: topH, left: 0 }])
      .jpeg({ quality: 85 })
      .toFile(outJpg);

    console.log("ok", n, Math.round(fs.statSync(outJpg).size / 1024) + "kb");
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
