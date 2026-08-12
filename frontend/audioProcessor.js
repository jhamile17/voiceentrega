class AudioProcessor extends AudioWorkletProcessor {

    constructor() {
        super();

        // Frecuencia real del dispositivo
        this.inputSampleRate = sampleRate;

        // Frecuencia que espera Google Speech
        this.targetSampleRate = 16000;

        // Relación de conversión
        this.resampleRatio =
            this.inputSampleRate /
            this.targetSampleRate;

        console.log(
            "AudioProcessor iniciado:",
            this.inputSampleRate,
            "Hz ->",
            this.targetSampleRate,
            "Hz"
        );
    }


    process(inputs, outputs, parameters) {

        const input = inputs[0];

        if (!input || input.length === 0) {
            return true;
        }


        const channel = input[0];

        if (!channel) {
            return true;
        }


        // ============================================
        // SI YA ESTAMOS EN 16000 Hz
        // ============================================

        if (
            this.inputSampleRate ===
            this.targetSampleRate
        ) {

            this.convertirYEnviar(channel);

            return true;
        }


        // ============================================
        // CONVERTIR A 16000 Hz
        // ============================================

        this.remuestrear(channel);


        return true;
    }


    // ============================================
    // REMUESTREO
    // ============================================

    remuestrear(input) {

        const ratio =
            this.resampleRatio;


        const outputLength =
            Math.floor(
                input.length / ratio
            );


        const pcm =
            new Int16Array(
                outputLength
            );


        for (
            let i = 0;
            i < outputLength;
            i++
        ) {

            const position =
                i * ratio;


            const index =
                Math.floor(
                    position
                );


            const nextIndex =
                Math.min(
                    index + 1,
                    input.length - 1
                );


            const fraction =
                position - index;


            // Interpolación lineal
            const sample =
                input[index] *
                    (1 - fraction) +

                input[nextIndex] *
                    fraction;


            // Limitar Float32 entre -1 y 1
            const normalized =
                Math.max(
                    -1,
                    Math.min(
                        1,
                        sample
                    )
                );


            // Float32 -> PCM Int16
            pcm[i] =
                normalized < 0
                    ? normalized * 32768
                    : normalized * 32767;
        }


        // Enviar PCM al app.js
        this.port.postMessage(
            pcm.buffer,
            [pcm.buffer]
        );
    }


    // ============================================
    // CONVERTIR DIRECTAMENTE A PCM
    // ============================================

    convertirYEnviar(input) {

        const pcm =
            new Int16Array(
                input.length
            );


        for (
            let i = 0;
            i < input.length;
            i++
        ) {

            let sample =
                input[i];


            sample =
                Math.max(
                    -1,
                    Math.min(
                        1,
                        sample
                    )
                );


            pcm[i] =
                sample < 0
                    ? sample * 32768
                    : sample * 32767;
        }


        this.port.postMessage(
            pcm.buffer,
            [pcm.buffer]
        );
    }
}


registerProcessor(
    "audio-processor",
    AudioProcessor
);