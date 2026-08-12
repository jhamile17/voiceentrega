import os
import json
import queue
import threading

from google.cloud import speech
from google.oauth2 import service_account


RATE = 16000


class SpeechService:

    def __init__(self):

        credentials = None

        # ============================================
        # RENDER
        # ============================================

        credentials_json = os.getenv(
            "GOOGLE_APPLICATION_CREDENTIALS_JSON"
        )

        if credentials_json:

            print(
                "Usando credenciales Google desde "
                "GOOGLE_APPLICATION_CREDENTIALS_JSON"
            )

            try:

                credentials_info = json.loads(
                    credentials_json
                )

                credentials = (
                    service_account.Credentials
                    .from_service_account_info(
                        credentials_info
                    )
                )

            except json.JSONDecodeError as e:

                raise RuntimeError(
                    "GOOGLE_APPLICATION_CREDENTIALS_JSON "
                    "no contiene un JSON válido"
                ) from e

            except Exception as e:

                raise RuntimeError(
                    f"Error cargando credenciales Google: {e}"
                ) from e

        # ============================================
        # LOCAL
        # ============================================

        else:

            credentials_path = os.getenv(
                "GOOGLE_APPLICATION_CREDENTIALS"
            )

            if not credentials_path:

                raise RuntimeError(
                    "No se encontró ninguna credencial de Google. "
                    "Configure GOOGLE_APPLICATION_CREDENTIALS "
                    "o GOOGLE_APPLICATION_CREDENTIALS_JSON."
                )

            if not os.path.exists(credentials_path):

                raise RuntimeError(
                    "No existe el archivo de credenciales: "
                    f"{credentials_path}"
                )

            print(
                "Usando credenciales Google desde archivo: "
                f"{credentials_path}"
            )

            credentials = (
                service_account.Credentials
                .from_service_account_file(
                    credentials_path
                )
            )

        # ============================================
        # GOOGLE SPEECH
        # ============================================

        self.client = speech.SpeechClient(
            credentials=credentials
        )

        # ============================================
        # COLAS
        # ============================================

        self.audio_queue = queue.Queue()

        self.text_queue = queue.Queue()

        # ============================================
        # CONFIGURACIÓN
        # ============================================

        self.config = speech.RecognitionConfig(

            encoding=(
                speech.RecognitionConfig
                .AudioEncoding.LINEAR16
            ),

            sample_rate_hertz=RATE,

            language_code="es-PE",

            enable_automatic_punctuation=True,

            max_alternatives=1
        )

        self.streaming_config = (
            speech.StreamingRecognitionConfig(

                config=self.config,

                interim_results=True,

                single_utterance=False
            )
        )

        self.running = True

    # ============================================
    # AUDIO
    # ============================================

    def add_audio(self, audio):

        if self.running:

            self.audio_queue.put(audio)

    # ============================================
    # GENERADOR
    # ============================================

    def audio_generator(self):

        while self.running:

            chunk = self.audio_queue.get()

            if chunk is None:
                break

            yield speech.StreamingRecognizeRequest(
                audio_content=chunk
            )

    # ============================================
    # INICIAR
    # ============================================

    def start(self):

        thread = threading.Thread(
            target=self.recognize,
            daemon=True
        )

        thread.start()

    # ============================================
    # RECONOCIMIENTO
    # ============================================

    def recognize(self):

        try:

            print(
                "Iniciando Google Speech-to-Text..."
            )

            responses = (
                self.client.streaming_recognize(

                    self.streaming_config,

                    self.audio_generator()
                )
            )

            print(
                "Google Speech-to-Text conectado"
            )

            for response in responses:

                for result in response.results:

                    if not result.alternatives:
                        continue

                    texto = (
                        result
                        .alternatives[0]
                        .transcript
                    )

                    if texto:

                        print(
                            f"Reconocido: {texto}"
                        )

                        self.text_queue.put({

                            "text": texto,

                            "final": result.is_final

                        })

        except Exception as e:

            print(
                f"Error en Google Speech-to-Text: {e}"
            )

    # ============================================
    # OBTENER TEXTO
    # ============================================

    def get_text(self):

        try:

            return self.text_queue.get(
                timeout=0.1
            )

        except queue.Empty:

            return None

    # ============================================
    # DETENER
    # ============================================

    def stop(self):

        self.running = False

        self.audio_queue.put(None)