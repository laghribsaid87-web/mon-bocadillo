import re

with open('app/src/main/java/com/bocadillo/godroidautomator/AutomatorAccessibilityService.kt', 'r', encoding='utf-8') as f:
    data = f.read()

# Add 30 seconds delay in startNewOrderExtractionSequence
data = re.sub(r'(Journal\.log\("=== DEBUT SÉQUENCE EXTRACTION NUM/PIN ==="\)\s*Journal\.log\("Commande détectée: \"\))', 
              r'\1\n                Journal.log("Attente de 30 secondes avant de commencer...")\n                delay(30000)', data)

with open('app/src/main/java/com/bocadillo/godroidautomator/AutomatorAccessibilityService.kt', 'w', encoding='utf-8') as f:
    f.write(data)
