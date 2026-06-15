const fetch = require('node-fetch');

async function testWebhookQuery() {
  const url = "https://us-central1-mon-bocadillo-menu.cloudfunctions.net/glovoWebhook?title=Nouvelle+commande+%23GLOVO-QUERY&text=Ceci+est+un+test";

  try {
    const res = await fetch(url, {
      method: "POST"
    });
    const data = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", data);
  } catch (err) {
    console.error("Error:", err);
  }
}

testWebhookQuery();
