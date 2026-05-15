import { init } from "./commands/init.js";

const VERSION = "0.1.0";

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write(
    `ccup ${VERSION} — Claude Code Up\n\n` +
      `Usage: ccup [dir] [--force]\n\n` +
      `Initialize a new project pre-configured for Claude Code.\n\n` +
      `Options:\n` +
      `  --force, -f    Allow non-empty target directory\n` +
      `  --help, -h     Show this help\n` +
      `  --version, -v  Show version\n`,
  );
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  process.stdout.write(`${VERSION}\n`);
  process.exit(0);
}

const force = args.includes("--force") || args.includes("-f");
const targetDir = args.find((a) => !a.startsWith("-"));

init({ targetDir, force }).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`\n${message}\n`);
  process.exit(1);
});
