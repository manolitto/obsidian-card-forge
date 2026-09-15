import { describe, expect, it } from "vitest";
import { collectImageLinks, resolveImages, type ImageSource } from "../src/render/images";

describe("collectImageLinks", () => {
  it("collects wikilinks, embeds and bare paths that end in an image extension", () => {
    expect(
      collectImageLinks({
        image: "[[Beil.png|the axe]]",
        body: "Text with ![[Troll.webp]] and [[Rules]] and ![[Troll.webp]].",
        logo: "assets/logo.svg",
        reference: "[[Rules.pdf#page=3|p. 3]]",
        prose: "See Beil.png in the folder",
        n: 3,
      })
    ).toEqual(["Beil.png", "Troll.webp", "assets/logo.svg"]);
  });

  it("walks lists and mappings", () => {
    expect(
      collectImageLinks({ traits: [{ name: "a", desc: "![[a.jpg]]" }, "[[b.gif]]"] })
    ).toEqual(["a.jpg", "b.gif"]);
  });
});

describe("resolveImages", () => {
  it("holds what the source answered and nothing else, each link resolved once", async () => {
    const asked: string[] = [];
    const source: ImageSource = {
      async resolve(link, from) {
        asked.push(`${from}:${link}`);
        return link === "Beil.png" ? "data:image/png;base64,QQ==" : undefined;
      },
    };
    const map = await resolveImages(
      ["Beil.png", "Nope.png", "Beil.png"],
      source,
      "Karten/Beil.md"
    );
    expect([...map]).toEqual([["Beil.png", "data:image/png;base64,QQ=="]]);
    expect(asked.sort()).toEqual(["Karten/Beil.md:Beil.png", "Karten/Beil.md:Nope.png"]);
  });
});
