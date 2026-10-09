const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const destination = path.join(root, 'dist');
fs.mkdirSync(destination, { recursive: true });
for (const file of ['index.html', 'styles.css', 'quiz-core.js', 'app.js', 'sw.js', 'manifest.webmanifest', '.nojekyll']) fs.copyFileSync(path.join(root, file), path.join(destination, file));
for (const directory of ['assets', 'data']) fs.cpSync(path.join(root, directory), path.join(destination, directory), { recursive: true });
console.log('Static website built in dist/');
