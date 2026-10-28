// Backwards-compatible entry point for older scripts; webhook setup is now Render-based.
import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const node = process.execPath;
const child = spawn(node, ["scripts/setup.js"], {
  stdio: "inherit",
  windowsHide: true,
  env: process.env,
});

child.once("error", (error) => {
  console.error("Không chạy được quy trình setup Render:", error.message);
  process.exitCode = 1;
});

child.once("close", (code) => {
  process.exitCode = code ?? 1;
});
