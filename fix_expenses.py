with open('src/pages/Expenses.jsx', 'rb') as f:
    content_bytes = f.read()

# Find: </Button>\n            <Button variant="amber"
old = b'</Button>\n            <Button variant="amber"'
new = b'</Button>\n            <button onClick={() => {\n              setForm({ ...EMPTY, addedBy: currentUser?.name || "", driver: currentUser?.name || "" });\n              setErrors({});\n              setReceiptFile(null);\n              if (fileInputRef.current) fileInputRef.current.value = "";\n            }} className="flex-1 px-3 py-2 rounded-lg border border-[var(--ap-border)] text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-[var(--ap-surface-2)] transition-colors">\n              Reset Form\n            </button>\n            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>\n            <Button variant="amber"'

count = content_bytes.count(old)
print(f'Found {count} occurrences')
if count > 0:
    content_bytes = content_bytes.replace(old, new, 1)
    with open('src/pages/Expenses.jsx', 'wb') as f:
        f.write(content_bytes)
    print('Replacement successful!')
else:
    print('Old string not found')
    idx = content_bytes.find(b'Cancel</Button>')
    if idx >= 0:
        print(f'Found Cancel</Button> at index {idx}')
        print(repr(content_bytes[idx-20:idx+100]))
