const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(fullPath));
        } else {
            if (fullPath.endsWith('.js')) {
                results.push(fullPath);
            }
        }
    });
    return results;
}

const testFiles = walk(path.join(__dirname)).filter(f => !f.includes('setup.js') && !f.includes('fix.js'));

let fixedCount = 0;
testFiles.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    // Replace any require that points into the backend/src directory from deeper folders
    // It's originally `../../../src` but should be `../../src`
    if (content.includes('../../../src/')) {
        let newContent = content.replace(/\.\.\/\.\.\/\.\.\/src\//g, '../../src/');
        fs.writeFileSync(f, newContent);
        fixedCount++;
        console.log('Fixed', f);
    }
});

console.log('Successfully fixed imports in', fixedCount, 'files.');
