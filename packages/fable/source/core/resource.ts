import { Destroyable } from './primitives/destroyable.js'

/**
 * Represents reusable data that can be shared between objects.
 *
 * A resource is destroyed by its creator or by the owner to which it was transferred,
 * such as an importer. Objects using a shared resource borrow it and do not destroy it.
 */
export abstract class Resource extends Destroyable {}
