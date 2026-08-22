import re

with open('app/src/main/java/com/bocadillo/godroidautomator/AutomatorAccessibilityService.kt', 'r', encoding='utf-8') as f:
    data = f.read()

# Change delay(400) to delay(2000) for phone number extraction
data = re.sub(r'waitUntilTextAppears\(labelAnnuler, 4000\)\s*delay\(400\)', 
              'waitUntilTextAppears(labelAnnuler, 4000)\n                delay(2000)', data)

# Add 30 seconds delay when a new order is detected?
# Wait, let's just add it before the first click on the order card, or after?
# The user wants "Automator to wait 30s before starting work". 
# Let's add delay(30000) when a new order is detected!
# Where to put it?
# In findAndClickNewOrderCard? No, in the loop that waits for orders.

with open('app/src/main/java/com/bocadillo/godroidautomator/AutomatorAccessibilityService.kt', 'w', encoding='utf-8') as f:
    f.write(data)
