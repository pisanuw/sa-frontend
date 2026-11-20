// @vitest-environment jsdom
// The player announces its state once: the button label stays "Play sonification", "Playing…"
// is a polite status for as long as the sound plays, and failures are alerts.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../sonification/erieClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../sonification/erieClient")>()),
  playSonificationWithErie: vi.fn(),
}));
vi.mock("erie-web", () => ({}));

import { playSonificationWithErie } from "../../sonification/erieClient";
import { SonificationPlayer } from "./SonificationPlayer";

const dataset = { columns: ["v"], rows: [{ v: 1 }, { v: 3 }] };
const config = { preset: "line" as const, valueColumn: "v" };

afterEach(() => {
  cleanup();
  vi.mocked(playSonificationWithErie).mockReset();
});

describe("SonificationPlayer", () => {
  it("says 'Playing…' once, until playback ends, and keeps focus on the button", async () => {
    let finish!: () => void;
    vi.mocked(playSonificationWithErie).mockReturnValue(new Promise<void>((r) => (finish = r)));
    const user = userEvent.setup();
    render(<SonificationPlayer dataset={dataset} config={config} />);

    const button = screen.getByRole("button", { name: "Play sonification" });
    await user.click(button);
    expect(screen.getByRole("status").textContent).toBe("Playing…");
    expect(button.textContent).toBe("Play sonification");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(document.activeElement).toBe(button);

    await user.click(button); // ignored while playing
    expect(playSonificationWithErie).toHaveBeenCalledTimes(1);

    finish();
    await vi.waitFor(() => expect(screen.getByRole("status").textContent).toBe(""));
    expect(button.getAttribute("aria-disabled")).toBeNull();
  });

  it("puts a playback failure in an alert", async () => {
    vi.mocked(playSonificationWithErie).mockRejectedValue(new Error("no audio"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<SonificationPlayer dataset={dataset} config={config} />);

    await user.click(screen.getByRole("button", { name: "Play sonification" }));
    expect(await screen.findByText("Something went wrong while playing audio.")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Something went wrong while playing audio.");
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("shows the written description", () => {
    render(<SonificationPlayer dataset={dataset} config={config} />);
    expect(screen.getByRole("heading", { name: "What you will hear" })).toBeTruthy();
    expect(screen.getByText(/Then you will hear 2 short notes/)).toBeTruthy();
  });
});
