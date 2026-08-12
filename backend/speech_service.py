import os
import queue
import threading

from google.cloud import speech
from google.oauth2 import service_account

RATE = 16000


class SpeechService:

    def __init__(self):

        credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

        if not credentials_path:
            raise RuntimeError(
                "No se encontró GOOGLE_APPLICATION_CREDENTIALS"
            )

        credentials = service_account.Credentials.from_service_account_file(
            credentials_path
        )

        self.client = speech.SpeechClient(
            credentials=credentials
        )

        self.audio_queue = queue.Queue()
        self.text_queue = queue.Queue()

        self.config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=RATE,
            language_code="es-PE",
            enable_automatic_punctuation=True,
            max_alternatives=1
        )

        self.streaming_config = speech.StreamingRecognitionConfig(
            config=self.config,
            interim_results=True,
            single_utterance=False
        )

        self.running = True

    def add_audio(self, audio):
        self.audio_queue.put(audio)

    def audio_generator(self):

        while self.running:

            chunk = self.audio_queue.get()

            yield speech.StreamingRecognizeRequest(
                audio_content=chunk
            )

    def start(self):

        thread = threading.Thread(
            target=self.recognize,
            daemon=True
        )

        thread.start()

    def recognize(self):

        responses = self.client.streaming_recognize(
            self.streaming_config,
            self.audio_generator()
        )

        for response in responses:

            for result in response.results:

                texto = result.alternatives[0].transcript

                if texto:

                    self.text_queue.put({
                        "text": texto,
                        "final": result.is_final
                    })

    def get_text(self):

        try:
            return self.text_queue.get(timeout=0.1)

        except queue.Empty:
            return None