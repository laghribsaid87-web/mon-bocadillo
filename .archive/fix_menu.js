import fs from 'fs';

let p = 'src/components/admin/AdminMenuEditor.jsx';
let c = fs.readFileSync(p, 'utf8');

const regex = /const updateStock = httpsCallable\(functions, 'updateGlovoProductStock'\);\s*updateStock\(\{ productId: item\.id, outOfStock: newVal \}\)\.catch\(err => console\.error\("Glovo API Error:", err\)\);/g;

const replacement = `const pushMenu = httpsCallable(functions, 'pushMenuToGlovo');
                                    pushMenu({ appId: 'mon-bocadillo', storeId: '370282' }).catch(err => console.error(err));
                                    pushMenu({ appId: 'mon-bocadillo', storeId: '249094' }).catch(err => console.error(err));`;

c = c.replace(regex, replacement);

fs.writeFileSync(p, c);
console.log('Fixed AdminMenuEditor');
