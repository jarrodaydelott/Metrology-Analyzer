/**
 * Injects release/version.json + release/changelog.json into index.html markers.
 * Run automatically before bundle, or manually: npm run sync-release
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildReleaseFragments,
  replaceMarker,
} from "./release-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = path.join(root, "index.html");

export function syncRelease() {
  let html = fs.readFileSync(indexPath, "utf8");
  const f = buildReleaseFragments();

  html = replaceMarker(html, "version-badge", `<span class="text-blue-500 text-xl ml-2">${f.versionBadge}</span>`);
  html = replaceMarker(html, "changelog-button", f.changelogButton);
  html = replaceMarker(
    html,
    "changelog-modal-header",
    `<h2 id="changelog-modal-title" class="text-xl font-bold text-slate-100">${f.modalTitle}</h2>
                            <p class="text-sm text-slate-400 mt-1">${f.modalSubtitle}</p>`
  );
  html = replaceMarker(html, "changelog-body", f.changelogBody);

  fs.writeFileSync(indexPath, html, "utf8");
  console.log(`sync-release: updated index.html for version ${f.version}`);
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) syncRelease();
