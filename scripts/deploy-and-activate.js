// Single safe entry point: the setup script validates DNS, deploy health and secrets
// before it registers a Telegram webhook. Never embed credentials in this file.
import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const npm = isWindows ? "npm.cmd" : "npm";

const child = spawn(npm, ["run", "setup"], {
  stdio: "inherit",
  shell: isWindows,
  windowsHide: true,
  env: process.env,
});

child.once("error", (error) => {
  console.error("Không chạy được quy trình thiết lập:", error.message);
  process.exitCode = 1;
});

child.once("close", (code) => {
  process.exitCode = code ?? 1;
});
