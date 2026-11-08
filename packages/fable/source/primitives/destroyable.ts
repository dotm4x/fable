/**
 * Provides read-only access to the lifecycle state of a destroyable object.
 */
export interface ReadOnlyDestroyable {
  /** Whether the object has been destroyed. */
  readonly destroyed: boolean;
}

/**
 * Describes an object that can be destroyed.
 */
export interface DestroyableLifecycle extends ReadOnlyDestroyable {
  /**
   * Destroys the object and transitions it to the destroyed state.
   *
   * @throws {@link Error} If the object has already been destroyed.
   */
  destroy(): void;
}

/**
 * Provides a base implementation for objects with a destroyable lifecycle.
 *
 * A destroyable object can be destroyed when it is no longer needed. Once
 * destroyed, it must not be used for further operations.
 */
export abstract class Destroyable implements DestroyableLifecycle {
  private destroyedState: boolean = false;

  /** @inheritDoc */
  public get destroyed(): boolean {
    return this.destroyedState;
  }

  /**
   * Destroys this object.
   *
   * The {@link onDestroy} hook is invoked before the object is marked as
   * destroyed. If the hook throws, the object remains undestroyed.
   *
   * @throws {@link Error} If this object has already been destroyed.
   */
  public destroy(): void {
    if (this.destroyed) {
      throw new Error(`${this.constructor.name} has already been destroyed.`);
    }

    this.onDestroy();
    this.destroyedState = true;
  }

  /**
   * Performs additional cleanup when the object is destroyed.
   *
   * Derived types can override this method to release resources or perform
   * other cleanup operations required by the object.
   */
  protected onDestroy(): void {
    // Override in derived classes when cleanup is required.
  }

  /**
   * Throws an exception if this object has already been destroyed.
   *
   * @throws {@link Error} If this object has been destroyed.
   */
  protected throwIfDestroyed(): void {
    if (this.destroyed) {
      throw new Error(`${this.constructor.name} is destroyed.`);
    }
  }
}
