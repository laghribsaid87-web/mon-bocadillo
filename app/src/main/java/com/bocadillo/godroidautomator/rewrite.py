import re

with open('AutomatorAccessibilityService.kt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1
for i, line in enumerate(lines):
    if 'private suspend fun startAutomationSequence' in line:
        start_idx = i
        brace_count = 0
        in_func = False
        for j in range(i, len(lines)):
            if '{' in lines[j]:
                brace_count += lines[j].count('{')
                in_func = True
            if '}' in lines[j]:
                brace_count -= lines[j].count('}')
            if in_func and brace_count == 0:
                end_idx = j
                break
        break

if start_idx != -1 and end_idx != -1:
    new_func = '''    private suspend fun startAutomationSequence() {
        isSequenceRunning = true
        
        wakeUpScreenAndUnlock()
        delay(500)

        val labelNouvelle = getLabel("btn_nouvelle", "Nouvelle")
        val labelAccepter = getLabel("btn_accepter", "Accepter la commande")
        val labelCompris = getLabel("btn_compris", "Compris")

        try {
            Journal.log("=== DEBUT DE L'AUTOMATISATION (Acceptation Rapide) ===")

            var targetPackage = "com.deliveryhero.rps.restaurantandroidapp"
            val pm = packageManager
            val packages = pm.getInstalledApplications(android.content.pm.PackageManager.GET_META_DATA)
            for (app in packages) {
                val appName = pm.getApplicationLabel(app).toString()
                if (appName.equals("goDroid", ignoreCase = true) || appName.equals("Glovo Partner", ignoreCase = true)) {
                    targetPackage = app.packageName
                    break
                }
            }
            
            val currentPackage = rootInActiveWindow?.packageName?.toString()
            if (currentPackage != targetPackage) {
                val launchIntent = packageManager.getLaunchIntentForPackage(targetPackage)
                if (launchIntent != null) {
                    launchIntent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                    startActivity(launchIntent)
                    Journal.log("Ouverture de l'app: $targetPackage")
                    delay(2000)
                }
            }

            // 1.5 Open Menu (Drawer) and click "Aperçu des commandes"
            val drawerNode = findDrawerButton(rootInActiveWindow)
            if (drawerNode != null) {
                drawerNode.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK)
                delay(1000)
            }
            clickByText("Aperçu des commandes")
            delay(1000)

            // 2. Click on "Nouvelle" tab
            Journal.log("Clic sur l'onglet '$labelNouvelle'")
            clickByText(labelNouvelle)
            delay(1000)
            
            // 3. For now, let's just try to find and click "Accepter la commande"
            Journal.log("Attente de '$labelAccepter'...")
            var accepted = false
            for (i in 0..3) {
                if (clickByText(labelAccepter)) {
                    accepted = true
                    Journal.log("Clic sur '$labelAccepter' réussi!")
                    break
                }
                delay(1000)
            }

            if (waitUntilTextAppears(labelCompris, 1500)) {
                Journal.log("Alerte Espèces Glovo détectée, clic sur '$labelCompris'")
                clickByText(labelCompris)
            }
            
            Journal.log("=== AUTOMATISATION (Acceptation Rapide) TERMINEE ===")
        } catch (e: Exception) {
            Journal.log("ERREUR FATALE: ${e.message}")
            android.util.Log.e("AutoService", "Error in sequence", e)
        } finally {
            returnToNewOrdersTab()
            isSequenceRunning = false
        }
    }
'''
    lines = lines[:start_idx] + [new_func] + lines[end_idx+1:]
    with open('AutomatorAccessibilityService.kt', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print('Successfully rewrote startAutomationSequence')
