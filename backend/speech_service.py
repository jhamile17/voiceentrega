import os
import queue
import threading

from google.cloud import speech
from google.oauth2 import service_account


RATE = 16000


class SpeechService:

    def __init__(self):

        # ============================================
        # CREDENCIALES GOOGLE
        # ============================================

        credentials_path = os.getenv(
            "GOOGLE_APPLICATION_CREDENTIALS"
        )

        if not credentials_path:
            raise RuntimeError(
                "No se encontró GOOGLE_APPLICATION_CREDENTIALS"
            )

        if not os.path.exists(credentials_path):
            raise RuntimeError(
                f"No existe el archivo de credenciales: {credentials_path}"
            )

        print(
            f"Usando credenciales Google: {credentials_path}"
        )

        credentials = (
            service_account.Credentials
            .from_service_account_file(
                credentials_path
            )
        )

        self.client = speech.SpeechClient(
            credentials=credentials
        )

        # ============================================
        # COLAS
        # ============================================

        self.audio_queue = queue.Queue()

        self.text_queue = queue.Queue()

        # ============================================
        # CONFIGURACIÓN GOOGLE SPEECH
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
    # RECIBIR AUDIO
    # ============================================

    def add_audio(self, audio):

        if self.running:

            self.audio_queue.put(audio)

    # ============================================
    # GENERADOR DE AUDIO
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
    # INICIAR GOOGLE SPEECH
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
    # OBTENER RESULTADO
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