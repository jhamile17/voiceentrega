const texto = document.getElementById("texto");
const boton = document.getElementById("btnIniciar");

let socket;
let audioContext;
let processor;

async function iniciar() {

    boton.disabled = true;

    texto.innerHTML = "Conectando...";

    socket = new WebSocket("ws://localhost:8000/ws/audio");

    socket.binaryType = "arraybuffer";

    socket.onopen = async () => {

        texto.innerHTML = "Micrófono conectado";

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        audioContext = new AudioContext({
            sampleRate: 16000
        });

        await audioContext.audioWorklet.addModule("audioProcessor.js");

        const source =
            audioContext.createMediaStreamSource(stream);

        processor =
            new AudioWorkletNode(
                audioContext,
                "audio-processor"
            );

        processor.port.onmessage = (event) => {

            if (socket.readyState === WebSocket.OPEN) {

                socket.send(event.data);

            }

        };

        source.connect(processor);
        processor.connect(audioContext.destination);

    };

    socket.onmessage = (event) => {

        texto.innerHTML = event.data;

    };

    socket.onclose = () => {

        texto.innerHTML = "Conexión cerrada";

        boton.disabled = false;

    };

    socket.onerror = () => {

        texto.innerHTML = "Error de conexión";

        boton.disabled = false;

    };

}