import re, pathlib
path = pathlib.Path("src/components/BookingModal.tsx")
text = path.read_text(encoding="utf-8")
pattern = r"            return \(\s+<div ref={timeRef} className=\"pt-4\">.*?Por favor, selecione outra data\.</p>\s+              </div>\s+            \);"
new = """            return (
              <div ref={timeRef} className=\"pt-4\">
                <p className=\"text-sm font-medium mb-4\">Escolha um HorÃ¡rio DisponÃ­vel:</p>
                {isClosed ? (
                  <div className=\"text-center py-8 text-muted-foreground\">
                    <Clock className=\"h-8 w-8 mx-auto mb-2 opacity-50\" />
                    <p>Estamos fechados neste dia.</p>
                    <p className=\"text-sm mt-1\">Selecione outra data.</p>
                  </div>
                ) : availableSlots.length > 0 ? (
                  <div className=\"grid grid-cols-4 md:grid-cols-6 gap-2\">
                    {availableSlots.map((time) => (
                      <Button
                        key={time}
                        variant={selectedTime === time ? \"default\" : \"outline\"}
                        size=\"sm\"
                        onClick={() => setSelectedTime(time)}
                        className=\"text-lg md:text-sm px-3 py-5 md:py-3 h-auto font-medium rounded-xl md:rounded-md\"
                      >
                        {time}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className=\"text-center py-8 text-muted-foreground\">
                    <Clock className=\"h-8 w-8 mx-auto mb-2 opacity-50\" />
                    <p>Nenhum horÃ¡rio disponÃ­vel para este dia.</p>
                    <p className=\"text-sm mt-1\">Por favor, selecione outra data.</p>
                  </div>
                )}
              </div>
            );"""
new_text = re.sub(pattern, new, text, flags=re.S)
if new_text == text:
    raise SystemExit("replace failed")
path.write_text(new_text, encoding="utf-8")
