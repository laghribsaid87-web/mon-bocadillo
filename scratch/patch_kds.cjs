const fs = require('fs');
const path = 'src/components/admin/KitchenDashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

const targetStr = `                                                    {(item.name || '').includes(' (Sans ') && (item.name || '').split(' (Sans ').length > 1 && (`;

const insertStr = `                                                    {/* NEW BLOCK FOR GLOVO WEBHOOK OFFICIAL (CAS 2) */}
                                                    {(item.selectedSans?.length > 0 || item.selectedExtras?.length > 0 || item.note) && (
                                                        <div className="flex flex-col items-end w-full gap-1.5 mt-2" dir="auto">
                                                            {item.selectedSans?.map((opt, oIdx) => (
                                                                <div key={'s'+oIdx} className="inline-flex px-3 py-1 rounded-lg font-black uppercase tracking-wider border items-center gap-2 bg-red-500/20 text-red-400 border-red-500/20" style={{ fontSize: kdsFontSizes.sans + 'px' }} dir="ltr">
                                                                    <span dir="auto" className="text-right">SANS {opt}</span>
                                                                </div>
                                                            ))}
                                                            {item.selectedExtras?.map((opt, oIdx) => (
                                                                <div key={'e'+oIdx} className="inline-flex px-3 py-1 rounded-lg font-black uppercase tracking-wider border items-center gap-2 bg-green-500/20 text-green-400 border-green-500/20" style={{ fontSize: kdsFontSizes.extra + 'px' }} dir="ltr">
                                                                    <span dir="auto" className="text-right">+ {opt.name || opt}</span>
                                                                </div>
                                                            ))}
                                                            {item.note && (
                                                                <div className="inline-flex px-3 py-1 rounded-lg font-black tracking-wider border items-center gap-2 bg-yellow-500/20 text-yellow-400 border-yellow-500/20" style={{ fontSize: kdsFontSizes.sans + 'px' }} dir="auto">
                                                                    <span>📝 {item.note}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {/* END NEW BLOCK */}`;

content = content.replace(targetStr, insertStr + '\n' + targetStr);
fs.writeFileSync(path, content, 'utf8');
console.log('KitchenDashboard patched');
