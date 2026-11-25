import { detectDeviceType } from './LinkPage';

function fake(touchPoints: number, width: number, height: number) {
  Object.defineProperty(navigator, 'maxTouchPoints', { value: touchPoints, configurable: true });
  vi.spyOn(window.screen, 'width', 'get').mockReturnValue(width);
  vi.spyOn(window.screen, 'height', 'get').mockReturnValue(height);
}

afterEach(() => vi.restoreAllMocks());

describe('detectDeviceType', () => {
  it('calls a device without touch a computer', () => {
    fake(0, 1920, 1080);
    expect(detectDeviceType()).toBe('computer');
  });

  it('tells a phone from a tablet by its shorter side', () => {
    fake(5, 390, 844);
    expect(detectDeviceType()).toBe('phone');
    fake(5, 1024, 768);
    expect(detectDeviceType()).toBe('tablet');
  });
});
