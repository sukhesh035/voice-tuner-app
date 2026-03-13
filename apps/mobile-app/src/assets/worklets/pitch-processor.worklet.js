/**
 * PitchProcessorWorklet
 * AudioWorkletProcessor that buffers audio samples and performs
 * YIN pitch detection off the main thread for minimal latency.
 *
 * Loaded via: audioContext.audioWorklet.addModule('/assets/worklets/pitch-processor.worklet.js')
 */
class PitchProcessorWorklet extends AudioWorkletProcessor {
  private buffer: Float32Array;
  private bufferIndex = 0;
  private readonly BUFFER_SIZE = 2048;
  private readonly YIN_THRESHOLD = 0.15;

  constructor() {
    super();
    this.buffer = new Float32Array(this.BUFFER_SIZE);
  }

  /**
   * Called per render quantum (128 frames at 44100 Hz = ~2.9ms).
   * Accumulates frames into buffer, runs YIN when full.
   */
  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (!channel || channel.length === 0) return true;

    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.bufferIndex++] = channel[i];
      if (this.bufferIndex >= this.BUFFER_SIZE) {
        const result = this.yin(this.buffer);
        if (result !== null) {
          this.port.postMessage({ frequency: result.frequency, clarity: result.clarity });
        } else {
          this.port.postMessage({ frequency: 0, clarity: 0 });
        }
        this.bufferIndex = 0;
      }
    }
    return true;
  }

  private yin(buffer: Float32Array): { frequency: number; clarity: number } | null {
    const N    = buffer.length;
    const half = Math.floor(N / 2);
    const diff = new Float32Array(half);

    for (let tau = 1; tau < half; tau++) {
      for (let j = 0; j < half; j++) {
        const d = buffer[j] - buffer[j + tau];
        diff[tau] += d * d;
      }
    }

    const cmnd = new Float32Array(half);
    cmnd[0] = 1;
    let sum = 0;
    for (let tau = 1; tau < half; tau++) {
      sum += diff[tau];
      cmnd[tau] = diff[tau] / (sum / tau);
    }

    let tau = 2;
    while (tau < half) {
      if (cmnd[tau] < this.YIN_THRESHOLD) {
        while (tau + 1 < half && cmnd[tau + 1] < cmnd[tau]) tau++;
        break;
      }
      tau++;
    }

    if (tau >= half || cmnd[tau] >= this.YIN_THRESHOLD) return null;

    // Parabolic interpolation
    const f = tau;
    const refined = (f < 1 || f + 1 >= half)
      ? f
      : f + (cmnd[f - 1] - cmnd[f + 1]) / (2 * (2 * cmnd[f] - cmnd[f - 1] - cmnd[f + 1]));

    const frequency = sampleRate / refined;
    if (frequency < 80 || frequency > 1200) return null;
    return { frequency, clarity: 1 - cmnd[tau] };
  }
}

registerProcessor('pitch-processor', PitchProcessorWorklet);
