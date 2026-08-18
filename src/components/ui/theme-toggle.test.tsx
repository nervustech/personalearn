import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveThemeToggleSide, ThemeToggle } from "./theme-toggle";

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

afterEach(() => cleanup());

describe("resolveThemeToggleSide", () => {
  it("opens header pickers downward so the menu stays on-screen", () => {
    expect(resolveThemeToggleSide(undefined, false)).toBe("bottom");
  });

  it("opens labeled rows upward so they stack with a bottom-bar popover", () => {
    expect(resolveThemeToggleSide(undefined, true)).toBe("top");
  });

  it("honors an explicit side for nested bottom-bar toggles", () => {
    expect(resolveThemeToggleSide("top", false)).toBe("top");
    expect(resolveThemeToggleSide("bottom", true)).toBe("bottom");
  });
});

describe("ThemeToggle", () => {
  it("opens the in-app menu below the trigger without portaling", async () => {
    const user = userEvent.setup();
    const { container } = render(<ThemeToggle />);

    await user.click(await screen.findByRole("button", { name: "Choose theme" }));

    const panel = container.querySelector(".absolute");
    expect(panel?.className).toContain("top-full");
    expect(screen.getByRole("button", { name: "Light" })).toBeInTheDocument();
  });

  it("portals hero menus to document.body so landing clicks reach the options", async () => {
    const user = userEvent.setup();
    const { container } = render(<ThemeToggle variant="hero" />);

    await user.click(within(container).getByRole("button", { name: "Choose theme" }));

    expect(screen.getByRole("button", { name: "Light" })).toBeInTheDocument();
    expect(document.body.querySelector("[data-pl-dropdown-panel].fixed")).toBeTruthy();
  });
});
