// Minimal feed-forward neural network, written from scratch (no dependencies).
// Dense layers, tanh hidden activations, sigmoid outputs, trained with
// mini-batch gradient descent + momentum on binary cross-entropy.
// Everything is seeded so training is deterministic on every device.

/** Deterministic PRNG (mulberry32) — same seed ⇒ same weights everywhere. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Layer {
  w: Float64Array; // out × in, row-major
  b: Float64Array; // out
  vw: Float64Array; // momentum buffers
  vb: Float64Array;
  in: number;
  out: number;
}

export interface SerializedNet {
  sizes: number[];
  layers: { w: number[]; b: number[] }[];
}

export class NeuralNet {
  readonly sizes: number[];
  private layers: Layer[];

  constructor(sizes: number[], rng: () => number = makeRng(1)) {
    this.sizes = sizes;
    this.layers = [];
    for (let l = 0; l < sizes.length - 1; l++) {
      const nIn = sizes[l], nOut = sizes[l + 1];
      const w = new Float64Array(nOut * nIn);
      // Xavier init keeps tanh activations in their linear range at the start.
      const scale = Math.sqrt(2 / (nIn + nOut));
      for (let i = 0; i < w.length; i++) w[i] = (rng() * 2 - 1) * scale;
      this.layers.push({
        w, b: new Float64Array(nOut),
        vw: new Float64Array(nOut * nIn), vb: new Float64Array(nOut),
        in: nIn, out: nOut,
      });
    }
  }

  /** Forward pass; returns the activations of every layer (input first). */
  private forwardAll(x: number[] | Float64Array): Float64Array[] {
    const acts: Float64Array[] = [Float64Array.from(x)];
    for (let l = 0; l < this.layers.length; l++) {
      const { w, b, in: nIn, out: nOut } = this.layers[l];
      const prev = acts[l];
      const a = new Float64Array(nOut);
      const last = l === this.layers.length - 1;
      for (let o = 0; o < nOut; o++) {
        let z = b[o];
        const row = o * nIn;
        for (let i = 0; i < nIn; i++) z += w[row + i] * prev[i];
        a[o] = last ? 1 / (1 + Math.exp(-z)) : Math.tanh(z);
      }
      acts.push(a);
    }
    return acts;
  }

  predict(x: number[] | Float64Array): Float64Array {
    const acts = this.forwardAll(x);
    return acts[acts.length - 1];
  }

  /**
   * Train on (inputs, targets) pairs. Targets are per-output probabilities in
   * [0,1] (soft labels are fine — BCE handles them). Returns final mean loss.
   */
  train(
    inputs: number[][], targets: number[][],
    opts: { epochs?: number; lr?: number; momentum?: number; batch?: number; rng?: () => number } = {},
  ): number {
    const { epochs = 30, lr = 0.05, momentum = 0.9, batch = 32 } = opts;
    const rng = opts.rng ?? makeRng(7);
    const n = inputs.length;
    const order = Array.from({ length: n }, (_, i) => i);
    let loss = 0;

    for (let e = 0; e < epochs; e++) {
      // Fisher–Yates shuffle with the seeded RNG.
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      loss = 0;
      for (let start = 0; start < n; start += batch) {
        const idx = order.slice(start, start + batch);
        // Accumulate gradients over the batch.
        const gw = this.layers.map((L) => new Float64Array(L.w.length));
        const gb = this.layers.map((L) => new Float64Array(L.b.length));
        for (const s of idx) {
          const acts = this.forwardAll(inputs[s]);
          const out = acts[acts.length - 1];
          const y = targets[s];
          // δ at the output: sigmoid + BCE ⇒ (ŷ − y), the clean gradient.
          let delta = new Float64Array(out.length);
          for (let o = 0; o < out.length; o++) {
            delta[o] = out[o] - y[o];
            const p = Math.min(Math.max(out[o], 1e-9), 1 - 1e-9);
            loss += -(y[o] * Math.log(p) + (1 - y[o]) * Math.log(1 - p));
          }
          for (let l = this.layers.length - 1; l >= 0; l--) {
            const L = this.layers[l];
            const prev = acts[l];
            for (let o = 0; o < L.out; o++) {
              const row = o * L.in;
              gb[l][o] += delta[o];
              for (let i = 0; i < L.in; i++) gw[l][row + i] += delta[o] * prev[i];
            }
            if (l > 0) {
              const next = new Float64Array(L.in);
              for (let i = 0; i < L.in; i++) {
                let d = 0;
                for (let o = 0; o < L.out; o++) d += L.w[o * L.in + i] * delta[o];
                const a = prev[i]; // tanh' = 1 − a²
                next[i] = d * (1 - a * a);
              }
              delta = next;
            }
          }
        }
        // Momentum SGD step.
        const k = lr / idx.length;
        for (let l = 0; l < this.layers.length; l++) {
          const L = this.layers[l];
          for (let i = 0; i < L.w.length; i++) {
            L.vw[i] = momentum * L.vw[i] - k * gw[l][i];
            L.w[i] += L.vw[i];
          }
          for (let i = 0; i < L.b.length; i++) {
            L.vb[i] = momentum * L.vb[i] - k * gb[l][i];
            L.b[i] += L.vb[i];
          }
        }
      }
    }
    return loss / (n * this.sizes[this.sizes.length - 1]);
  }

  toJSON(): SerializedNet {
    return {
      sizes: this.sizes,
      layers: this.layers.map((L) => ({ w: Array.from(L.w), b: Array.from(L.b) })),
    };
  }

  static fromJSON(data: SerializedNet): NeuralNet {
    const net = new NeuralNet(data.sizes);
    for (let l = 0; l < net.layers.length; l++) {
      net.layers[l].w = Float64Array.from(data.layers[l].w);
      net.layers[l].b = Float64Array.from(data.layers[l].b);
    }
    return net;
  }
}
