import re
import os

with open('src/views/pos/PosModals.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# We will just manually create the files to ensure correctness, since regex parsing React brackets is famously hard.
