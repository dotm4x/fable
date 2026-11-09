import { GraphicMaterial } from '#/graphics/resources/material.js'
import { Shader, ShaderLanguage, ShaderStage } from '#/graphics/resources/shader.js'
import { type TextureBinding } from '#/graphics/resources/textures/binding.js'

const vertexSource = /* glsl */ `#version 300 es
precision highp float;

layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aTextureCoordinate;
layout(location = 2) in vec4 aColor;

uniform mat4 uViewProjection;
uniform mat4 uTransform;

out vec2 vTextureCoordinate;
out vec4 vColor;

void main() {
  gl_Position = uViewProjection * uTransform * vec4(aPosition, 0.0, 1.0);
  vTextureCoordinate = aTextureCoordinate;
  vColor = aColor;
}
`

const fragmentSource = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D uTextures[4];

in vec2 vTextureCoordinate;
in vec4 vColor;

out vec4 outColor;

void main() {
  outColor = texture(uTextures[0], vTextureCoordinate) * vColor;
}
`

/**
 * Creates the default material of the WebGL backend.
 *
 * Shaders declare `uViewProjection`, `uTransform` and `uTexture`, and read
 * position, texture coordinate and color from vertex locations 0, 1 and 2.
 *
 * @returns A GLSL material for the standard two-dimensional pipeline.
 */
export function createDraw2DMaterial(textures?: Iterable<TextureBinding>): GraphicMaterial {
  return new GraphicMaterial({
    vertexShader: new Shader({
      code: vertexSource,
      language: ShaderLanguage.glsl,
      stage: ShaderStage.vertex,
      entryPoint: 'main',
      path: 'fable://renderer/draw-2d.vert.glsl',
    }),
    fragmentShader: new Shader({
      code: fragmentSource,
      language: ShaderLanguage.glsl,
      stage: ShaderStage.fragment,
      entryPoint: 'main',
      path: 'fable://renderer/draw-2d.frag.glsl',
    }),
    ...(textures === undefined ? {} : { textures }),
  })
}
