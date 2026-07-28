const fs = require('fs');
const path = require('path');

const archiveDir = path.join(__dirname, '.archive');
const functionsArchiveDir = path.join(__dirname, 'functions', '.archive');

if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir);
if (!fs.existsSync(functionsArchiveDir)) fs.mkdirSync(functionsArchiveDir);

const rootFiles = [
    'admin_backup.txt', 'analytics_block.txt', 'apply_fixes.cjs', 'apply_glovo_edits.js',
    'apply_pos_edits.js', 'build_output.txt', 'changes.patch', 'changes_fixed.patch',
    'check_order.js', 'debug_logs.txt', 'deploy_debug.log', 'driver_part1.txt',
    'driver_part2.txt', 'driver_part3.txt', 'drivers_block.txt', 'env_out.txt',
    'firebase_logs.txt', 'firebase_logs_large.txt', 'fix_admin_ca.js', 'fix_auth.cjs',
    'fix_ca.cjs', 'fix_glovo_source.cjs', 'fix_index_items_final.cjs', 'fix_index_items_regex.cjs',
    'fix_menu.js', 'fix_newline.cjs', 'fix_order_code.cjs', 'fix_sans.js', 'functions_logs.txt',
    'git_history.txt', 'glovo_block.txt', 'logs.txt', 'logs2.txt', 'logs3.txt', 'logs4.txt',
    'patch.ps1', 'pristine_client.txt', 'pristine_driver.txt', 'problem_block.txt',
    'search_docs.txt', 'standard_block.txt', 'tail_large.txt', 'test_glovo_api.js',
    'test_glovo_menu.js', 'update_glovo_menu.cjs'
];

rootFiles.forEach(f => {
    const src = path.join(__dirname, f);
    const dest = path.join(archiveDir, f);
    if (fs.existsSync(src)) fs.renameSync(src, dest);
});

const functionsFiles = [
    'check_logs.cjs', 'check_order.js', 'fix_glovo_items.cjs', 'fix_glovo_orders.cjs',
    'fix_index_items.js', 'glovo.js', 'patch.js', 'patch_menu_sync.js', 'patch_security.js',
    'recover_clients.cjs', 'test-gemini.js'
];

functionsFiles.forEach(f => {
    const src = path.join(__dirname, 'functions', f);
    const dest = path.join(functionsArchiveDir, f);
    if (fs.existsSync(src)) fs.renameSync(src, dest);
});

console.log("Cleanup completed.");
