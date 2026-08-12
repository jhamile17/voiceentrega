from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="VozCloud API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def home():
    return {
        "status": "ok",
        "message": "VozCloud API funcionando"
    }


@app.websocket("/ws/audio")
async def websocket_audio(websocket: WebSocket):

    await websocket.accept()

    print("Cliente conectado")

    try:

        while True:

            data = await websocket.receive_bytes()

            print(f"Audio recibido: {len(data)} bytes")

    except Exception:

        print("Cliente desconectado")