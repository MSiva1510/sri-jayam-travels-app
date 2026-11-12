with open('src/pages/Expenses.jsx', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

idx = content.find('lassName="flex gap-2">')
print(f'Found at: {idx}')
if idx >= 0:
    print(repr(content[idx:idx+200]))
    print()
    print('Byte codes around start:')
    for i, c in enumerate(content[idx:idx+10]):
        print(f'  {i}: ord={ord(c)}, char={repr(c)}')
