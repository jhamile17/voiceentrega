const texto = document.getElementById("texto");
const boton = document.getElementById("btnIniciar");

const estado = document.getElementById("estado");
const estadoPunto = document.getElementById("estadoPunto");

const tituloEstado = document.getElementById("tituloEstado");
const subtituloEstado = document.getElementById("subtituloEstado");

const estadoAudio = document.getElementById("estadoAudio");

const timerElement = document.getElementById("timer");
const microfono = document.getElementById("microfono");


// ============================================
// VARIABLES
// ============================================

let socket = null;

let audioContext = null;
let processor = null;
let source = null;
let silentGain = null;
let stream = null;

let finalText = "";

let timerInterval = null;
let startTime = null;

let conectado = false;
let iniciando = false;


// ============================================
// CONFIGURACIÓN
// ============================================

const TARGET_SAMPLE_RATE = 16000;


// ============================================
// URL WEBSOCKET
// ============================================

function obtenerWebSocketUrl() {

    const hostname = window.location.hostname;

    console.log("Hostname actual:", hostname);


    // ========================================
    // LOCALHOST
    // ========================================

    if (
        hostname === "localhost" ||
        hostname === "127.0.0.1"
    ) {

        const url =
            "ws://localhost:8000/ws/audio";

        console.log("WebSocket LOCAL:", url);

        return url;
    }


    // ========================================
    // RED LOCAL
    // ========================================

    if (hostname.startsWith("192.168.")) {

        const url =
            `ws://${hostname}:8000/ws/audio`;

        console.log("WebSocket RED LOCAL:", url);

        return url;
    }


    // ========================================
    // PRODUCCIÓN
    // ========================================

    const url =
        "wss://voiceentrega.onrender.com/ws/audio";

    console.log("WebSocket PRODUCCIÓN:", url);

    return url;
}


// ============================================
// INICIAR / DETENER
// ============================================

function toggleTranscripcion() {

    if (iniciando) {
        return;
    }

    if (conectado) {

        detener();

    } else {

        iniciar();
    }
}


// ============================================
// INICIAR TRANSCRIPCIÓN
// ============================================

