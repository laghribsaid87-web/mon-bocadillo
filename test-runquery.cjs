const fetch = require('node-fetch');

async function testRunQuery() {
  const url = "https://firestore.googleapis.com/v1/projects/mon-bocadillo-menu/databases/(default)/documents/artifacts/mon-bocadillo-menu/public/data:runQuery";
  
  const body = {
    "structuredQuery": {
      "from": [{"collectionId": "orders"}],
      "where": {
        "compositeFilter": {
          "op": "AND",
          "filters": [
            {
              "fieldFilter": {
                "field": {"fieldPath": "status"},
                "op": "EQUAL",
                "value": {"stringValue": "ready"}
              }
            },
            {
              "fieldFilter": {
                "field": {"fieldPath": "source"},
                "op": "EQUAL",
                "value": {"stringValue": "glovo"}
              }
            }
          ]
        }
      }
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

testRunQuery();
