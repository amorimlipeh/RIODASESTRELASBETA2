const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const DATA_DIR = path.join(ROOT, "data");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizeRelative(input) {
  return String(input || "")
    .replace(/^[/\\]+/, "")
    .replace(/\.\.+/g, "")
    .trim();
}

function resolveDataPath(relativePath) {
  const clean = sanitizeRelative(relativePath).replace(/^data[/\\]/i, "");
  const abs = path.join(DATA_DIR, clean);
  ensureDir(path.dirname(abs));
  return abs;
}

function read(relativePath, fallback = []) {
  const file = resolveDataPath(relativePath);

  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2), "utf8");
    return fallback;
  }

  try {
    const raw = fs.readFileSync(file, "utf8").trim();
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.error("Erro ao ler JSON:", file, error.message);
    return fallback;
  }
}

function write(relativePath, data) {
  const file = resolveDataPath(relativePath);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  return true;
}

function up(value) {
  return String(value || "").trim().toUpperCase();
}

module.exports = {
  ensureDir,
  resolveDataPath,
  read,
  write,
  up
};
