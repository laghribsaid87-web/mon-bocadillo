const fetch = require('node-fetch');

async function testREST() {
  const url = "https://firestore.googleapis.com/v1/projects/mon-bocadillo-menu/databases/(default)/documents/artifacts/mon-bocadillo-menu/public/data/orders";
  
  const body = {
    "fields": {
      "source": { "stringValue": "glovo" },
      "status": { "stringValue": "preparing" },
      "orderNumber": { "stringValue": "GLOVO-TEST-REST" },
      "items": {
        "arrayValue": {
          "values": [
            {
              "mapValue": {
                "fields": {
                  "name": { "stringValue": "COMMANDE GLOVO" },
                  "qty": { "integerValue": "1" },
                  "price": { "integerValue": "0" }
                }
              }
            }
          ]
        }
      },
      "nearestBranch": {
        "mapValue": {
          "fields": {
            "id": { "stringValue": "laymoune" }
          }
        }
      },
      "orderNote": { "stringValue": "Nouvelle commande Glovo (Voir tablette GoDroid)" }
    }
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

testREST();
