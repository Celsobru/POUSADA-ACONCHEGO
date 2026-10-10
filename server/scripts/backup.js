// Backup diário: copia data.json para backups/ e mantém apenas os 7 mais recentes
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', 'data.json');
const dir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(dir)) fs.mkdirSync(dir);
const stamp = new Date().toISOString().slice(0, 10);
fs.copyFileSync(src, path.join(dir, `backup-${stamp}.json`));
const files = fs.readdirSync(dir).filter(f => f.startsWith('backup-')).sort();
while (files.length > 7) fs.unlinkSync(path.join(dir, files.shift()));
console.log('Backup feito. Mantidos:', fs.readdirSync(dir).join(', '));
