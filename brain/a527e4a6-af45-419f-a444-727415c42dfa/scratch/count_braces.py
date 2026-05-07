
with open(r'd:\in_project\hotelms\frontend\src\pages\admin\Steward.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

open_braces = 0
close_braces = 0
for char in content:
    if char == '{':
        open_braces += 1
    elif char == '}':
        close_braces += 1

print(f"Total Open: {open_braces}")
print(f"Total Close: {close_braces}")
print(f"Difference: {open_braces - close_braces}")
