import { supabase } from './supabase';

export interface ProductVisionResult {
  productName: string;
  productCategory: string;
  visualFeatures: string[];
  marketingPoints: string[];
  textureDescription: string;
  colorPalette: string[];
  shapeDescription: string;
  materialGuess: string;
  keyAngles: { angle: string; description: string }[];
  orbitalFocusPoint: string;
  parallaxDepthLayers: string[];
  suggestedCopyLayers: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
}

export async function analyzeProductVision(
  images: string[],
  productName?: string,
): Promise<ProductVisionResult> {
  const { data, error } = await supabase.functions.invoke('analyze-product-vision', {
    body: { images, productName },
  });

  if (error) {
    throw new Error(error.message ?? 'Vision AI 분석 실패');
  }

  if (!data) {
    throw new Error('Vision AI 분석 결과를 받지 못했습니다.');
  }

  return data as ProductVisionResult;
}

export function buildOrbitalPromptExtension(
  vision: ProductVisionResult,
  basePrompt: string,
): string {
  const features = vision.visualFeatures.slice(0, 5).join(', ');
  const marketingPoints = vision.marketingPoints.slice(0, 3).join(' / ');
  const depthLayers = vision.parallaxDepthLayers.length > 0
    ? vision.parallaxDepthLayers.join(' → ')
    : 'foreground product → midground context → background bokeh';
  const copyLayers = vision.suggestedCopyLayers;

  const angleDescriptions = vision.keyAngles.length > 0
    ? vision.keyAngles.map((a) => `  • ${a.angle}: ${a.description}`).join('\n')
    : '  • Front: product face detail\n  • 45° side: depth and form\n  • Top: texture overview\n  • Close-up: material detail\n  • Context: lifestyle placement';

  return [
    `### VISION AI PRODUCT ANALYSIS — 3D ORBITAL AD FORMAT`,
    ``,
    `Product: ${vision.productName}`,
    `Category: ${vision.productCategory}`,
    `Visual Features: ${features}`,
    `Marketing Points: ${marketingPoints}`,
    `Texture: ${vision.textureDescription}`,
    `Material: ${vision.materialGuess}`,
    `Color Palette: ${vision.colorPalette.join(', ')}`,
    `Shape: ${vision.shapeDescription}`,
    ``,
    `### MULTI-ANGLE REFERENCE (from 5 captured cuts)`,
    angleDescriptions,
    ``,
    `### 3D CAMERA ORBITAL TRAJECTORY`,
    `Orbital Focus Point: ${vision.orbitalFocusPoint || 'product center mass'}`,
    `Parallax Depth Layers: ${depthLayers}`,
    ``,
    `Camera path: Start frontal close-up → orbital arc clockwise 90° over 4s (radius 1.5x product width) →`,
    `parallax drift through depth layers at 6s → reverse arc counter-clockwise 45° at 10s →`,
    `settle to frontal zoom-out reveal at 13s → locked hero frame for CTA 14-15s.`,
    `Maintain product as orbital anchor; background parallax shifts with camera angle.`,
    `Depth: foreground product sharp, midground 50% blur, background 85% bokeh blur.`,
    ``,
    `### STEREOSCOPIC COPYWRITING LAYERS (3D Z-AXIS TEXT)`,
    `Primary (z=0, foreground): "${copyLayers.primary}" — kinetic typography, 120% pop, drop shadow depth 4px`,
    `Secondary (z=0.5, midground): "${copyLayers.secondary}" — fades in at 4s, 80% opacity, parallax drift -8px`,
    `Tertiary (z=1.0, background): "${copyLayers.tertiary}" — subtle ambient text, 40% opacity, static placement`,
    ``,
    `### INTEGRATION WITH BASE PROMPT`,
    basePrompt,
  ].join('\n');
}
