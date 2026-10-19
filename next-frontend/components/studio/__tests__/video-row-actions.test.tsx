// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { VideoRowActions } from "../video-row-actions";

type Props = ComponentProps<typeof VideoRowActions>;

function setup(overrides: Partial<Props> = {}) {
  const props: Props = {
    publicId: "ready-draft-01",
    title: "My Awesome Tech Review",
    status: "draft",
    processingStatus: "ready",
    onPublish: vi.fn(),
    onUnpublish: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  const user = userEvent.setup();
  render(<VideoRowActions {...props} />);
  return { user, props };
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Video actions" }));
  return screen.getByRole("menu");
}

describe("VideoRowActions — baseline", () => {
  it("renders an icon-only kebab with a menu popup", () => {
    setup();

    const trigger = screen.getByRole("button", { name: "Video actions" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("links Edit to the video edit page", async () => {
    const { user } = setup();
    await openMenu(user);

    expect(screen.getByRole("menuitem", { name: "Edit" })).toHaveAttribute(
      "href",
      "/studio/videos/ready-draft-01/edit",
    );
  });

  it("accepts a custom edit href", async () => {
    const { user } = setup({ editHref: "/custom" });
    await openMenu(user);
    expect(screen.getByRole("menuitem", { name: "Edit" })).toHaveAttribute("href", "/custom");
  });
});

describe("VideoRowActions — publish / unpublish", () => {
  it("offers Publish for a ready draft and calls onPublish", async () => {
    const { user, props } = setup({ status: "draft", processingStatus: "ready" });
    await openMenu(user);

    expect(screen.queryByRole("menuitem", { name: "Unpublish" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Publish" }));

    expect(props.onPublish).toHaveBeenCalledTimes(1);
    expect(props.onUnpublish).not.toHaveBeenCalled();
  });

  it("offers Unpublish for a published video and calls onUnpublish", async () => {
    const { user, props } = setup({ status: "published" });
    await openMenu(user);

    expect(screen.queryByRole("menuitem", { name: /^Publish/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Unpublish" }));

    expect(props.onUnpublish).toHaveBeenCalledTimes(1);
  });

  it.each(["uploading", "processing", "failed"] as const)(
    "disables Publish while processing_status is %s",
    async (processingStatus) => {
      const { user, props } = setup({ status: "draft", processingStatus });
      await openMenu(user);

      const item = screen.getByRole("menuitem", { name: /Publish \(available/ });
      expect(item).toHaveAttribute("aria-disabled", "true");
      await user.click(item);
      expect(props.onPublish).not.toHaveBeenCalled();
    },
  );

  it("disables the kebab while a mutation is pending", async () => {
    let resolve!: () => void;
    const onPublish = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const { user } = setup({ onPublish });
    await openMenu(user);

    await user.click(screen.getByRole("menuitem", { name: "Publish" }));
    const trigger = screen.getByRole("button", { name: "Video actions" });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute("aria-busy", "true");

    resolve();
    await waitFor(() => expect(trigger).toBeEnabled());
  });
});

describe("VideoRowActions — delete confirmation", () => {
  it("opens the confirmation dialog before calling onDelete", async () => {
    const { user, props } = setup();
    await openMenu(user);

    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    const dialog = screen.getByRole("dialog", { name: "Delete video?" });
    expect(dialog).toHaveAccessibleDescription(
      "“My Awesome Tech Review” and its files will be permanently deleted. This can’t be undone.",
    );
    expect(props.onDelete).not.toHaveBeenCalled();
  });

  it("does not call onDelete when cancelled", async () => {
    const { user, props } = setup();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(props.onDelete).not.toHaveBeenCalled();
  });

  it("calls onDelete on confirm and closes the dialog", async () => {
    const { user, props } = setup();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(props.onDelete).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps the dialog open and re-enables it when onDelete fails", async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error("STORAGE_UNAVAILABLE"));
    const { user } = setup({ onDelete });
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows a busy confirm button while deleting", async () => {
    let resolve!: () => void;
    const onDelete = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const { user } = setup({ onDelete });
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    await user.click(screen.getByRole("button", { name: "Delete" }));

    const busy = screen.getByRole("button", { name: "Deleting…" });
    expect(busy).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    resolve();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
