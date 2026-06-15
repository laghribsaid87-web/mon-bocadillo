const fetch = require('node-fetch');

async function testWebhook() {
  const url = "https://us-central1-mon-bocadillo-menu.cloudfunctions.net/glovoWebhook";
  
  const body = {
    "title": "Nouvelle commande #TEST-WEBHOOK",
    "text": "Ceci est un test depuis le serveur local vers le webhook"
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", data);
  } catch (err) {
    console.error("Error:", err);
  }
}

testWebhook();
