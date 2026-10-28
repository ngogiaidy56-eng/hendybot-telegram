import fs from "node:fs";
import path from "node:path";

const logPath = path.resolve(process.env.LOG_FILE || "logs/bot.log");
fs.mkdirSync(path.dirname(logPath), { recursive: true });

function write(level, message, error) {
  const suffix = error ? " | " + String(error.stack || error.message || error) : "";
  const line = new Date().toISOString() + " [" + level + "] " + String(message) + suffix;
  if (level === "ERROR") console.error(line);
  else if (level === "WARN") console.warn(line);
  else console.info(line);
  try {
    fs.appendFileSync(logPath, line + "\n", "utf8");
  } catch (writeError) {
    console.error("Could not append bot log: " + writeError.message);
  }
}

export const logger = {
  info(message) { write("INFO", message); },
  warn(message) { write("WARN", message); },
  error(message, error) { write("ERROR", message, error); }
};
