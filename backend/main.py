import asyncio

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from speech_service import SpeechService


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

    speech_service = SpeechService()

    speech_service.start()

    async def enviar_resultados():

        while True:

            resultado = speech_service.get_text()

            if resultado:

                await websocket.send_json(resultado)

            await asyncio.sleep(0.01)

    tarea_resultados = asyncio.create_task(enviar_resultados())

    try:

        while True:

            data = await websocket.receive_bytes()

            speech_service.add_audio(data)

    except Exception as e:

        print(f"Cliente desconectado: {e}")

    finally:

        tarea_resultados.cancel()