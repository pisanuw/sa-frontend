// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import axe from "axe-core";
import SlideDeckUploadPage from "./SlideDeckUploadPage";
import SlideDeckResultsPage from "./SlideDeckResultsPage";
import { apiFetch, apiUpload } from "../lib/api";
import type { DeckResult } from "../services/slideDecks";

vi.mock("../lib/api", () => ({ apiFetch: vi.fn(), apiUpload: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);
const uploadMock = vi.mocked(apiUpload);

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/decks/new" element={<SlideDeckUploadPage />} />
        <Route path="/decks/:deckId" element={<SlideDeckResultsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const result: DeckResult = {
  id: "deck",
  filename: "lecture.pdf",
  page_count: 2,
  job_status: "done",
  error: null,
  pages: [
    { status: "done", count: 1 },
    { status: "done", count: 0 },
  ],
  items: [
    {
      id: "item",
      title: "Example",
      kind: "flowchart",
      page_number: 1,
      position: 1,
      status: "awaiting_description",
      error: null,
      public_path: null,
      flowchart_id: "graph",
      graph: {
        nodes: [
          {
            id: "a",
            label: "Start",
            shape: "rectangle",
            coordinates: [
              [0, 0],
              [100, 50],
            ],
          },
        ],
        edges: [],
      },
    },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(cleanup);

describe("slide deck screens", () => {
  it("validates and uploads a PDF, then navigates to results", async () => {
    fetchMock.mockImplementation(async (path) =>
      path === "/decks" ? [] : { ...result, items: [] },
    );
    uploadMock.mockResolvedValue({ id: "deck" });
    renderPage("/decks/new");
    fireEvent.click(screen.getByRole("button", { name: "Extract diagrams" }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Choose a PDF slide deck.",
    );
    fireEvent.change(screen.getByLabelText("PDF slide deck"), {
      target: {
        files: [
          new File(["%PDF-example"], "lecture.pdf", {
            type: "application/pdf",
          }),
        ],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Extract diagrams" }));
    await screen.findByRole("heading", { name: "lecture.pdf" });
    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(uploadMock.mock.calls[0][1].get("file")).toBeInstanceOf(File);
  });

  it("finalizes descriptions once and exposes links only after saving", async () => {
    let saved = false;
    fetchMock.mockImplementation(async (path, options) => {
      if (path.endsWith("/image"))
        return { image_data_url: "data:image/png;base64,eA==" };
      if (path.endsWith("/finalize")) {
        saved = true;
        expect(options?.json?.summary).toContain("## Structure");
        return { ok: true };
      }
      return saved
        ? {
            ...result,
            items: [
              {
                ...result.items[0],
                status: "ready",
                graph: null,
                public_path: "/p/abc",
              },
            ],
          }
        : result;
    });
    renderPage("/decks/deck");
    const link = await screen.findByRole("link", {
      name: "Open description (new tab)",
    });
    expect(link.getAttribute("href")).toBe("/p/abc");
    expect(screen.getByText("No diagrams detected.")).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(([path]) => path.endsWith("/finalize")),
    ).toHaveLength(1);
  });

  it("shows network errors with a reload action instead of an endless spinner", async () => {
    fetchMock.mockRejectedValue(new Error("Server unavailable"));
    renderPage("/decks/deck");
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("Server unavailable"),
    );
    expect(screen.getByRole("button", { name: "Reload results" })).toBeTruthy();
  });

  it("has labelled controls and no detectable accessibility violations on upload", async () => {
    fetchMock.mockResolvedValue([]);
    const { container } = renderPage("/decks/new");
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const report = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(report.violations).toEqual([]);
  });
});
