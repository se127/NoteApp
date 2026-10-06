import { describe, expect, test } from "bun:test";
import { screen } from "@testing-library/react";

import { WelcomePage } from "@/pages/welcome-page";
import { renderWithProviders } from "./helpers/render";

describe("WelcomePage", () => {
  test("asks the user to pick or create a note", () => {
    renderWithProviders(<WelcomePage />);

    expect(
      screen.getByText("یک یادداشت را انتخاب کنید یا یک یادداشت جدید بسازید"),
    ).toBeDefined();
  });

  test("shows no error and no note list", () => {
    renderWithProviders(<WelcomePage />);

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
