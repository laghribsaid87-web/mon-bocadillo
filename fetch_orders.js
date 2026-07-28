const projectId = 'mon-bocadillo-8fc9c';
const appId = 'mon-bocadillo-menu';

async function fetchOrders() {
    const url = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents/artifacts/' + appId + '/public/data/orders';
    const res = await fetch(url);
    const json = await res.json();
    
    if (json.documents) {
        json.documents.slice(0, 3).forEach(doc => {
            console.log('ID:', doc.name.split('/').pop());
            const fields = doc.fields;
            console.log('source:', fields.source?.stringValue);
            console.log('status:', fields.status?.stringValue);
            console.log('orderNumber:', fields.orderNumber?.stringValue);
            console.log('glovoStoreId:', fields.glovoStoreId?.stringValue);
            console.log('----------------');
        });
    } else {
        console.log("No documents found.", json);
    }
}
fetchOrders().catch(console.error);
