/**
 * 이미지 지배적 색상 추출 테스트
 *
 * 기존에 color-thief, vibrant 등의 라이브러리를 사용했으나
 * 운영 환경에서 원하는 색상이 제대로 추출되지 않는 문제가 발생.
 * Claude에게 질문하며 직접 픽셀 분석 기반 색상 추출 로직을 구축함.
 */

import { createCanvas, loadImage } from 'canvas';

interface ColorInfo {
  hex: string;
  rgb: { r: number; g: number; b: number };
  count: number;
  percentage: number;
}

/**
 * 이미지 버퍼에서 지배적인 색상들을 추출
 * 비슷한 색상끼리 묶어서 계산함
 */
async function extractDominantColors(
  imageBuffer: Buffer,
  maxColors: number = 5,
): Promise<ColorInfo[]> {
  const image = await loadImage(imageBuffer);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  // 색상 빈도 계산 (비슷한 색상끼리 그룹화)
  const colorMap = new Map<string, number>();
  const roundColor = (value: number) => Math.round(value / 16) * 16;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = roundColor(pixels[i]);
    const g = roundColor(pixels[i + 1]);
    const b = roundColor(pixels[i + 2]);
    const a = pixels[i + 3];

    // 투명한 픽셀은 제외
    if (a < 128) continue;

    const key = `${r},${g},${b}`;
    colorMap.set(key, (colorMap.get(key) || 0) + 1);
  }

  // 많이 나온 순서대로 정렬
  const sortedColors = Array.from(colorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxColors);

  const totalPixels = sortedColors.reduce((sum, [, count]) => sum + count, 0);

  return sortedColors.map(([key, count]) => {
    const [r, g, b] = key.split(',').map(Number);
    return {
      hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
      rgb: { r, g, b },
      count,
      percentage: Math.round((count / totalPixels) * 100),
    };
  });
}

describe('extractDominantColors', () => {
  it('should extract dominant colors from image buffer', async () => {
    // 테스트용 단색 이미지 생성
    const canvas = createCanvas(100, 100);
    const ctx = canvas.getContext('2d');

    // 빨간색으로 채우기
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 100, 100);

    const buffer = canvas.toBuffer('image/png');
    const colors = await extractDominantColors(buffer);

    expect(colors.length).toBeGreaterThan(0);
    // 색상 그룹화 때문에 정확히 #ff0000이 아닐 수 있음
    expect(colors[0].rgb.r).toBeGreaterThan(200);
    expect(colors[0].percentage).toBe(100);
  });

  it('should extract multiple colors from two-tone image', async () => {
    const canvas = createCanvas(100, 100);
    const ctx = canvas.getContext('2d');

    // 절반은 빨강, 절반은 파랑
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 50, 100);
    ctx.fillStyle = '#0000ff';
    ctx.fillRect(50, 0, 50, 100);

    const buffer = canvas.toBuffer('image/png');
    const colors = await extractDominantColors(buffer);

    expect(colors.length).toBeGreaterThanOrEqual(2);
  });
});
