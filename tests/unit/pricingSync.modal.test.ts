import { test } from "node:test";
import assert from "node:assert/strict";
import { transformToNerve } from "../../src/lib/pricingSync.ts";

test("transformToNerve ingests an image model's per-image cost", () => {
  const out = transformToNerve({
    "dall-e-3": {
      mode: "image_generation",
      litellm_provider: "openai",
      output_cost_per_image: 0.04,
    },
  });
  assert.equal(out.openai?.["dall-e-3"]?.output_cost_per_image, 0.04);
});
test("transformToNerve ingests an audio (per-second) model", () => {
  const out = transformToNerve({
    "whisper-1": {
      mode: "audio_transcription",
      litellm_provider: "openai",
      input_cost_per_second: 0.0001,
    },
  });
  assert.equal(out.openai?.["whisper-1"]?.input_cost_per_second, 0.0001);
});
test("transformToNerve still ingests chat token pricing (no regression)", () => {
  const out = transformToNerve({
    "gpt-4o": {
      mode: "chat",
      litellm_provider: "openai",
      input_cost_per_token: 0.0000025,
      output_cost_per_token: 0.00001,
    },
  });
  assert.equal(out.openai?.["gpt-4o"]?.input, 2.5);
  assert.equal(out.openai?.["gpt-4o"]?.output, 10);
});
test("transformToNerve maps newly-covered providers", () => {
  const out = transformToNerve({
    "mistral-large": {
      mode: "chat",
      litellm_provider: "mistral",
      input_cost_per_token: 0.000002,
      output_cost_per_token: 0.000006,
    },
    "grok-2": {
      mode: "chat",
      litellm_provider: "xai",
      input_cost_per_token: 0.000002,
      output_cost_per_token: 0.00001,
    },
  });
  assert.ok(out.mistral?.["mistral-large"]);
  assert.ok(out.xai?.["grok-2"]);
});
