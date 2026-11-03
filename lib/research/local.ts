import { execFile } from "node:child_process";

/** Fixed program and working directory; no shell or caller-supplied file paths. */
export function queryLocalResearch(request: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // Local runtime dependency; never trace the workspace or research database into deployment output.
    const child = execFile(/* turbopackIgnore: true */ process.env.BLINDSPOT_PYTHON || "python", ["-m", "blindspot.app"], {
      cwd: process.cwd(), timeout: 15_000, maxBuffer: 8 * 1024 * 1024, encoding: "utf8", windowsHide: true, env: { ...process.env, PYTHONUTF8: "1" },
    }, (error, stdout) => {
      if (error) { reject(new Error("Research worker storage is unavailable")); return; }
      try { resolve(JSON.parse(stdout)); }
      catch { reject(new Error("Research worker returned an invalid response")); }
    });
    child.stdin?.on("error", () => { /* Process callback reports unavailable worker. */ });
    child.stdin?.end(JSON.stringify(request));
  });
}
