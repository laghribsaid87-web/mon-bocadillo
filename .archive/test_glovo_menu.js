// Let's just fetch the JSON from our live endpoint and send it to Glovo's validator!
async function run() {
    console.log("Fetching menu from our endpoint...");
    const url = "https://us-central1-mon-bocadillo-menu.cloudfunctions.net/glovoMenuDownload?appId=mon-bocadillo-menu";
    const res = await fetch(url);
    const menuJson = await res.json();
    
    console.log("Validating with Glovo API...");
    const validateRes = await fetch("https://api.glovoapp.com/paris/menu/validate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "76a633d6-08e1-423f-813d-008b77df13b5"
        },
        body: JSON.stringify(menuJson)
    });
    
    const validateData = await validateRes.json();
    console.log("Validation result:", JSON.stringify(validateData, null, 2));
}

run().catch(console.error);
