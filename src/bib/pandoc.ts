import { execFile } from 'child_process';
import { promisify } from 'util';
import { Platform } from 'obsidian';
import { PartialCSLEntry } from './types';

const execFileAsync = promisify(execFile);

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
 * Attempt to find the pandoc binary on the system PATH.
 * Desktop only — returns null on mobile or if not found.
 */
export async function findPandoc(): Promise<string | null> {
  if (!Platform.isDesktop) return null;
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    const { stdout } = await execFileAsync(cmd, ['pandoc']);
    return stdout.trim().split('\n')[0] ?? null;
  } catch {
    return null;
  }
}
