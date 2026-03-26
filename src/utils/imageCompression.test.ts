import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compressImage } from './imageCompression';

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock Image
class MockImage {
  onload: () => void = () => {};
  onerror: (err: any) => void = () => {};
  src: string = '';
  width: number = 1000;
  height: number = 1000;

  constructor() {
    setTimeout(() => this.onload(), 0);
  }
}
global.Image = MockImage as any;

// Mock Canvas
const mockCanvas = {
  getContext: vi.fn(() => ({
    drawImage: vi.fn(),
  })),
  toBlob: vi.fn((callback) => callback(new Blob(['compressed'], { type: 'image/jpeg' }))),
  width: 0,
  height: 0,
};
global.document.createElement = vi.fn((tagName) => {
  if (tagName === 'canvas') return mockCanvas as any;
  return {};
}) as any;

describe('imageCompression', () => {
  it('should compress an image', async () => {
    const file = new File(['dummy content'], 'test.jpg', { type: 'image/jpeg' });
    const result = await compressImage(file, 800, 800, 0.5);
    
    expect(result).toBeInstanceOf(Blob);
    expect(mockCanvas.width).toBe(800);
    expect(mockCanvas.height).toBe(800);
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(file);
  });

  it('should maintain aspect ratio when compressing width', async () => {
    // Mock image with 2000x1000 (2:1 ratio)
    const originalWidth = 2000;
    const originalHeight = 1000;
    
    // Update the mock image for this test
    const MockImageLandscape = class extends MockImage {
      width = originalWidth;
      height = originalHeight;
    };
    global.Image = MockImageLandscape as any;

    const file = new File(['dummy content'], 'test.jpg', { type: 'image/jpeg' });
    await compressImage(file, 800, 800, 0.5);
    
    expect(mockCanvas.width).toBe(800);
    expect(mockCanvas.height).toBe(400); // 800 * (1000/2000) = 400
  });
});
