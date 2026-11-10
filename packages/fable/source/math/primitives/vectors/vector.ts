/**
 * Describes the common operations available on a vector.
 *
 * @typeParam TVector - The concrete vector type returned by operations.
 */
export interface Vector<TVector> {
  /** The number of components in the vector. */
  readonly dimension: number

  /**
   * Returns the component-wise sum of this vector and another vector.
   *
   * @param other - The vector to add.
   * @returns A new vector containing the sum.
   * @throws {@link RangeError} If the vectors have different dimensions.
   */
  add(other: TVector): TVector

  /**
   * Returns the component-wise difference of another vector from this vector.
   *
   * @param other - The vector to subtract.
   * @returns A new vector containing the difference.
   * @throws {@link RangeError} If the vectors have different dimensions.
   */
  subtract(other: TVector): TVector

  /**
   * Returns the component-wise product of this vector and another vector.
   *
   * @param other - The vector to multiply by.
   * @returns A new vector containing the product.
   * @throws {@link RangeError} If the vectors have different dimensions.
   */
  multiply(other: TVector): TVector

  /**
   * Returns the component-wise quotient of this vector and another vector.
   *
   * Division follows JavaScript number semantics, so a zero divisor can
   * produce `Infinity` or `NaN`.
   *
   * @param other - The vector whose components are the divisors.
   * @returns A new vector containing the quotient.
   * @throws {@link RangeError} If the vectors have different dimensions.
   */
  divide(other: TVector): TVector

  /**
   * Returns this vector multiplied by a scalar.
   *
   * @param scalar - The scalar to multiply each component by.
   * @returns A new vector containing the scaled components.
   */
  scale(scalar: number): TVector

  /**
   * Returns the dot product of this vector and another vector.
   *
   * @param other - The vector to use in the dot product.
   * @returns The sum of the products of corresponding components.
   * @throws {@link RangeError} If the vectors have different dimensions.
   */
  dot(other: TVector): number

  /** The Euclidean length of the vector. */
  readonly magnitude: number

  /** The squared Euclidean length of the vector. */
  readonly squaredMagnitude: number

  /**
   * Returns a unit-length vector in the same direction.
   *
   * A zero vector is returned unchanged.
   *
   * @returns A new normalized vector.
   */
  normalize(): TVector

  /**
   * Returns the Euclidean distance to another vector.
   *
   * @param other - The vector to measure to.
   * @returns The distance between the vectors.
   * @throws {@link RangeError} If the vectors have different dimensions.
   */
  distanceTo(other: TVector): number

  /**
   * Checks whether this vector is component-wise equal to another vector
   * within a tolerance.
   *
   * @param other - The vector to compare with.
   * @param tolerance - The maximum allowed absolute difference per component.
   * @returns Whether the vectors have the same dimension and their components
   * differ by no more than the tolerance.
   * @throws {@link RangeError} If the tolerance is negative or not finite.
   */
  equals(other: TVector, tolerance?: number): boolean

  /**
   * Returns the vector components in coordinate order.
   *
   * @returns A new array containing the vector components.
   */
  toArray(): readonly number[]
}

/**
 * Provides immutable, dimension-independent vector operations.
 *
 * Concrete vectors supply their components and a factory that creates a
 * vector of their own type.
 *
 * @typeParam TVector - The concrete vector type returned by operations.
 */
export abstract class BaseVector<TVector extends Vector<TVector>> implements Vector<TVector> {
  /** The components in coordinate order. */
  protected abstract get components(): readonly number[]

  /** @inheritDoc */
  public get dimension(): number {
    return this.components.length
  }

  /** @inheritDoc */
  public get magnitude(): number {
    return Math.sqrt(this.squaredMagnitude)
  }

  /** @inheritDoc */
  public get squaredMagnitude(): number {
    return this.components.reduce((sum, component) => sum + component * component, 0)
  }

  /** @inheritDoc */
  public add(other: TVector): TVector {
    return this.combine(other, (left, right) => left + right)
  }

  /** @inheritDoc */
  public subtract(other: TVector): TVector {
    return this.combine(other, (left, right) => left - right)
  }

  /** @inheritDoc */
  public multiply(other: TVector): TVector {
    return this.combine(other, (left, right) => left * right)
  }

  /** @inheritDoc */
  public divide(other: TVector): TVector {
    return this.combine(other, (left, right) => left / right)
  }

  /** @inheritDoc */
  public scale(scalar: number): TVector {
    return this.create(this.components.map((component) => component * scalar))
  }

  /** @inheritDoc */
  public dot(other: TVector): number {
    return this.combineComponents(other, (left, right) => left * right).reduce(
      (sum, product) => sum + product,
      0,
    )
  }

  /** @inheritDoc */
  public normalize(): TVector {
    const magnitude = this.magnitude
    return magnitude === 0 ? this.create(this.components) : this.scale(1 / magnitude)
  }

  /** @inheritDoc */
  public distanceTo(other: TVector): number {
    return Math.sqrt(
      this.combineComponents(other, (left, right) => (left - right) ** 2).reduce(
        (sum, squaredDifference) => sum + squaredDifference,
        0,
      ),
    )
  }

  /** @inheritDoc */
  public equals(other: TVector, tolerance = 1e-10): boolean {
    if (!Number.isFinite(tolerance) || tolerance < 0) {
      throw new RangeError('Tolerance must be a finite, non-negative number.')
    }

    const components = this.components
    const otherComponents = other.toArray()
    return (
      components.length === otherComponents.length &&
      components.every((component, index) => {
        const otherComponent = this.componentAt(otherComponents, index)
        return component === otherComponent || Math.abs(component - otherComponent) <= tolerance
      })
    )
  }

  /** @inheritDoc */
  public toArray(): readonly number[] {
    return [...this.components]
  }

  /**
   * Creates a vector of the concrete type from coordinate-ordered components.
   *
   * @param components - The components for the new vector.
   * @returns A new vector of the concrete type.
   */
  protected abstract create(components: readonly number[]): TVector

  /**
   * Reads a component from an array and reports a dimension mismatch.
   *
   * @param components - The vector components.
   * @param index - The component index to read.
   * @returns The component at the requested index.
   * @throws {@link RangeError} If the component is missing.
   */
  protected componentAt(components: readonly number[], index: number): number {
    const component = components[index]
    if (component === undefined) {
      throw new RangeError(`Missing vector component at index ${String(index)}.`)
    }

    return component
  }

  private combine(other: TVector, operation: (left: number, right: number) => number): TVector {
    return this.create(this.combineComponents(other, operation))
  }

  private combineComponents(
    other: TVector,
    operation: (left: number, right: number) => number,
  ): number[] {
    const components = this.components
    const otherComponents = other.toArray()
    if (components.length !== otherComponents.length) {
      throw new RangeError('Vectors must have the same dimension.')
    }

    return components.map((component, index) =>
      operation(component, this.componentAt(otherComponents, index)),
    )
  }
}
