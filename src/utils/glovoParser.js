export const parseGlovoOrder = (orderData) => {
  if (orderData.source !== 'glovo') {
    return orderData;
  }

  let newData = { ...orderData };

  // Also fix any already existing ones (retro-compatibility from App.jsx)
  if (!newData.nearestBranch) {
      newData.nearestBranch = { id: "laymoune", name: "Laymoune" };
  }

  // If there's no raw text or it's already parsed, return the data
  if (!newData.raw_text || newData.parsedGlovo) {
    return newData;
  }
  
  try {
    let rawJson = typeof newData.raw_text === 'string' ? JSON.parse(newData.raw_text) : newData.raw_text;
    let phoneJson = newData.phone_text ? (typeof newData.phone_text === 'string' ? JSON.parse(newData.phone_text) : newData.phone_text) : null;
    
    let content = rawJson.tout || rawJson;
    let phoneContent = phoneJson ? (phoneJson.tout || phoneJson) : {};
    
    let items = [];
    let name = "Client Glovo";
    let phone = "";
    let orderNumber = "";
    let total = "";
    
    // Extract phone
    for (let key in phoneContent) {
      let val = phoneContent[key];
      if (typeof val === 'string' && (val.includes('+212') || val.match(/^0[67]\d{8}$/))) {
        phone = val.trim();
      }
    }
    if(!phone && phoneContent["com.deliveryhero.rps.restaurantandroidapp:id/phone_number"]) {
       phone = phoneContent["com.deliveryhero.rps.restaurantandroidapp:id/phone_number"];
    }

    // Extract order details
    let itemsMap = {};
    for (let key in content) {
      let val = content[key];
      if (typeof val !== 'string') continue;
      
      if (key.includes('customer_name')) name = val;
      if (key.includes('order_number')) orderNumber = val;
      if (key.includes('total_price')) total = val.replace('DH', '').trim();
      
      let m = key.match(/item_name\$(\d+)/);
      if (m) {
        let idx = m[1];
        if (!itemsMap[idx]) itemsMap[idx] = {};
        itemsMap[idx].name = val;
      }
      m = key.match(/multiplier_label\$(\d+)/);
      if (m) {
        let idx = m[1];
        if (!itemsMap[idx]) itemsMap[idx] = {};
        itemsMap[idx].qty = parseInt(val.replace('x', '').trim()) || 1;
      }
      m = key.match(/item_price\$(\d+)/);
      if (m) {
        let idx = m[1];
        if (!itemsMap[idx]) itemsMap[idx] = {};
        itemsMap[idx].price = parseFloat(val.replace(',', '.').replace('DH', '').trim()) || 0;
      }
    }
    
    Object.values(itemsMap).forEach(item => {
       if(item.name) {
          items.push({
             name: item.name,
             qty: item.qty || 1,
             price: item.price || 0
          });
       }
    });
    
    newData.customerName = name;
    newData.phone = phone || "Inconnu";
    newData.orderNumber = orderNumber;
    newData.total = total || "0";
    newData.items = items;
    newData.parsedGlovo = true; // Flag to prevent re-parsing
    
  } catch(e) {
    console.error("Erreur parsing Glovo JSON:", e);
  }
  
  return newData;
};
