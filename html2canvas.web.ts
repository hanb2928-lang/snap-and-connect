import type { Html2CanvasFn } from './html2canvas';

export async function getHtml2Canvas(): Promise<Html2CanvasFn> {
  const mod = await import('html2canvas');
  return mod.default;
}
