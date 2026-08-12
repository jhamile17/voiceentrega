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
let stream = null;

let finalText = "";

let timerInterval = null;
let startTime = null;

let conectado = false;


// ============================================
// CONFIGURACIÓN
// ============================================

const TARGET_SAMPLE_RATE = 16000;


// ============================================
// URL WEBSOCKET
// ============================================

function obtenerWebSocketUrl() {

    // ========================================
    // LOCAL
    // ========================================

    if (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
    ) {

        return "ws://localhost:8000/ws/audio";
    }


    // ========================================
    // PRODUCCIÓN - RENDER
    // ========================================

    return "wss://voiceentrega.onrender.com/ws/audio";
}


// ============================================
// INICIAR / DETENER
// ============================================

function toggleTranscripcion() {

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

    try {

        console.log("=================================");
        console.log("Iniciando transcripción...");
        console.log("=================================");


        boton.disabled = true;


        tituloEstado.textContent =
            "Conectando...";


        subtituloEstado.textContent =
            "Preparando el micrófono...";


        estado.textContent =
            "Conectando";


        estadoPunto.style.background =
            "#f59e0b";


        // ========================================
        // LIMPIAR TEXTO ANTERIOR
        // ========================================

        finalText = "";

        texto.innerHTML = `
            <div class="empty-state">
                <span>🎤</span>
                <p>Escuchando...</p>
            </div>
        `;


        // ========================================
        // URL WEBSOCKET
        // ========================================

        const websocketUrl =
            obtenerWebSocketUrl();


        console.log(
            "WebSocket:",
            websocketUrl
        );


        // ========================================
        // CREAR WEBSOCKET
        // ========================================

        socket =
            new WebSocket(
                websocketUrl
            );


        socket.binaryType =
            "arraybuffer";


        // ========================================
        // WEBSOCKET CONECTADO
        // ========================================

        socket.onopen = async () => {

            try {

                console.log(
                    "WebSocket conectado correctamente"
                );


                conectado = true;


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
                // SOLICITAR MICRÓFONO
                // ====================================

                stream =
                    await navigator.mediaDevices.getUserMedia({

                        audio: {

                            channelCount: 1,

                            echoCancellation: true,

                            noiseSuppression: true,

                            autoGainControl: true

                        }

                    });


                console.log(
                    "Micrófono obtenido correctamente"
                );


                // ====================================
                // AUDIO CONTEXT
                // ====================================

                /*
                    No forzamos 16000 Hz aquí.

                    En celulares normalmente el navegador
                    trabaja a 48000 Hz.

                    El AudioWorklet será el encargado
                    de convertir 48000 Hz -> 16000 Hz.
                */

                audioContext =
                    new AudioContext();


                console.log(
                    "AudioContext:",
                    audioContext.state
                );


                console.log(
                    "Sample rate del dispositivo:",
                    audioContext.sampleRate
                );


                // ====================================
                // REANUDAR AUDIO
                // ====================================

                if (
                    audioContext.state ===
                    "suspended"
                ) {

                    await audioContext.resume();
                }


                console.log(
                    "AudioContext después de resume:",
                    audioContext.state
                );


                // ====================================
                // CARGAR AUDIO WORKLET
                // ====================================

                await audioContext.audioWorklet.addModule(
                    "audioProcessor.js"
                );


                console.log(
                    "AudioProcessor cargado correctamente"
                );


                // ====================================
                // SOURCE
                // ====================================

                source =
                    audioContext.createMediaStreamSource(
                        stream
                    );


                // ====================================
                // PROCESSOR
                // ====================================

                processor =
                    new AudioWorkletNode(
                        audioContext,
                        "audio-processor"
                    );


                // ====================================
                // RECIBIR AUDIO DEL WORKLET
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


                /*
                    IMPORTANTE:

                    NO conectamos processor con
                    audioContext.destination.

                    De esta forma el micrófono
                    no se reproduce por los parlantes.
                */


                // ====================================
                // TIMER
                // ====================================

                startTimer();


                console.log(
                    "================================="
                );

                console.log(
                    "Transcripción iniciada"
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

            }
            catch (error) {

                console.error(
                    "Error iniciando micrófono:",
                    error
                );


                mostrarError(
                    "No se pudo acceder al micrófono"
                );


                detener();
            }
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


                    // ====================================
                    // VALIDAR TEXTO
                    // ====================================

                    if (
                        !textoReconocido ||
                        textoReconocido.trim() === ""
                    ) {

                        return;
                    }


                    // ====================================
                    // IGNORAR STOP
                    // ====================================

                    if (
                        textoReconocido
                            .trim()
                            .toLowerCase() ===
                        "stop"
                    ) {

                        console.log(
                            "Mensaje STOP ignorado"
                        );

                        return;
                    }


                    // ====================================
                    // RESULTADO FINAL
                    // ====================================

                    if (esFinal) {

                        finalText +=
                            textoReconocido.trim() +
                            " ";


                        actualizarTextoFinal();
                    }


                    // ====================================
                    // RESULTADO INTERMEDIO
                    // ====================================

                    else {

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
                    "WebSocket cerrado"
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
                    "No se pudo conectar con el servidor"
                );


                conectado = false;
            };

    }
    catch (error) {

        console.error(
            "Error al iniciar:",
            error
        );


        mostrarError(
            "Ocurrió un error al iniciar la transcripción"
        );


        detener();
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


    // ========================================
    // TEXTO FINAL
    // ========================================

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


    // ========================================
    // TEXTO INTERMEDIO
    // ========================================

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


    // ========================================
    // SCROLL
    // ========================================

    texto.scrollTop =
        texto.scrollHeight;
}


// ============================================
// DETENER TRANSCRIPCIÓN
// ============================================

function detener() {

    console.log(
        "Deteniendo transcripción..."
    );


    conectado = false;


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


    // ========================================
    // TEXTO
    // ========================================

    finalText = "";


    texto.innerHTML = `
        <div class="empty-state">

            <span>🎤</span>

            <p>
                Tu transcripción aparecerá aquí
            </p>

        </div>
    `;
}


// ============================================
// LIMPIAR TEXTO
// ============================================

function limpiarTexto() {

    finalText = "";


    texto.innerHTML = `
        <div class="empty-state">

            <span>🎤</span>

            <p>
                Tu transcripción aparecerá aquí
            </p>

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