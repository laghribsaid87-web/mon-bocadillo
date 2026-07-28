const fs = require('fs');

let code = fs.readFileSync('functions/index.js', 'utf8');

// Replace in syncGlovoOrderStatus and glovoDispatch
const oldAuth = `'Authorization': \`Basic \${Buffer.from(GLOVO_API_TOKEN).toString('base64')}\`,`;
const newAuth = `'Authorization': GLOVO_API_TOKEN,`;

if (code.includes(oldAuth)) {
    code = code.split(oldAuth).join(newAuth);
    fs.writeFileSync('functions/index.js', code);
    console.log("Replaced Glovo Authorization header successfully!");
} else {
    console.log("Could not find the old Auth header!");
}
