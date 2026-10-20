// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { CommentComposer } from "../comment-composer";

function renderComposer(props: Partial<ComponentProps<typeof CommentComposer>> = {}) {
  const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue(undefined);
  render(
    <CommentComposer isLoggedIn returnTo="/watch/tech-01" avatarName="Studio Canal" {...props} onSubmit={onSubmit} />,
  );
  return { onSubmit };
}

describe("CommentComposer", () => {
  it("shows Cancel/Comment only after the field gets focus", async () => {
    const user = userEvent.setup();
    renderComposer();

    expect(screen.queryByRole("button", { name: "Comment" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("textbox", { name: "Add a comment" }));

    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Comment" })).toBeDisabled();
  });

  it("keeps Comment disabled for blank text and for more than 2000 characters", async () => {
    const user = userEvent.setup();
    renderComposer();
    const field = screen.getByRole("textbox", { name: "Add a comment" });

    await user.type(field, "   ");
    expect(screen.getByRole("button", { name: "Comment" })).toBeDisabled();

    await user.clear(field);
    await user.click(field);
    await user.paste("a".repeat(2001));
    await waitFor(() => expect(screen.getByRole("button", { name: "Comment" })).toBeDisabled());
    expect(screen.getByText("Comments can have at most 2000 characters")).toBeInTheDocument();

    await user.clear(field);
    await user.click(field);
    await user.paste("a".repeat(2000));
    await waitFor(() => expect(screen.getByRole("button", { name: "Comment" })).toBeEnabled());
  });

  it("submits the trimmed text, then clears and collapses", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderComposer();
    const field = screen.getByRole("textbox", { name: "Add a comment" });

    await user.type(field, "  Ótimo conteúdo  ");
    await user.click(screen.getByRole("button", { name: "Comment" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledExactlyOnceWith("Ótimo conteúdo"));
    await waitFor(() => expect(field).toHaveValue(""));
    expect(screen.queryByRole("button", { name: "Comment" })).not.toBeInTheDocument();
  });

  it("shows the error thrown by onSubmit under the field and keeps the text", async () => {
    const user = userEvent.setup();
    renderComposer({ onSubmit: vi.fn().mockRejectedValue(new Error("This video is no longer available")) });
    const field = screen.getByRole("textbox", { name: "Add a comment" });

    await user.type(field, "Olá");
    await user.click(screen.getByRole("button", { name: "Comment" }));

    expect(await screen.findByText("This video is no longer available")).toBeInTheDocument();
    expect(field).toHaveValue("Olá");
    expect(field).toHaveAttribute("aria-invalid", "true");
  });

  it("Cancel restores the initial value, collapses and notifies the parent", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderComposer({ initialValue: "@bia ", onCancel, label: "Reply", submitLabel: "Reply" });
    const field = screen.getByRole("textbox", { name: "Reply" });

    expect(field).toHaveValue("@bia ");
    await user.type(field, "obrigado");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(field).toHaveValue("@bia ");
    expect(onCancel).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("opens expanded and submittable when startExpanded is set with a pre-filled text (edit)", async () => {
    renderComposer({ startExpanded: true, initialValue: "Texto antigo", submitLabel: "Save" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
  });

  it("renders the sign-in link for anonymous visitors", () => {
    render(<CommentComposer isLoggedIn={false} returnTo="/watch/tech-01" onSubmit={vi.fn()} />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in to comment" })).toHaveAttribute(
      "href",
      "/login?returnTo=/watch/tech-01",
    );
  });
});
