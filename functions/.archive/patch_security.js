const fs = require('fs');

const SECURITY_BLOCK = `
        const GLOVO_API_TOKEN = "76a633d6-08e1-423f-813d-008b77df13b5";
        const authHeader = req.headers.authorization || req.headers.Authorization;
        if (!authHeader || !authHeader.includes(GLOVO_API_TOKEN)) {
            console.error("Unauthorized Glovo Webhook Attempt");
            return res.status(401).send('Unauthorized');
        }
`;

function patchFile(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');

    // 1. Menu Download
    content = content.replace(
        /exports\.glovoMenuDownload = functions\.https\.onRequest\(async \(req, res\) => \{\s*try \{/g,
        `exports.glovoMenuDownload = functions.https.onRequest(async (req, res) => {\n    try {${SECURITY_BLOCK}`
    );

    // 2. Order Dispatch
    content = content.replace(
        /exports\.glovoWebhookOrderDispatch = functions\.https\.onRequest\(async \(req, res\) => \{\s*try \{/g,
        `exports.glovoWebhookOrderDispatch = functions.https.onRequest(async (req, res) => {\n    try {${SECURITY_BLOCK}`
    );

    // 3. Order Cancel
    content = content.replace(
        /exports\.glovoWebhookOrderCancel = functions\.https\.onRequest\(async \(req, res\) => \{\s*try \{/g,
        `exports.glovoWebhookOrderCancel = functions.https.onRequest(async (req, res) => {\n    try {${SECURITY_BLOCK}`
    );

    // 4. Customer Pickup
    content = content.replace(
        /exports\.glovoWebhookCustomerPickup = functions\.https\.onRequest\(async \(req, res\) => \{\s*try \{/g,
        `exports.glovoWebhookCustomerPickup = functions.https.onRequest(async (req, res) => {\n    try {${SECURITY_BLOCK}`
    );

    // Also patch `glovoWebhook` if it exists
    content = content.replace(
        /exports\.glovoWebhook = functions\.https\.onRequest\(async \(req, res\) => \{\s*try \{/g,
        `exports.glovoWebhook = functions.https.onRequest(async (req, res) => {\n    try {${SECURITY_BLOCK}`
    );

    fs.writeFileSync(filepath, content);
    console.log("Patched successfully!");
}

patchFile('index.js');
