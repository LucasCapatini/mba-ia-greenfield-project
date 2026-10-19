// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SectionHeader } from "../section-header";

describe("SectionHeader", () => {
  it("renders the title as an h2 and the muted description", () => {
    render(
      <SectionHeader
        title="Thumbnail"
        description="Select or upload a picture that shows what's in your video."
      />,
    );

    const heading = screen.getByRole("heading", { level: 2, name: "Thumbnail" });
    expect(heading).toHaveAttribute("data-slot", "section-header-title");
    expect(heading).toHaveClass("text-h2", "text-foreground");
    const description = screen.getByText(
      "Select or upload a picture that shows what's in your video.",
    );
    expect(description).toHaveClass("text-body-md", "text-muted-foreground");
    expect(heading.closest('[data-slot="section-header"]')).toContainElement(description);
  });

  it("omits the description element when none is given", () => {
    const { container } = render(<SectionHeader title="Category" />);
    expect(container.querySelector('[data-slot="section-header-description"]')).toBeNull();
  });

  it("propagates id to the heading and derives the description id", () => {
    render(
      <>
        <SectionHeader
          id="visibility-heading"
          title="Visibility"
          description="Choose when to publish and who can see your video"
        />
        <div
          role="radiogroup"
          aria-labelledby="visibility-heading"
          aria-describedby="visibility-heading-description"
        />
      </>,
    );

    expect(screen.getByRole("heading", { name: "Visibility" })).toHaveAttribute(
      "id",
      "visibility-heading",
    );
    const group = screen.getByRole("radiogroup", { name: "Visibility" });
    expect(group).toHaveAccessibleDescription("Choose when to publish and who can see your video");
  });

  it("leaves heading and description without ids when id is omitted", () => {
    render(<SectionHeader title="Category" description="Add your video to a category" />);

    expect(screen.getByRole("heading", { name: "Category" })).not.toHaveAttribute("id");
    expect(screen.getByText("Add your video to a category")).not.toHaveAttribute("id");
  });

  it("supports an h3 heading level and merges className", () => {
    const { container } = render(<SectionHeader as="h3" title="Details" className="mb-4" />);

    expect(screen.getByRole("heading", { level: 3, name: "Details" })).toBeInTheDocument();
    expect(container.querySelector('[data-slot="section-header"]')).toHaveClass("mb-4", "gap-1");
  });
});
