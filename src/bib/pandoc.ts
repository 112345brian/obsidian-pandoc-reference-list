import { Platform } from 'obsidian';
import { PartialCSLEntry } from './types';

async function execFileAsync(
  file: string,
  args: string[],
  options?: { maxBuffer?: number }
): Promise<{ stdout: string; stderr: string }> {
  const [{ execFile }, { promisify }] = await Promise.all([
    import('child_process'),
    import('util'),
  ]);
  return promisify(execFile)(file, args, options);
}

/**
 * Convert a bibliography file to CSL-JSON using Pandoc.
 * Desktop only — throws on mobile.
 */
export async function bibToCSLViaPandoc(
  bibPath: string,
  pathToPandoc: string
): Promise<PartialCSLEntry[]> {
  if (!Platform.isDesktop) {
    throw new Error('Pandoc is not available on mobile.');
  }

  const args = [bibPath, '-t', 'csljson', '--quiet'];

  let res: { stdout: string; stderr: string };
  try {
    res = await execFileAsync(pathToPandoc, args, { maxBuffer: 50 * 1024 * 1024 });
  } catch (e) {
    const stderr = (e as any)?.stderr || '';
    if (/Unknown output format csljson/.test(stderr)) {
      throw new Error(
        `Pandoc at '${pathToPandoc}' does not support CSL JSON output. ` +
          'Please install Pandoc 2.11 or newer, then update the path in plugin settings.'
      );
    }
    throw e;
  }

  if (res.stderr) throw new Error(`bibToCSL (pandoc): ${res.stderr}`);
  return JSON.parse(res.stdout);
}

/**
 * Attempt to find the pandoc binary.
 * Desktop only — returns null on mobile or if not found.
 *
 * Electron apps don't inherit the shell PATH, so `which` often fails even
 * when Pandoc is installed via Homebrew. We fall back to checking a list of
 * well-known locations directly.
 */
export async function findPandoc(): Promise<string | null> {
  if (!Platform.isDesktop) return null;
  const platform = globalThis.process?.platform;

  // Try `which` / `where` first — works if Pandoc is on the process PATH.
  const cmd = platform === 'win32' ? 'where' : 'which';
  try {
    const { stdout } = await execFileAsync(cmd, ['pandoc']);
    const found = stdout.trim().split('\n')[0];
    if (found) return found;
  } catch {
    // PATH lookup failed — fall through to known locations.
  }

  // Common install locations to try directly.
  const candidates =
    platform === 'win32'
      ? [
          'C:\\Program Files\\Pandoc\\pandoc.exe',
          'C:\\Program Files (x86)\\Pandoc\\pandoc.exe',
        ]
      : [
          '/opt/homebrew/bin/pandoc', // Apple Silicon Homebrew
          '/usr/local/bin/pandoc',    // Intel Homebrew / manual install
          '/usr/bin/pandoc',          // Linux system package
          '/snap/bin/pandoc',         // Snap
        ];

  const [{ execFile }, { promisify }] = await Promise.all([
    import('child_process'),
    import('util'),
  ]);
  const execAsync = promisify(execFile);

  for (const p of candidates) {
    try {
      await execAsync(p, ['--version']);
      return p;
    } catch {
      // Not found or not executable — try next.
    }
  }

  return null;
}
