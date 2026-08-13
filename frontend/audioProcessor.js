class AudioProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();

        const processorOptions = options.processorOptions || {};

        this.inputSampleRate =
            processorOptions.inputSampleRate || sampleRate;
        this.targetSampleRate =
            processorOptions.outputSampleRate || 16000;
        this.packetSamples =
            processorOptions.packetSamples || 1600;
        this.ratio =
            this.inputSampleRate / this.targetSampleRate;

        // La posición se conserva entre bloques. Esto evita distorsión en
        // celulares que capturan a 44.1 kHz (no es múltiplo de 16 kHz).
        this.samples = [];
        this.position = 0;
        this.packet = new Int16Array(this.packetSamples);
        this.packetLength = 0;
    }

    process(inputs) {
        const channel = inputs[0] && inputs[0][0];

        if (!channel) {
            return true;
        }

        for (let index = 0; index < channel.length; index += 1) {
            this.samples.push(channel[index]);
        }

        while (this.position + 1 < this.samples.length) {
            const index = Math.floor(this.position);
            const fraction = this.position - index;
            const sample =
                this.samples[index] * (1 - fraction) +
                this.samples[index + 1] * fraction;
            const clamped = Math.max(-1, Math.min(1, sample));

            this.packet[this.packetLength] =
                clamped < 0 ? clamped * 32768 : clamped * 32767;
            this.packetLength += 1;

            // Google recibe bloques consistentes de 100 ms en vez de cientos
            // de mensajes de 2-3 ms cada segundo.
            if (this.packetLength === this.packetSamples) {
                this.port.postMessage(
                    this.packet.buffer,
                    [this.packet.buffer]
                );

                this.packet = new Int16Array(this.packetSamples);
                this.packetLength = 0;
            }

            this.position += this.ratio;
        }

        const consumed = Math.min(
            Math.floor(this.position),
            this.samples.length
        );

        if (consumed > 0) {
            this.samples = this.samples.slice(consumed);
            this.position -= consumed;
        }

        return true;
    }
}

registerProcessor(audio-processor, AudioProcessor);
