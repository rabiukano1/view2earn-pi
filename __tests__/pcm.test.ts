import { toInt16 } from "../convex/lib/pcm";

// Guards the float->int16 conversion feeding the MP3 encoder (voiceMp3.ts):
// a scaling or clamping slip there turns voice notes into noise.
test("scales, clamps and preserves silence", () => {
  const out = toInt16(new Float32Array([0, 1, -1, 2, -2, 0.5]));
  expect(Array.from(out)).toEqual([0, 32767, -32768, 32767, -32768, 16383]);
});
