class AudioProcessor extends AudioWorkletProcessor {

    constructor() {
        super();

        this.targetSampleRate = 16000;
        this.inputSampleRate = sampleRate;

        this.ratio =
            this.inputSampleRate /
            this.targetSampleRate;

        this.buffer = [];
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
        // RESAMPLING A 16 kHz
        // ============================================

        for (let i = 0; i < channel.length; i++) {

            this.buffer.push(channel[i]);

        }

        const outputLength =
            Math.floor(
                this.buffer.length /
                this.ratio
            );

        if (outputLength <= 0) {
            return true;
        }

        const pcm =
            new Int16Array(outputLength);

        for (let i = 0; i < outputLength; i++) {

            const position =
                i * this.ratio;

            const index =
                Math.floor(position);

            const nextIndex =
                Math.min(
                    index + 1,
                    this.buffer.length - 1
                );

            const fraction =
                position - index;

            const sample =
                this.buffer[index] *
                    (1 - fraction)
                +
                this.buffer[nextIndex] *
                    fraction;

            const clamped =
                Math.max(
                    -1,
                    Math.min(1, sample)
                );

            pcm[i] =
                clamped < 0
                    ? clamped * 32768
                    : clamped * 32767;
        }

        // ============================================
        // ELIMINAR MUESTRAS YA PROCESADAS
        // ============================================

        const consumed =
            outputLength *
            this.ratio;

        const removeCount =
            Math.floor(consumed);

        this.buffer =
            this.buffer.slice(
                removeCount
            );

        // ============================================
        // ENVIAR PCM INT16
        // ============================================

        this.port.postMessage(
            pcm.buffer,
            [pcm.buffer]
        );

        return true;
    }
}

registerProcessor(
    "audio-processor",
    AudioProcessor
);