async function iniciar() {

    if (iniciando || conectado) {
        return;
    }

    iniciando = true;

    try {

        console.log("=================================");
        console.log("INICIANDO TRANSCRIPCIÓN");
        console.log("=================================");


        // ========================================
        // VALIDAR MICRÓFONO
        // ========================================

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            throw new Error(
                "El navegador no permite acceder al micrófono."
            );
        }


        // ========================================
        // VALIDAR CONTEXTO SEGURO
        // ========================================

        console.log(
            "Contexto seguro:",
            window.isSecureContext
        );


        if (!window.isSecureContext) {

            throw new Error(
                "El micrófono requiere HTTPS en el celular. " +
                "En PC localhost sí funciona, pero 192.168.x.x necesita HTTPS."
            );
        }


        // ========================================
        // ESTADO UI
        // ========================================

        boton.disabled = true;

        tituloEstado.textContent =
            "Preparando...";

        subtituloEstado.textContent =
            "Solicitando acceso al micrófono";

        estado.textContent =
            "Conectando";

        estadoPunto.style.background =
            "#f59e0b";


        // ========================================
        // LIMPIAR TEXTO
        // ========================================

        finalText = "";

        texto.innerHTML = `
            <div class="empty-state">
                <span>🎤</span>
                <p>Preparando micrófono...</p>
            </div>
        `;


        // ========================================
        // SOLICITAR MICRÓFONO
        // ========================================

        console.log(
            "Solicitando permiso del micrófono..."
        );

        stream =
            await navigator.mediaDevices.getUserMedia({

                audio: {

                    channelCount: { ideal: 1 },

                    echoCancellation: { ideal: true },

                    noiseSuppression: { ideal: true },

                    autoGainControl: { ideal: true }

                }

            });


        console.log(
            "Micrófono obtenido correctamente"
        );


        // ========================================
        // CREAR AUDIO CONTEXT
        // ========================================

        audioContext =
            new (
                window.AudioContext ||
                window.webkitAudioContext
            )();


        console.log(
            "AudioContext creado"
        );

        console.log(
            "Sample rate:",
            audioContext.sampleRate
        );


        // ========================================
        // REANUDAR AUDIO
        // ========================================

        if (
            audioContext.state ===
            "suspended"
        ) {

            await audioContext.resume();
        }


        console.log(
            "AudioContext estado:",
            audioContext.state
        );


        // ========================================
        // CARGAR AUDIO WORKLET
        // ========================================

        await audioContext.audioWorklet.addModule(
            "audioProcessor.js?v=20260813-2"
        );


        console.log(
            "AudioProcessor cargado"
        );


        // ========================================
        // CONECTAR WEBSOCKET
        // ========================================

        const websocketUrl =
            obtenerWebSocketUrl();


        console.log(
            "Conectando WebSocket:",
            websocketUrl
        );


        socket =
            new WebSocket(
                websocketUrl
            );


        socket.binaryType =
            "arraybuffer";


        // ========================================
        // WEBSOCKET ABIERTO
        // ========================================

        socket.onopen = () => {

            console.log(
                "WebSocket conectado correctamente"
            );


            conectado = true;
            iniciando = false;


            estado.textContent =
                "Conectado";

            estadoPunto.style.background =
                "#22c55e";


            tituloEstado.textContent =
                "Micrófono activo";

            subtituloEstado.textContent =
                "Habla normalmente";


            estadoAudio.textContent =
                "● Escuchando";


            boton.textContent =
                "⏹ Detener transcripción";


            boton.classList.add(
                "stop"
            );


            boton.disabled =
                false;


            // ====================================
            // SOURCE
            // ====================================

            source =
                audioContext.createMediaStreamSource(
                    stream
                );

            // Mantiene activo el nodo de captura sin reproducir el micrófono.
            silentGain =
                audioContext.createGain();

            silentGain.gain.value = 0;


            // ====================================
            // PROCESSOR
            // ====================================

            processor =
                new AudioWorkletNode(
                    audioContext,
                    "audio-processor",
                    {

                        processorOptions: {

                            inputSampleRate:
                                audioContext.sampleRate,

                            outputSampleRate:
                                TARGET_SAMPLE_RATE,

                            packetSamples:
                                1600

                        }

                    }
                );


            // ====================================
            // RECIBIR AUDIO
            // ====================================

            processor.port.onmessage =
                (event) => {

                    if (
                        socket &&
                        socket.readyState ===
                        WebSocket.OPEN
                    ) {

                        socket.send(
                            event.data
                        );
                    }
                };


            // ====================================
            // SOURCE → PROCESSOR
            // ====================================

            source.connect(
                processor
            );

            processor.connect(
                silentGain
            );

            silentGain.connect(
                audioContext.destination
            );


            // ====================================
            // TIMER
            // ====================================

            startTimer();


            texto.innerHTML = `
                <div class="empty-state">
                    <span>🎤</span>
                    <p>Escuchando...</p>
                </div>
            `;


            console.log(
                "================================="
            );

            console.log(
                "TRANSCRIPCIÓN INICIADA"
            );

            console.log(
                "Sample rate entrada:",
                audioContext.sampleRate
            );

            console.log(
                "Sample rate destino:",
                TARGET_SAMPLE_RATE
            );

            console.log(
                "================================="
            );
        };


        // ========================================
        // MENSAJES DEL BACKEND
        // ========================================

        socket.onmessage =
            (event) => {

                try {

                    console.log(
                        "Mensaje recibido:",
                        event.data
                    );


                    const resultado =
                        JSON.parse(
                            event.data
                        );


                    const textoReconocido =
                        resultado.text;

                    const esFinal =
                        resultado.final;


                    if (
                        !textoReconocido ||
                        textoReconocido.trim() === ""
                    ) {

                        return;
                    }


                    if (
                        textoReconocido
                            .trim()
                            .toLowerCase() ===
                        "stop"
                    ) {

                        return;
                    }


                    if (esFinal) {

                        finalText +=
                            textoReconocido.trim() +
                            " ";

                        actualizarTextoFinal();

                    } else {

                        actualizarTextoInterim(
                            textoReconocido
                        );
                    }

                }
                catch (error) {

                    console.error(
                        "Error procesando mensaje:",
                        error
                    );
                }
            };


        // ========================================
        // WEBSOCKET CERRADO
        // ========================================

        socket.onclose =
            (event) => {

                console.log(
                    "================================="
                );

                console.log(
                    "WEBSOCKET CERRADO"
                );

                console.log(
                    "Código:",
                    event.code
                );

                console.log(
                    "Razón:",
                    event.reason
                );

                console.log(
                    "================================="
                );


                if (conectado) {

                    conectado = false;

                    limpiarRecursos(
                        false
                    );
                }
            };


        // ========================================
        // ERROR WEBSOCKET
        // ========================================

        socket.onerror =
            (error) => {

                console.error(
                    "WebSocket error:",
                    error
                );


                mostrarError(
                    "Error de conexión con el servidor"
                );


                conectado = false;
                iniciando = false;
            };

    }
    catch (error) {

        console.error(
            "================================="
        );

        console.error(
            "ERROR INICIANDO:"
        );

        console.error(
            error
        );

        console.error(
            "================================="
        );


        iniciando = false;
        conectado = false;


        mostrarError(
            error.message ||
            "No se pudo iniciar la transcripción"
        );


        limpiarRecursos(
            true
        );
    }
}


// ============================================
// MOSTRAR TEXTO FINAL
// ============================================

