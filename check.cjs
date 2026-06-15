const fs = require('fs');
const content = fs.readFileSync('src/views/PosDashboard.jsx', 'utf8');

let count = 0;
for(let i=0; i<content.length; i++) {
    if(content[i] === '{') count++;
    else if(content[i] === '}') count--;
}
console.log('Braces count: ' + count);

count = 0;
for(let i=0; i<content.length; i++) {
    if(content[i] === '(') count++;
    else if(content[i] === ')') count--;
}
console.log('Parentheses count: ' + count);

count = 0;
for(let i=0; i<content.length; i++) {
    if(content.substr(i, 2) === '<d') count++;
    else if(content.substr(i, 4) === '</di') count--;
}
console.log('Div tags count: ' + count);
