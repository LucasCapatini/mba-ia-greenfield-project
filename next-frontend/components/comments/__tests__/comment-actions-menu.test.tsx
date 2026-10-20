// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CommentActionsMenu } from "../comment-actions-menu";

describe("CommentActionsMenu", () => {
  it("renders nothing when the viewer is not the author", () => {
    const { container } = render(
      <CommentActionsMenu viewerIsAuthor={false} onEdit={vi.fn()} onDelete={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("offers Edit and Delete behind an icon-only trigger", async () => {
    const user = userEvent.setup();
    render(<CommentActionsMenu viewerIsAuthor onEdit={vi.fn()} onDelete={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Comment actions" }));

    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
  });

  it("Edit calls onEdit", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<CommentActionsMenu viewerIsAuthor onEdit={onEdit} onDelete={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Comment actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));

    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("Delete only calls onDelete after the confirmation", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<CommentActionsMenu viewerIsAuthor onEdit={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: "Comment actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    const dialog = await screen.findByRole("dialog", { name: "Delete comment?" });
    expect(dialog).toHaveTextContent("This comment will be permanently deleted.");
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("Cancel closes the confirmation without deleting", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<CommentActionsMenu viewerIsAuthor onEdit={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: "Comment actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("warns that the replies go too when the comment has replies", async () => {
    const user = userEvent.setup();
    render(<CommentActionsMenu viewerIsAuthor replyCount={2} onEdit={vi.fn()} onDelete={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Comment actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "This comment and its 2 replies will be permanently deleted.",
    );
  });

  it("keeps the dialog open when the deletion fails", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockRejectedValue(new Error("boom"));
    render(<CommentActionsMenu viewerIsAuthor onEdit={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: "Comment actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
