/**
 * Shared release metadata → HTML for index.html markers.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const releaseRoot = path.resolve(__dirname, "..", "release");

export function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(releaseRoot, name), "utf8"));
}

export function writeJson(name, data) {
  fs.writeFileSync(path.join(releaseRoot, name), JSON.stringify(data, null, 2) + "\n", "utf8");
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSection(section) {
  if (!section.items?.length) return "";
  const items = section.items
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.title)}</strong> — ${escapeHtml(item.description)}</li>`
    )
    .join("\n                                ");
  return `<section class="changelog-section">
                            <h3 class="changelog-section-title"><i class="fa-solid ${section.icon} ${section.iconClass}"></i> ${escapeHtml(section.title)}</h3>
                            <ul class="changelog-list">
                                ${items}
                            </ul>
                        </section>`;
}

function renderArchivedSections(release) {
  const blocks = (release.sections || []).map(renderSection).filter(Boolean);
  if (!blocks.length) return "";
  const dateSuffix = release.releaseDate ? ` — ${escapeHtml(release.releaseDate)}` : "";
  return `<section class="changelog-section border-t border-slate-700 pt-4 mt-2">
                            <h3 class="changelog-section-title text-slate-400"><i class="fa-solid fa-clock-rotate-left"></i> Version ${escapeHtml(release.version)}${dateSuffix}</h3>
                            ${blocks.join("\n\n                        ")}
                        </section>`;
}

function renderArchivedSummary(release) {
  const dateSuffix = release.releaseDate ? ` — ${escapeHtml(release.releaseDate)}` : "";
  return `<section class="changelog-section border-t border-slate-700 pt-4">
                            <h3 class="changelog-section-title text-slate-500"><i class="fa-solid fa-clock-rotate-left"></i> Version ${escapeHtml(release.version)}${dateSuffix}</h3>
                            <p class="text-slate-500 text-xs leading-relaxed">${escapeHtml(release.summary || "")}</p>
                        </section>`;
}

/** Current release sections + prior releases preserved below. */
export function renderChangelogBody(changelog, currentVersion) {
  const releases = changelog.releases || [];
  const current = releases.find((r) => r.version === currentVersion) || releases[0];
  const prior = releases.filter((r) => r.version !== current?.version);

  const currentHtml = (current?.sections || []).map(renderSection).filter(Boolean).join("\n\n                        ");
  const priorHtml = prior
    .map((r) => (r.sections?.length ? renderArchivedSections(r) : renderArchivedSummary(r)))
    .join("\n\n                        ");

  return [currentHtml, priorHtml].filter(Boolean).join("\n\n                        ");
}

export function buildReleaseFragments() {
  const { version, releaseDate } = readJson("version.json");
  const changelog = readJson("changelog.json");
  const verLabel = `Ver ${version}`;

  return {
    version,
    releaseDate,
    versionBadge: verLabel,
    changelogButton: `What's New in ${verLabel}`,
    modalTitle: `Metrology Data Analyzer — Version ${version}`,
    modalSubtitle: releaseDate ? `${releaseDate} release notes` : "Release notes",
    changelogBody: renderChangelogBody(changelog, version),
  };
}

export function replaceMarker(html, name, content) {
  const re = new RegExp(`<!-- release:${name} -->[\\s\\S]*?<!-- /release:${name} -->`, "m");
  if (!re.test(html)) {
    throw new Error(`Missing release marker: <!-- release:${name} --> ... <!-- /release:${name} -->`);
  }
  return html.replace(re, `<!-- release:${name} -->\n${content}\n            <!-- /release:${name} -->`);
}
