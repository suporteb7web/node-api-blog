import sharp from 'sharp';

type TestImageFormat = 'png' | 'jpeg' | 'webp';

export async function createTestImage(options?: {
  width?: number;
  height?: number;
  format?: TestImageFormat;
}): Promise<Buffer> {
  const width = options?.width ?? 400;
  const height = options?.height ?? 300;
  const format = options?.format ?? 'png';

  const pipeline = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 40, b: 40 },
    },
  });

  if (format === 'jpeg') {
    return pipeline.jpeg().toBuffer();
  }

  if (format === 'webp') {
    return pipeline.webp().toBuffer();
  }

  return pipeline.png().toBuffer();
}
