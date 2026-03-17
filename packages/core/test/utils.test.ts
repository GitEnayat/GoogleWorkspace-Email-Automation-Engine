/**
 * Tests for date token processing and utility functions
 */

import { EmailEngine } from "../src/services/EmailEngine";
import { PlatformServices } from "../src";

// Minimal mock setup for utility testing
function createMinimalMockServices(): PlatformServices {
  return {
    email: {
      createDraft: jest.fn().mockResolvedValue("draft-123"),
      updateDraft: jest.fn().mockResolvedValue(undefined),
      findDraftBySubject: jest.fn().mockResolvedValue(null),
      findThreadBySubject: jest.fn().mockResolvedValue(null),
      createReplyDraft: jest.fn().mockResolvedValue("reply-123"),
      sendEmail: jest.fn().mockResolvedValue(undefined),
      getCurrentUserEmail: jest.fn().mockReturnValue("test@example.com"),
    } as any,
    template: {
      loadTemplate: jest.fn().mockResolvedValue({
        name: "Test",
        subject: "Test",
        body: "Test body",
        tags: [],
        tableRanges: [],
      }),
      getRawContent: jest.fn().mockResolvedValue(""),
    } as any,
    data: {
      getData: jest.fn().mockResolvedValue([]),
      getTabData: jest.fn().mockResolvedValue([]),
      appendRow: jest.fn().mockResolvedValue(undefined),
    } as any,
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any,
  };
}

describe("EmailEngine - Utility Functions", () => {
  let services: PlatformServices;

  beforeEach(() => {
    services = createMinimalMockServices();
  });

  describe("getGreeting", () => {
    it("should return Good Morning for hours 0-11", () => {
      const engine = new EmailEngine(services);
      const mockDate = new Date(2026, 2, 18, 9, 0, 0); // 9 AM
      jest.spyOn(global, "Date").mockImplementation(() => mockDate as any);

      // @ts-ignore - accessing private method for test
      const result = engine.getGreeting();
      expect(result).toBe("Good Morning");

      jest.spyOn(global, "Date").mockRestore();
    });

    it("should return Good Afternoon for hours 12-16", () => {
      const engine = new EmailEngine(services);
      const mockDate = new Date(2026, 2, 18, 14, 0, 0); // 2 PM
      jest.spyOn(global, "Date").mockImplementation(() => mockDate as any);

      // @ts-ignore - accessing private method for test
      const result = engine.getGreeting();
      expect(result).toBe("Good Afternoon");

      jest.spyOn(global, "Date").mockRestore();
    });

    it("should return Good Evening for hours 17-23", () => {
      const engine = new EmailEngine(services);
      const mockDate = new Date(2026, 2, 18, 20, 0, 0); // 8 PM
      jest.spyOn(global, "Date").mockImplementation(() => mockDate as any);

      // @ts-ignore - accessing private method for test
      const result = engine.getGreeting();
      expect(result).toBe("Good Evening");

      jest.spyOn(global, "Date").mockRestore();
    });
  });

  describe("applyDateTokens", () => {
    it("should replace DATE:Today with current date in DD-MMM-YYYY format", () => {
      const engine = new EmailEngine(services);
      const mockDate = new Date(2026, 2, 18); // March 18, 2026
      jest.spyOn(global, "Date").mockImplementation(() => mockDate as any);

      // @ts-ignore - accessing private method for test
      const result = engine.applyDateTokens("Today is {{DATE:Today}}");
      expect(result).toBe("Today is 18-Mar-2026");

      jest.spyOn(global, "Date").mockRestore();
    });

    it("should replace multiple date tokens", () => {
      const engine = new EmailEngine(services);
      const mockDate = new Date(2026, 2, 18);
      jest.spyOn(global, "Date").mockImplementation(() => mockDate as any);

      // @ts-ignore - accessing private method for test
      const result = engine.applyDateTokens(
        "Start: {{DATE:Today}} End: {{DATE:Today}}",
      );
      expect(result).toBe("Start: 18-Mar-2026 End: 18-Mar-2026");

      jest.spyOn(global, "Date").mockRestore();
    });

    it("should leave unknown date tokens unchanged", () => {
      const engine = new EmailEngine(services);

      // @ts-ignore - accessing private method for test
      const result = engine.applyDateTokens("Unknown: {{DATE:Unknown}}");
      expect(result).toBe("Unknown: {{DATE:Unknown}}");
    });
  });

  describe("htmlToPlainText", () => {
    it("should strip HTML tags", async () => {
      const engine = new EmailEngine(services);
      // @ts-ignore - accessing private method for test
      const result = engine.htmlToPlainText("<p>Hello <b>World</b></p>");
      expect(result).toBe("Hello World");
    });

    it("should replace br and p with newlines", () => {
      const engine = new EmailEngine(services);
      // @ts-ignore
      const result = engine.htmlToPlainText("Line 1<br>Line 2<p>Line 3</p>");
      expect(result).toContain("Line 1\nLine 2\nLine 3");
    });
  });
});
