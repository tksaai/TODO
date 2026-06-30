import { cp, mkdir, rm } from "node:fs/promises";

const files = [
  "index.html",
  "style.css",
  "app.js",
  "config.js",
  "_headers",
  "_redirects"
];

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

for (const file of files) {
  await cp(file, `dist/${file}`);
}

await cp("assets", "dist/assets", { recursive: true });
