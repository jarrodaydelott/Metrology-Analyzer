/**
 * Publish a new version:
 *   npm run release -- 1.7 "June 2026"
 *
 * - Bumps release/version.json
 * - Moves release/unreleased.json items into the new release
 * - Archives the previous release in release/changelog.json (kept in modal history)
 * - Regenerates index.html via sync-release
 */
import { readJson, writeJson } from "./release-lib.mjs";
import { syncRelease } from "./sync-release.mjs";

function parseArgs() {
  const args = process.argv.slice(2);
  if (!args[0]) {
    console.error("Usage: npm run release -- <version> [releaseDate]");
    console.error('Example: npm run release -- 1.7 "June 2026"');
    process.exit(1);
  }
  if (!/^\d+\.\d+(\.\d+)?$/.test(args[0])) {
    console.error(`Invalid version "${args[0]}". Use semver like 1.7 or 1.7.0`);
    process.exit(1);
  }
  return { newVersion: args[0], releaseDate: args[1] || "" };
}

function emptyUnreleasedTemplate() {
  const current = readJson("unreleased.json");
  writeJson("unreleased.json", {
    sections: (current.sections || []).map((s) => ({
      id: s.id,
      title: s.title,
      icon: s.icon,
      iconClass: s.iconClass,
      items: [],
    })),
  });
}

function main() {
  const { newVersion, releaseDate } = parseArgs();
  const versionMeta = readJson("version.json");
  const changelog = readJson("changelog.json");
  const unreleased = readJson("unreleased.json");

  const currentVersion = versionMeta.version;
  if (newVersion === currentVersion) {
    console.error(`Already on version ${currentVersion}. Choose a higher version number.`);
    process.exit(1);
  }

  const newSections = (unreleased.sections || []).map((section) => ({
    ...section,
    items: [...(section.items || [])],
  }));
  const unreleasedCount = newSections.reduce((n, s) => n + (s.items?.length || 0), 0);

  if (unreleasedCount === 0) {
    console.warn(
      `Warning: release/unreleased.json has no new items. Version ${newVersion} will ship with an empty changelog section.`
    );
    console.warn("Add entries to release/unreleased.json, then run release again before publishing.");
  }

  const newRelease = {
    version: newVersion,
    releaseDate,
    sections: newSections.filter((s) => s.items.length > 0),
  };

  const others = (changelog.releases || []).filter((r) => r.version !== newVersion);
  changelog.releases = [newRelease, ...others];

  versionMeta.version = newVersion;
  versionMeta.releaseDate = releaseDate;

  writeJson("version.json", versionMeta);
  writeJson("changelog.json", changelog);
  emptyUnreleasedTemplate();

  console.log(`release: published v${newVersion}${releaseDate ? ` (${releaseDate})` : ""}`);
  console.log(`release: archived v${currentVersion} in changelog history`);

  syncRelease();
}

main();
