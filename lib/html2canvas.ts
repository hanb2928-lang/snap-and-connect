export type Html2CanvasFn = (
  element: HTMLElement,
  options?: Record<string, unknown>,
) => Promise<HTMLCanvasElement>;

export async function getHtml2Canvas(): Promise<Html2CanvasFn | null> {
  return null;
}
