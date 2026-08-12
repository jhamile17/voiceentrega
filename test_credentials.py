import os

ruta = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")

print("Ruta del JSON:")
print(ruta)

if ruta:
    print("✅ Credencial encontrada correctamente")
else:
    print("❌ No existe la variable de entorno")