import { readFile, mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

async function main() {
  const input = await readFile("public/brand/app-icon.svg");
  await mkdir("public/icons", { recursive: true });
  const sizes = [16, 32, 180, 192, 512];
  const pngs = await Promise.all(
    sizes.map(async (size) => {
      const png = await sharp(input)
        .resize(size, size)
        .png({ compressionLevel: 9 })
        .toBuffer();
      await writeFile(`public/icons/icon-${size}.png`, png);
      return png;
    }),
  );
  // ICO permits lossless PNG entries. Encode the directory directly: no lossy
  // conversion or extra icon library; offsets and dimensions are deterministic.
  const header = Buffer.alloc(6 + 2 * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(2, 4);
  let offset = header.length;
  for (let i = 0; i < 2; i++) {
    const entry = 6 + i * 16;
    header[entry] = sizes[i];
    header[entry + 1] = sizes[i];
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(pngs[i].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += pngs[i].length;
  }
  await writeFile(
    "public/icons/favicon.ico",
    Buffer.concat([header, ...pngs.slice(0, 2)]),
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
