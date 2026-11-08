"use client";
import type { Track } from "livekit-client";
import type { AudioProcessorOptions, TrackProcessor } from "livekit-client";

// Voice effects. They run on the speaker's own device, so only the changed voice is ever sent.
// Chain: mic -> pitch shift -> bass shelf -> (dry | ring modulator) -> gentle limiter -> out.

export type VoiceId = "natural" | "deep" | "higher" | "bass" | "robot";
type Spec = { label: string; hint: string; pitch: number; bass: number; robot: number };

export const VOICES: Record<VoiceId, Spec> = {
  natural: { label: "Natural", hint: "Your own voice", pitch: 1, bass: 0, robot: 0 },
  deep: { label: "Deeper", hint: "Lower and fuller", pitch: 0.78, bass: 6, robot: 0 },
  higher: { label: "Higher", hint: "Lighter and higher", pitch: 1.3, bass: -2, robot: 0 },
  bass: { label: "Bass boost", hint: "More warmth and low end", pitch: 1, bass: 12, robot: 0 },
  robot: { label: "Robot", hint: "Strongly disguised", pitch: 0.92, bass: 2, robot: 1 },
};
export const VOICE_IDS = Object.keys(VOICES) as VoiceId[];
export const isVoiceId = (v: unknown): v is VoiceId => typeof v === "string" && v in VOICES;

// A small granular pitch shifter: two delay taps that sweep through a short buffer and cross-fade.
const WORKLET = `
class PitchShift extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [{ name: "ratio", defaultValue: 1, minValue: 0.5, maxValue: 2, automationRate: "k-rate" }]; }
  constructor() { super(); this.N = 16384; this.buf = new Float32Array(this.N); this.w = 0; this.G = 2048; this.d = 0; }
  read(d) {
    const N = this.N; let p = this.w - d; while (p < 0) p += N;
    const i = Math.floor(p), f = p - i, a = this.buf[i % N], b = this.buf[(i + 1) % N];
    return a + (b - a) * f;
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0] && inputs[0][0]; const output = outputs[0] && outputs[0][0];
    if (!output) return true;
    if (!input) { output.fill(0); return true; }
    const r = parameters.ratio[0], G = this.G, N = this.N;
    for (let i = 0; i < output.length; i++) {
      this.buf[this.w] = input[i];
      const d1 = this.d; let d2 = d1 + G / 2; if (d2 >= G) d2 -= G;
      const g1 = 0.5 - 0.5 * Math.cos(2 * Math.PI * d1 / G);
      output[i] = this.read(d1) * g1 + this.read(d2) * (1 - g1);
      this.d += 1 - r; if (this.d >= G) this.d -= G; else if (this.d < 0) this.d += G;
      this.w = (this.w + 1) % N;
    }
    return true;
  }
}
registerProcessor("therapia-pitch", PitchShift);
`;

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();
function loadWorklet(ctx: BaseAudioContext): Promise<boolean> {
  let p = loaded.get(ctx);
  if (!p) {
    p = (async () => {
      if (!ctx.audioWorklet) return false;
      const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
      try { await ctx.audioWorklet.addModule(url); return true; } catch { return false; } finally { URL.revokeObjectURL(url); }
    })();
    loaded.set(ctx, p);
  }
  return p;
}

export type VoiceGraph = { setVoice: (v: VoiceId) => void; dispose: () => void; pitchAvailable: boolean };

/** Builds the effect chain between `source` and `destination` and returns controls for it. */
export async function buildVoiceGraph(ctx: BaseAudioContext, source: AudioNode, destination: AudioNode, voice: VoiceId): Promise<VoiceGraph> {
  const pitchOk = await loadWorklet(ctx);
  const nodes: AudioNode[] = [];
  const mk = <T extends AudioNode>(n: T) => { nodes.push(n); return n; };

  const pitchDry = mk(ctx.createGain());
  const pitchWet = mk(ctx.createGain());
  const shift = pitchOk ? mk(new AudioWorkletNode(ctx, "therapia-pitch", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1, channelCountMode: "explicit" })) : null;
  const shelf = mk(ctx.createBiquadFilter()); shelf.type = "lowshelf"; shelf.frequency.value = 220;
  const dry = mk(ctx.createGain());
  const ring = mk(ctx.createGain()); ring.gain.value = 0;
  const ringOut = mk(ctx.createGain());
  const osc = ctx.createOscillator(); osc.type = "sine"; osc.frequency.value = 62; osc.connect(ring.gain);
  const limiter = mk(ctx.createDynamicsCompressor());
  limiter.threshold.value = -10; limiter.knee.value = 10; limiter.ratio.value = 4; limiter.attack.value = 0.003; limiter.release.value = 0.2;

  source.connect(pitchDry);
  if (shift) { source.connect(shift); shift.connect(pitchWet); }
  pitchDry.connect(shelf); pitchWet.connect(shelf);
  shelf.connect(dry); shelf.connect(ring); ring.connect(ringOut);
  dry.connect(limiter); ringOut.connect(limiter);
  limiter.connect(destination);
  osc.start();

  const setVoice = (v: VoiceId) => {
    const s = VOICES[v]; const t = ctx.currentTime;
    const shifted = !!shift && s.pitch !== 1;
    if (shift) (shift.parameters.get("ratio") as AudioParam).setTargetAtTime(s.pitch, t, 0.02);
    pitchWet.gain.setTargetAtTime(shifted ? 1 : 0, t, 0.02);
    pitchDry.gain.setTargetAtTime(shifted ? 0 : 1, t, 0.02);
    shelf.gain.setTargetAtTime(s.bass, t, 0.02);
    dry.gain.setTargetAtTime(1 - s.robot, t, 0.02);
    ringOut.gain.setTargetAtTime(s.robot * 1.6, t, 0.02);
  };
  setVoice(voice);

  const dispose = () => {
    try { osc.stop(); } catch { /* already stopped */ }
    for (const n of [osc, ...nodes]) { try { n.disconnect(); } catch { /* ignore */ } }
  };
  return { setVoice, dispose, pitchAvailable: pitchOk };
}

/** Plugs into a LiveKit microphone track, so the voice is changed before it is published. */
export class VoiceProcessor implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  name = "therapia-voice";
  processedTrack?: MediaStreamTrack;
  private graph?: VoiceGraph;
  constructor(private voice: VoiceId) {}

  private async build(opts: AudioProcessorOptions) {
    const ctx = opts.audioContext;
    const src = ctx.createMediaStreamSource(new MediaStream([opts.track]));
    const dest = ctx.createMediaStreamDestination();
    this.graph = await buildVoiceGraph(ctx, src, dest, this.voice);
    this.processedTrack = dest.stream.getAudioTracks()[0];
  }
  async init(opts: AudioProcessorOptions) { await this.build(opts); }
  async restart(opts: AudioProcessorOptions) { await this.destroy(); await this.build(opts); }
  async destroy() { this.graph?.dispose(); this.graph = undefined; this.processedTrack = undefined; }
  setVoice(v: VoiceId) { this.voice = v; this.graph?.setVoice(v); }
}

/** Lets someone hear their own changed voice. Headphones recommended, or it can echo. */
export async function startPreview(voice: VoiceId): Promise<{ setVoice: (v: VoiceId) => void; stop: () => void }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const graph = await buildVoiceGraph(ctx, src, ctx.destination, voice);
  if (ctx.state === "suspended") await ctx.resume();
  return {
    setVoice: graph.setVoice,
    stop: () => { graph.dispose(); stream.getTracks().forEach((t) => t.stop()); ctx.close().catch(() => {}); },
  };
}
