/** Command ordering applied by a rendering space. */
export enum RenderSortMode {
  /** Draws commands in collection order, grouping commands that share a material. */
  order = 'order',
  /** Draws commands from the farthest depth to the nearest, then by order. */
  depth = 'depth',
}
