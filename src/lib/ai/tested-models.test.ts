import { describe, expect, it } from "vitest";

import {
	isTestedAiModel,
	RECOMMENDED_AI_MODEL,
	RECOMMENDED_LOCAL_AI_MODEL,
	TESTED_AI_MODELS,
} from "@/lib/ai/tested-models";

/**
 * Interne Liste der getesteten KI-Modelle (dezente Warnung in den
 * Einstellungen bei nicht gelisteten Modellen, keine Sperre).
 */
describe("tested-models (src/lib/ai/tested-models.ts)", () => {
	it("enthält keine Duplikate und keine leeren Einträge", () => {
		expect(TESTED_AI_MODELS.length).toBeGreaterThan(0);
		expect(new Set(TESTED_AI_MODELS).size).toBe(TESTED_AI_MODELS.length);
		for (const model of TESTED_AI_MODELS) {
			expect(model.trim()).toBe(model);
			expect(model.length).toBeGreaterThan(0);
		}
	});

	it("enthält beide Empfehlungen (Cloud und lokal)", () => {
		expect(isTestedAiModel(RECOMMENDED_AI_MODEL)).toBe(true);
		expect(isTestedAiModel(RECOMMENDED_LOCAL_AI_MODEL)).toBe(true);
	});

	it("erkennt getestete Modelle unabhängig von Trim und Groß-/Kleinschreibung", () => {
		expect(isTestedAiModel("z-ai/glm-5.3-flash")).toBe(true);
		expect(isTestedAiModel("  z-ai/glm-5.3-flash  ")).toBe(true);
		expect(isTestedAiModel("Z-AI/GLM-5.3-FLASH")).toBe(true);
		expect(isTestedAiModel("ggml-org/qwen3.8-27b-gguf:q8_0")).toBe(true);
	});

	it("lehnt unbekannte Modelle und leere Eingaben ab", () => {
		expect(isTestedAiModel("gpt-4o-mini")).toBe(false);
		expect(isTestedAiModel("")).toBe(false);
		expect(isTestedAiModel("   ")).toBe(false);
	});
});
