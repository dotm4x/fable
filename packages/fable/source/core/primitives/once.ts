/** Ensures that an operation executes at most once. */
export class Once {
  private _executed: boolean = false
  private _executing: boolean = false
  private _failed: boolean = false

  /**
   * @param errorMessage - Message used when the operation is already executing or has failed.
   */
  public constructor(
    private readonly _errorMessage: string = 'The operation has already started or failed.',
  ) {}

  /**
   * Executes the operation once. A failed operation cannot be retried.
   *
   * @param operation - The synchronous operation to execute.
   * @throws {@link Error} If the operation is already executing or has failed.
   */
  public execute(operation: () => void): void {
    if (this._executed) {
      return
    }
    if (this._executing || this._failed) {
      throw new Error(this._errorMessage)
    }

    this._executing = true
    try {
      operation()
      this._executed = true
    } catch (error) {
      this._failed = true
      throw error
    } finally {
      this._executing = false
    }
  }
}
