import { GraphicMaterial } from '#/graphics/resources/material.js'
import { Shader, ShaderLanguage, ShaderStage } from '#/graphics/resources/shader.js'
import { type TextureBinding } from '#/graphics/resources/textures/binding.js'

const source = /* wgsl */ `
struct Uniforms {
  viewProjection: mat4x4<f32>,
  transform: mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(1) @binding(0) var image0: texture_2d<f32>;
@group(1) @binding(1) var image1: texture_2d<f32>;
@group(1) @binding(2) var image2: texture_2d<f32>;
@group(1) @binding(3) var image3: texture_2d<f32>;
@group(1) @binding(4) var sampler0: sampler;
@group(1) @binding(5) var sampler1: sampler;
@group(1) @binding(6) var sampler2: sampler;
@group(1) @binding(7) var sampler3: sampler;

struct VertexInput {
  @location(0) position: vec2<f32>,
  @location(1) textureCoordinate: vec2<f32>,
  @location(2) color: vec4<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) textureCoordinate: vec2<f32>,
  @location(1) color: vec4<f32>,
};

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let transform = uniforms.transform * vec4<f32>(input.position, 0.0, 1.0);
  output.position = uniforms.viewProjection * transform;
  output.textureCoordinate = input.textureCoordinate;
  output.color = input.color;
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  return textureSample(image0, sampler0, input.textureCoordinate) * input.color;
}
`

/**
 * Creates the default material of the WebGPU backend.
 *
 * Shaders declare a `uniforms` block in bind group 0 and sample the texture
 * from bind group 1, reading position, texture coordinate and color from
 * vertex locations 0, 1 and 2.
 *
 * @returns A WGSL material for the standard two-dimensional pipeline.
 */
export function createDraw2DMaterial(textures?: Iterable<TextureBinding>): GraphicMaterial {
  return new GraphicMaterial({
    vertexShader: new Shader({
      code: source,
      language: ShaderLanguage.wgsl,
      stage: ShaderStage.vertex,
      entryPoint: 'vertexMain',
      path: 'fable://renderer/draw-2d.wgsl',
    }),
    fragmentShader: new Shader({
      code: source,
      language: ShaderLanguage.wgsl,
      stage: ShaderStage.fragment,
      entryPoint: 'fragmentMain',
      path: 'fable://renderer/draw-2d.wgsl',
    }),
    ...(textures === undefined ? {} : { textures }),
  })
}
