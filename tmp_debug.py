import re, pathlib
text = pathlib.Path("src/components/BookingModal.tsx").read_text(encoding="utf-8")
pattern = r"return \([\s\S]*?Escolha um Hor.*?Por favor, selecione outra data.[\s\S]*?\);"
m = re.search(pattern, text)
print('found', bool(m))
