import type { Diagnostics } from "../definitions/diagnostics";
import type { CardNote } from "../render/note";

/**
 * Where a deck's candidate notes come from. The vault answers this in the
 * plugin — its files under a folder, each parsed as a card note, with the
 * tags the metadata cache knows it by; a test answers from a fixture
 * folder. The deck pipeline asks nothing else of the outside world.
 */
export interface DeckSource {
  /**
   * Every card note under `folder` (`""` is the vault root), in path order;
   * with `recursive`, its subfolders too. A note without a `card-forge`
   * block is not a card note and is not listed. A note whose block cannot
   * be read is reported to `diagnostics` and not listed either.
   */
  listNotes(
    folder: string,
    recursive: boolean,
    diagnostics: Diagnostics
  ): Promise<TaggedNote[]>;
}

/** A card note as the vault lists it — with the tags the vault knows it by. */
export interface TaggedNote {
  note: CardNote;
  /** Frontmatter and inline tags, without the `#`. */
  tags: readonly string[];
}
