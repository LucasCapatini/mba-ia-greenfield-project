// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CommentItem, type CommentItemData } from "../comment-item";

const now = new Date("2026-10-20T12:00:00Z");

const comment: CommentItemData = {
  id: "c-1",
  text: "Primeira linha\nSegunda linha",
  author: { nickname: "devstudent99", name: "Dev Student" },
  created_at: "2026-10-06T12:00:00Z",
  edited_at: null,
};

describe("CommentItem", () => {
  it("shows the author handle linking to the channel, the relative time and the text", () => {
    render(<CommentItem comment={comment} now={now} />);

    expect(screen.getByRole("link", { name: "@devstudent99" })).toHaveAttribute(
      "href",
      "/channel/devstudent99",
    );
    expect(screen.getByRole("img", { name: "Dev Student" })).toBeInTheDocument();
    expect(screen.getByText("2 weeks ago")).toBeInTheDocument();
    expect(screen.getByText(/Primeira linha/)).toHaveTextContent("Primeira linha Segunda linha");
    expect(screen.getByRole("article", { name: "@devstudent99" })).toBeInTheDocument();
  });

  it("marks the comment as edited only when edited_at is set", () => {
    const { rerender } = render(<CommentItem comment={comment} now={now} />);
    expect(screen.queryByText("(edited)")).not.toBeInTheDocument();

    rerender(<CommentItem comment={{ ...comment, edited_at: "2026-10-07T12:00:00Z" }} now={now} />);
    expect(screen.getByText("(edited)")).toBeInTheDocument();
  });

  it("renders the reaction, reply, menu and replies slots", () => {
    render(
      <CommentItem
        comment={comment}
        now={now}
        reactions={<button type="button">Like</button>}
        replyAction={<button type="button">Reply</button>}
        actionsMenu={<button type="button">Comment actions</button>}
        replies={<div>2 replies</div>}
      />,
    );

    expect(screen.getByRole("button", { name: "Like" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reply" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Comment actions" })).toBeInTheDocument();
    expect(screen.getByText("2 replies")).toBeInTheDocument();
  });

  it("replaces the text with the editor while editing", () => {
    render(<CommentItem comment={comment} now={now} editor={<textarea aria-label="Edit comment" />} />);

    expect(screen.getByRole("textbox", { name: "Edit comment" })).toBeInTheDocument();
    expect(screen.queryByText(/Primeira linha/)).not.toBeInTheDocument();
  });
});
