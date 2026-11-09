/**
 * An object identified by a value that remains stable while it is indexed.
 *
 * @typeParam TIdentifier - The type of the identifier.
 */
export interface Identifiable<TIdentifier> {
  /** The unique identifier of this object. */
  readonly identifier: TIdentifier
}
