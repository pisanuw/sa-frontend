// @vitest-environment jsdom
// The image branch of /create (stem-accessibility/frontend#4): which pictures can be chosen, what
// the page says about the rest, and the server's reason when it refuses one.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("../lib/api", () => ({ apiFetch: vi.fn(), apiUpload: vi.fn(), publicFetch: vi.fn() }));
vi.mock("../lib/logResearchEvent", () => ({ logResearchEvent: vi.fn() }));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: { email: "a@example.org" } }) }));

import { apiUpload } from "../lib/api";
import CreatePage from "./CreatePage";
import { imageFileProblem, uploadRefusalMessage } from "../lib/imageUpload";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const file = (name: string, type: string, size = 64) => new File([new Uint8Array(size)], name, { type });

async function openUpload() {
  const user = userEvent.setup({ applyAccept: false });
  render(
    <MemoryRouter initialEntries={["/create"]}>
      <Routes>
        <Route path="/create" element={<CreatePage />} />
      </Routes>
    </MemoryRouter>
  );
  await user.type(screen.getByLabelText("Name"), "Course registration");
  await user.click(screen.getByRole("button", { name: "Upload image" }));
  return user;
}

const createButton = () => screen.getByRole("button", { name: "Create from image" }) as HTMLButtonElement;

describe("/create: upload an image", () => {
  it("says which pictures work and accepts a PNG", async () => {
    const user = await openUpload();
    const input = screen.getByLabelText("Image file");
    expect(input.getAttribute("accept")).toContain("image/png");
    expect(screen.getByText(/PNG, JPEG, WebP, GIF, BMP or TIFF, up to 8 MB/).id).toBe(
      input.getAttribute("aria-describedby")
    );
    await user.upload(input, file("flowchart.png", "image/png"));
    expect(screen.getByText("flowchart.png")).toBeTruthy();
    expect(createButton().disabled).toBe(false);
  });

  it("refuses an SVG or a HEIC photo with what to do instead, and keeps Create off", async () => {
    const user = await openUpload();
    await user.upload(screen.getByLabelText("Image file"), file("diagram.svg", "image/svg+xml"));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Export the diagram as a PNG/);
    expect(createButton().disabled).toBe(true);

    await user.upload(screen.getByLabelText("Image file"), file("IMG_0042.HEIC", ""));
    expect(screen.getByRole("alert").textContent).toMatch(/HEIC photo/);
    expect(createButton().disabled).toBe(true);
  });

  it("shows the server's reason when it refuses the file", async () => {
    vi.mocked(apiUpload).mockRejectedValue(
      new Error("400 BAD REQUEST: This file is not a picture that can be read. Upload a PNG, JPEG, WebP, GIF, BMP or TIFF image.")
    );
    const user = await openUpload();
    await user.upload(screen.getByLabelText("Image file"), file("flowchart.png", "image/png"));
    await user.click(createButton());
    expect(await screen.findByText(/This file is not a picture that can be read/)).toBeTruthy();
    expect(screen.queryByText(/Please try again/)).toBeNull();
  });
});

describe("imageFileProblem", () => {
  it("accepts the formats the server reads, by type or by extension", () => {
    for (const [name, type] of [
      ["a.png", "image/png"],
      ["b.jpg", "image/jpeg"],
      ["c.webp", "image/webp"],
      ["d.gif", "image/gif"],
      ["e.bmp", "image/bmp"],
      ["f.TIF", ""],
    ]) {
      expect(imageFileProblem(file(name, type))).toBeNull();
    }
  });

  it("names the file and the fix for everything else", () => {
    expect(imageFileProblem(file("notes.pdf", "application/pdf"))).toMatch(/notes\.pdf is not a picture/);
    expect(imageFileProblem(file("empty.png", "image/png", 0))).toMatch(/empty/);
    expect(imageFileProblem(file("huge.png", "image/png", 9 * 1024 * 1024))).toMatch(/9\.0 MB; the limit is 8 MB/);
  });
});

describe("uploadRefusalMessage", () => {
  it("passes on the upload route's 400 and 413 messages and nothing else", () => {
    expect(uploadRefusalMessage(new Error("413 REQUEST ENTITY TOO LARGE: The picture is larger than 8 MB."))).toBe(
      "The picture is larger than 8 MB."
    );
    expect(uploadRefusalMessage(new Error("500 INTERNAL SERVER ERROR: Traceback …"))).toBeNull();
    expect(uploadRefusalMessage(new Error("LLM call failed after 3 attempts"))).toBeNull();
  });
});
