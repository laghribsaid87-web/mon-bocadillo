const fs = require('fs');
let c = fs.readFileSync('index.js', 'utf8');

const target = `
        const payload = Object.keys(req.body).length > 0 ? req.body : req.query;
        console.log("Glovo Customer Pickup Received:", JSON.stringify(payload));
        const appId = "mon-bocadillo-menu";
        
        if (payload && payload.order_id) {
            await db.collection("artifacts").doc(appId)
                .collection("public").doc("data")

        const payload = Object.keys(req.body).length > 0 ? req.body : req.query;`;

const replacement = `
        const payload = Object.keys(req.body).length > 0 ? req.body : req.query;`;

c = c.replace(target, replacement);
fs.writeFileSync('index.js', c);
console.log("Fixed syntax error");
