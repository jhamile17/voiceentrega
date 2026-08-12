class AudioProcessor extends AudioWorkletProcessor {

    constructor() {
        super();
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

        // Convierte Float32 (-1 a 1) -> PCM Int16
        const pcm = new Int16Array(channel.length);

        for (let i = 0; i < channel.length; i++) {

            let sample = channel[i];

            sample = Math.max(-1, Math.min(1, sample));

            pcm[i] = sample < 0
                ? sample * 32768
                : sample * 32767;
        }

        // Envía el audio al hilo principal
        this.port.postMessage(pcm.buffer);

        return true;
    }
}

registerProcessor(
    "audio-processor",
    AudioProcessor
);