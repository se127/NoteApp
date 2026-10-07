import { afterEach, describe, expect, test } from "bun:test";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";

import { TitleEmojiPicker } from "@/components/title-emoji-picker";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FREQUENT_EMOJI } from "@/lib/frequent-emoji";

const LABEL = "انتخاب ایموجی";

function Controlled({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <TitleEmojiPicker onSelect={onSelect} open={open} onOpenChange={setOpen} />
  );
}

function renderOpen(onSelect: (emoji: string) => void) {
  return render(
    <TooltipProvider>
      <TitleEmojiPicker open onOpenChange={() => {}} onSelect={onSelect} />
    </TooltipProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe("TitleEmojiPicker", () => {
  test("renders a labelled trigger", () => {
    render(
      <TooltipProvider>
        <Controlled onSelect={() => {}} />
      </TooltipProvider>,
    );

    expect(screen.getByRole("button", { name: LABEL })).toBeDefined();
  });

  test("keeps the grid closed until the trigger is used", () => {
    render(
      <TooltipProvider>
        <Controlled onSelect={() => {}} />
      </TooltipProvider>,
    );

    expect(screen.queryByRole("grid", { name: LABEL })).toBeNull();
  });

  test("opens the grid from the trigger", () => {
    render(
      <TooltipProvider>
        <Controlled onSelect={() => {}} />
      </TooltipProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: LABEL }));

    expect(screen.getByRole("grid", { name: LABEL })).toBeDefined();
  });

  test("renders every frequent emoji as a grid cell", () => {
    renderOpen(() => {});

    expect(screen.getAllByRole("gridcell")).toHaveLength(FREQUENT_EMOJI.length);
  });

  test("labels each cell with its emoji", () => {
    renderOpen(() => {});

    for (const emoji of FREQUENT_EMOJI) {
      expect(screen.getByRole("gridcell", { name: emoji })).toBeDefined();
    }
  });

  test("calls onSelect with the chosen emoji", () => {
    const chosen: string[] = [];
    renderOpen((emoji) => chosen.push(emoji));

    fireEvent.click(
      screen.getByRole("gridcell", { name: FREQUENT_EMOJI[0] as string }),
    );

    expect(chosen).toEqual([FREQUENT_EMOJI[0]]);
  });

  test("calls onSelect for a later emoji too", () => {
    const chosen: string[] = [];
    renderOpen((emoji) => chosen.push(emoji));

    fireEvent.click(screen.getByRole("gridcell", { name: "🔥" }));

    expect(chosen).toEqual(["🔥"]);
  });

  test("renders no cells when the picker is closed", () => {
    render(
      <TooltipProvider>
        <TitleEmojiPicker
          open={false}
          onOpenChange={() => {}}
          onSelect={() => {}}
        />
      </TooltipProvider>,
    );

    expect(screen.queryByRole("gridcell")).toBeNull();
  });

  test("stays in the tab order so Tab reaches it from the title", () => {
    render(
      <TooltipProvider>
        <Controlled onSelect={() => {}} />
      </TooltipProvider>,
    );

    expect(
      screen.getByRole("button", { name: LABEL }).getAttribute("tabindex"),
    ).not.toBe("-1");
  });

  test("shows its tooltip on keyboard focus, not only on hover", async () => {
    render(
      <TooltipProvider>
        <Controlled onSelect={() => {}} />
      </TooltipProvider>,
    );

    const trigger = screen.getByRole("button", { name: LABEL });
    fireEvent.focus(trigger);

    await waitFor(() => expect(screen.getByRole("tooltip")).toBeDefined());
    expect(screen.getByRole("tooltip").textContent).toBe(LABEL);
  });

  test("hides its tooltip while the grid is open", () => {
    const { container } = renderOpen(() => {});

    const trigger = screen.getByRole("button", { name: LABEL });
    fireEvent.mouseEnter(trigger);
    fireEvent.pointerEnter(trigger);
    fireEvent.mouseOver(trigger);
    fireEvent.pointerOver(trigger);
    fireEvent.pointerMove(trigger);

    expect(
      container.ownerDocument.querySelector('[role="tooltip"]'),
    ).toBeNull();
  });

  test("writes the trigger icon in the foreground colour", () => {
    render(
      <TooltipProvider>
        <Controlled onSelect={() => {}} />
      </TooltipProvider>,
    );

    expect(screen.getByRole("button", { name: LABEL }).className).toContain(
      "text-foreground",
    );
  });
});