function actualizarTextoFinal() {

    texto.innerHTML = "";

    const finalElement =
        document.createElement(
            "div"
        );

    finalElement.className =
        "final-text";

    finalElement.textContent =
        finalText;

    texto.appendChild(
        finalElement
    );

    texto.scrollTop =
        texto.scrollHeight;
}


// ============================================
// MOSTRAR TEXTO INTERMEDIO
// ============================================

function actualizarTextoInterim(
    textoInterim
) {

    texto.innerHTML = "";


    const finalElement =
        document.createElement(
            "div"
        );

    finalElement.className =
        "final-text";

    finalElement.textContent =
        finalText;

    texto.appendChild(
        finalElement
    );


    const interimElement =
        document.createElement(
            "div"
        );

    interimElement.className =
        "interim-text";

    interimElement.textContent =
        textoInterim;

    texto.appendChild(
        interimElement
    );


    texto.scrollTop =
        texto.scrollHeight;
}


// ============================================
// DETENER
// ============================================

function detener() {

    console.log(
        "Deteniendo transcripción..."
    );


    conectado = false;
    iniciando = false;


    limpiarRecursos(
        true
    );
}


// ============================================
// LIMPIAR RECURSOS
// ============================================

function limpiarRecursos(
    cerrarSocket = true
) {

    // ========================================
    // TIMER
    // ========================================

    detenerTimer();


    // ========================================
    // PROCESSOR
    // ========================================

    if (processor) {

        try {

            processor.port.onmessage =
                null;

            processor.disconnect();

        }
        catch (error) {

            console.warn(
                "Error desconectando processor:",
                error
            );
        }

        processor = null;
    }


    // ========================================
    // SOURCE
    // ========================================

    if (source) {

        try {

            source.disconnect();

        }
        catch (error) {

            console.warn(
                "Error desconectando source:",
                error
            );
        }

        source = null;
    }


    // ========================================
    // AUDIO CONTEXT
    // ========================================

    if (audioContext) {

        try {

            audioContext.close();

        }
        catch (error) {

            console.warn(
                "Error cerrando AudioContext:",
                error
            );
        }

        audioContext = null;
    }


    // ========================================
    // MICRÓFONO
    // ========================================

    if (stream) {

        stream
            .getTracks()
            .forEach(
                track => track.stop()
            );

        stream = null;
    }


    // ========================================
    // WEBSOCKET
    // ========================================

    if (
        cerrarSocket &&
        socket
    ) {

        try {

            if (
                socket.readyState ===
                WebSocket.OPEN ||

                socket.readyState ===
                WebSocket.CONNECTING
            ) {

                socket.close();
            }

        }
        catch (error) {

            console.warn(
                "Error cerrando WebSocket:",
                error
            );
        }
    }


    socket = null;


    // ========================================
    // ESTADO
    // ========================================

    conectado = false;
    iniciando = false;


    estado.textContent =
        "Desconectado";

    estadoPunto.style.background =
        "#9ca3af";

    estadoAudio.textContent =
        "● Micrófono inactivo";

    tituloEstado.textContent =
        "Listo para comenzar";

    subtituloEstado.textContent =
        "Presiona el botón para comenzar a hablar";


    // ========================================
    // BOTÓN
    // ========================================

    boton.disabled =
        false;

    boton.textContent =
        "🎙️ Iniciar transcripción";

    boton.classList.remove(
        "stop"
    );
}


// ============================================
// LIMPIAR TEXTO
// ============================================

function limpiarTexto() {

    finalText = "";

    texto.innerHTML = `
        <div class="empty-state">
            <span>🎤</span>
            <p>Tu transcripción aparecerá aquí</p>
        </div>
    `;
}


// ============================================
// MOSTRAR ERROR
// ============================================

function mostrarError(
    mensaje
) {

    texto.innerHTML = `
        <div class="empty-state">

            <span>⚠️</span>

            <p>
                ${mensaje}
            </p>

        </div>
    `;
}


// ============================================
// TIMER
// ============================================

function startTimer() {

    detenerTimer();

    startTime =
        Date.now();

    timerElement.textContent =
        "00:00";


    timerInterval =
        setInterval(() => {

            const elapsed =
                Date.now() -
                startTime;

            const seconds =
                Math.floor(
                    elapsed / 1000
                );

            const minutes =
                Math.floor(
                    seconds / 60
                );

            const remainingSeconds =
                seconds % 60;


            timerElement.textContent =

                String(minutes)
                    .padStart(
                        2,
                        "0"
                    )

                +

                ":"

                +

                String(
                    remainingSeconds
                ).padStart(
                    2,
                    "0"
                );

        }, 1000);
}


// ============================================
// DETENER TIMER
// ============================================

function detenerTimer() {

    if (timerInterval) {

        clearInterval(
            timerInterval
        );

        timerInterval = null;
    }

    startTime = null;


    if (timerElement) {

        timerElement.textContent =
            "00:00";
    }
}
