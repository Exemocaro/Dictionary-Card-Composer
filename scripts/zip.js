// Builds dist/dictionary-card-composer-<version>.zip for the Chrome Web Store.
// Only the files the extension needs are included; tests, fixtures and scripts stay out.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..');
const INCLUDE = ['manifest.json', 'background.js', 'extract-page.js', 'sidepanel.html', 'sidepanel.js', 'sidepanel.css', 'popup.html', 'popup.js', 'popup.css', 'lib', 'parsers', 'icons'];
const DOS_DATE_1980_01_01 = 0x21;

function listFiles(rel) {
  const full = path.join(root, rel);
  if (!fs.statSync(full).isDirectory()) return [rel];
  return fs.readdirSync(full).sort().flatMap(name => listFiles(path.posix.join(rel, name)));
}

const localParts = [];
const centralParts = [];
let offset = 0;
const files = INCLUDE.flatMap(listFiles);

for (const name of files) {
  const data = fs.readFileSync(path.join(root, name));
  const packed = zlib.deflateRawSync(data, { level: 9 });
  const nameBytes = Buffer.from(name, 'utf8');
  const crc = zlib.crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt16LE(0, 10);
  local.writeUInt16LE(DOS_DATE_1980_01_01, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(packed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  localParts.push(local, nameBytes, packed);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(0, 12);
  central.writeUInt16LE(DOS_DATE_1980_01_01, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(packed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt32LE(offset, 42);
  centralParts.push(central, nameBytes);

  offset += local.length + nameBytes.length + packed.length;
}

const centralSize = centralParts.reduce((n, part) => n + part.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

const { version } = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const outFile = path.join(root, 'dist', `dictionary-card-composer-${version}.zip`);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, Buffer.concat([...localParts, ...centralParts, end]));
console.log(`Wrote ${path.relative(root, outFile)} (${files.length} files)`);
