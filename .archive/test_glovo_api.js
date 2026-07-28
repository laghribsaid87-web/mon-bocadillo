const GLOVO_API_TOKEN = "76a633d6-08e1-423f-813d-008b77df13b5";
const storeIds = ["370282", "249094"];
const fetch = require('node-fetch');

async function testStock() {
    for (const storeId of storeIds) {
        const response = await fetch(`https://api.glovoapp.com/webhook/stores/${storeId}/products`, {
            method: 'PATCH',
            headers: { 
                'Authorization': `Basic ${Buffer.from(GLOVO_API_TOKEN).toString('base64')}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                products: [
                    {
                        id: "product_test_123", // Just testing the structure
                        available: false
                    }
                ]
            })
        });

        const text = await response.text();
        console.log(`Store ${storeId}: HTTP ${response.status} - ${text}`);
    }
}

testStock();
