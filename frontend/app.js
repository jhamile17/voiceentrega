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
// URL DEL BACKEND
// ============================================

function obtenerWebSocketUrl() {

    // ----------------------------------------
    // LOCAL
    // ----------------------------------------

    if (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
    ) {

        return "ws://localhost:8000/ws/audio";

    }


    // ----------------------------------------
    // RENDER / PRODUCCIÓN
    // ----------------------------------------

    return "wss://voiceentrega-1.onrender.com/ws/audio";

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

        console.log(
            "Iniciando transcripción..."
        );


        boton.disabled = true;


        tituloEstado.textContent =
            "Conectando...";


        subtituloEstado.textContent =
            "Preparando el micrófono...";


        estado.textContent =
            "Conectando";


        estadoPunto.style.background =
            "#f59e0b";


        // ----------------------------------------
        // LIMPIAR TRANSCRIPCIÓN ANTERIOR
        // ----------------------------------------

        finalText = "";


        texto.innerHTML = `
            <div class="empty-state">

                <span>🎤</span>

                <p>
                    Escuchando...
                </p>

            </div>
        `;


        // ----------------------------------------
        // OBTENER URL WEBSOCKET
        // ----------------------------------------

        const websocketUrl =
            obtenerWebSocketUrl();


        console.log(
            "Conectando WebSocket:",
            websocketUrl
        );


        // ----------------------------------------
        // CREAR WEBSOCKET
        // ----------------------------------------

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
                    "WebSocket conectado"
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


                boton.disabled = false;


                // ----------------------------------------
                // SOLICITAR MICRÓFONO
                // ----------------------------------------

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
                    "Micrófono obtenido"
                );


                // ----------------------------------------
                // AUDIO CONTEXT
                // ----------------------------------------

                audioContext =
                    new AudioContext({

                        sampleRate: 16000

                    });


                // ----------------------------------------
                // REANUDAR AUDIO CONTEXT
                // ----------------------------------------

                if (
                    audioContext.state ===
                    "suspended"
                ) {

                    await audioContext.resume();

                }


                console.log(
                    "AudioContext:",
                    audioContext.state
                );


                console.log(
                    "Sample rate:",
                    audioContext.sampleRate
                );


                // ----------------------------------------
                // CARGAR AUDIO WORKLET
                // ----------------------------------------

                await audioContext.audioWorklet.addModule(
                    "audioProcessor.js"
                );


                console.log(
                    "AudioProcessor cargado"
                );


                // ----------------------------------------
                // SOURCE
                // ----------------------------------------

                source =
                    audioContext.createMediaStreamSource(
                        stream
                    );


                // ----------------------------------------
                // PROCESSOR
                // ----------------------------------------

                processor =
                    new AudioWorkletNode(
                        audioContext,
                        "audio-processor"
                    );


                // ----------------------------------------
                // RECIBIR AUDIO DEL WORKLET
                // ----------------------------------------

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


                // ----------------------------------------
                // CONECTAR SOURCE → PROCESSOR
                // ----------------------------------------

                source.connect(
                    processor
                );


                /*
                    No conectamos processor
                    con audioContext.destination.

                    De esta manera el audio
                    del micrófono no se reproduce
                    por los parlantes.
                */


                // ----------------------------------------
                // INICIAR TIMER
                // ----------------------------------------

                startTimer();


                console.log(
                    "Transcripción iniciada correctamente"
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
        // RESULTADOS DE GOOGLE SPEECH-TO-TEXT
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


                    // ----------------------------------------
                    // VALIDAR TEXTO
                    // ----------------------------------------

                    if (
                        !textoReconocido ||
                        textoReconocido.trim() === ""
                    ) {

                        return;

                    }


                    // ----------------------------------------
                    // IGNORAR "STOP"
                    // ----------------------------------------

                    if (
                        textoReconocido
                            .trim()
                            .toLowerCase() ===
                        "stop"
                    ) {

                        console.log(
                            "Mensaje 'Stop' ignorado"
                        );

                        return;

                    }


                    // ----------------------------------------
                    // RESULTADO FINAL
                    // ----------------------------------------

                    if (esFinal) {

                        finalText +=
                            textoReconocido + " ";


                        actualizarTextoFinal();

                    }


                    // ----------------------------------------
                    // RESULTADO INTERMEDIO
                    // ----------------------------------------

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
                    "WebSocket cerrado:",
                    event.code,
                    event.reason
                );


                /*
                    Si el cierre ocurrió porque
                    nosotros presionamos detener,
                    no necesitamos hacer nada más.
                */

                if (conectado) {

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


    // ----------------------------------------
    // TEXTO FINAL
    // ----------------------------------------

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


    // ----------------------------------------
    // TEXTO INTERMEDIO
    // ----------------------------------------

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


    // ----------------------------------------
    // SCROLL AUTOMÁTICO
    // ----------------------------------------

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

    // ----------------------------------------
    // TIMER
    // ----------------------------------------

    detenerTimer();


    // ----------------------------------------
    // AUDIO PROCESSOR
    // ----------------------------------------

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


    // ----------------------------------------
    // AUDIO SOURCE
    // ----------------------------------------

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


    // ----------------------------------------
    // AUDIO CONTEXT
    // ----------------------------------------

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


    // ----------------------------------------
    // MICRÓFONO
    // ----------------------------------------

    if (stream) {

        stream
            .getTracks()
            .forEach(
                track => track.stop()
            );


        stream = null;

    }


    // ----------------------------------------
    // WEBSOCKET
    // ----------------------------------------

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


    // ----------------------------------------
    // ESTADO
    // ----------------------------------------

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


    // ----------------------------------------
    // BOTÓN
    // ----------------------------------------

    boton.disabled = false;


    boton.textContent =
        "🎙️ Iniciar transcripción";


    boton.classList.remove(
        "stop"
    );


    // ----------------------------------------
    // LIMPIAR TRANSCRIPCIÓN
    // ----------------------------------------

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