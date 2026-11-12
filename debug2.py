with open('src/pages/Expenses.jsx', 'rb') as f:
    content_bytes = f.read()

idx = content_bytes.find(b'flex gap-2')
print(f'Found "flex gap-2" at index {idx}')
if idx >= 0:
    print(repr(content_bytes[idx-200:idx+200]))
