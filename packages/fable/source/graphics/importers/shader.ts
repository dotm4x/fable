import { fetchSource } from '#/modules/assets/helpers/fetch.js'
import { AssetImporter, type ImportedAsset } from '#/modules/assets/importer.js'

import { ShaderSource } from '../resources/shader-source.js'
import { ShaderLanguage } from '../resources/shader.js'

const languageByExtension: ReadonlyMap<string, ShaderLanguage> = new Map([
  ['.wgsl', ShaderLanguage.wgsl],
  ['.glsl', ShaderLanguage.glsl],
  ['.vert', ShaderLanguage.glsl],
  ['.frag', ShaderLanguage.glsl],
])

/**
 * Loads shader source code from WGSL and GLSL files.
 *
 * The language is derived from the extension: `.wgsl` for WebGPU and `.glsl`,
 * `.vert` or `.frag` for OpenGL. The imported value keeps the source and the
 * language; the stage and entry point are chosen when building a material.
 */
export class ShaderImporter extends AssetImporter<ShaderSource> {
  public constructor() {
    super({ identifier: 'shader', extensions: languageByExtension.keys() })
  }

  /** @inheritDoc */
  public override async load(
    source: string,
    signal: AbortSignal,
  ): Promise<ImportedAsset<ShaderSource>> {
    const language = languageOf(source)
    if (language === undefined) {
      throw new Error(`Unsupported shader source '${source}'.`)
    }

    const response = await fetchSource(source, signal)
    const shaderSource = new ShaderSource({
      code: await response.text(),
      language,
      path: source,
    })

    return {
      value: shaderSource,
      release: () => {
        shaderSource.destroy()
      },
    }
  }
}

function languageOf(source: string): ShaderLanguage | undefined {
  const query = source.search(/[?#]/)
  const path = query === -1 ? source : source.slice(0, query)
  const dot = path.lastIndexOf('.')

  return dot === -1 ? undefined : languageByExtension.get(path.slice(dot).toLowerCase())
}
