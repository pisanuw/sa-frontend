// The parts of the Speech Rule Engine (https://github.com/Speech-Rule-Engine/speech-rule-engine,
// Apache-2.0) that src/math/engine.ts uses. The package ships no types at its entry point.
declare module "speech-rule-engine" {
  export function setupEngine(options: Record<string, unknown>): Promise<void>;
  export function engineReady(): Promise<void>;
  export function toSpeech(mathml: string): string;
  export const version: string;
}
