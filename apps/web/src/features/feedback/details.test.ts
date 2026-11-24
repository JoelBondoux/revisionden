import { browserFamily, collectDeviceDetails, findPersonalDetails } from './details';

describe('findPersonalDetails', () => {
  it.each([
    ['my email is someone@example.com', true],
    ['call 07700 900123', true],
    ['call +44 7700 900123', true],
    ['the button on question 7 is broken', false],
    ['score 12345 shown wrongly', false],
    ['', false],
  ])('%s → %s', (text, found) => {
    expect(findPersonalDetails(text)).toBe(found);
  });
});

describe('browserFamily', () => {
  it.each([
    [
      'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0',
      'Edge',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML) Chrome/120.0 Safari/537.36',
      'Chrome',
    ],
    [
      'Mozilla/5.0 (iPad; CPU OS 17_0) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1',
      'Safari',
    ],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0', 'Firefox'],
    ['Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 CriOS/120.0 Mobile Safari/604.1', 'Chrome'],
    ['curl/8.0', 'Other'],
  ])('%s is %s', (ua, family) => {
    expect(browserFamily(ua)).toBe(family);
  });
});

describe('collectDeviceDetails', () => {
  it('collects only the version, screen, browser family, screen size and online state', () => {
    expect(
      collectDeviceDetails({
        appVersion: '00.04.012',
        route: '/cards',
        userAgent: 'Mozilla/5.0 Gecko/20100101 Firefox/121.0',
        width: 390.4,
        height: 844,
        online: true,
      }),
    ).toEqual({
      appVersion: '00.04.012',
      route: '/cards',
      browserFamily: 'Firefox',
      screenSize: '390x844',
      online: true,
    });
  });
});
