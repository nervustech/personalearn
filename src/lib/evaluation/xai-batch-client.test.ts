import { describe, expect, it } from "vitest";
import { extractResponsesText } from "@/lib/evaluation/xai-batch-client";

describe("extractResponsesText", () => {
  it("reads chat_get_completion envelope used by xAI batch results", () => {
    const text = extractResponsesText({
      chat_get_completion: {
        choices: [
          {
            message: {
              content:
                '{"admission_number":"1196","admission_confidence":0.95,"questions_found":["1"]}',
            },
          },
        ],
      },
    });
    expect(text).toContain('"admission_number":"1196"');
  });

  it("reads an unwrapped chat.completion object", () => {
    const text = extractResponsesText({
      choices: [
        {
          message: {
            content:
              '{"admission_number":"1990","admission_confidence":0.9,"questions_found":[]}',
          },
        },
      ],
    });
    expect(text).toContain('"admission_number":"1990"');
  });

  it("reads Responses API output_text", () => {
    expect(extractResponsesText({ output_text: '{"ok":true}' })).toBe(
      '{"ok":true}'
    );
  });
});
