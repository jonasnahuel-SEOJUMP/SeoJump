import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  mockGoto,
  mockContent,
  mockUrl,
  mockSetUserAgent,
  mockSetDefaultNavigationTimeout,
  mockSetDefaultTimeout,
  mockClose,
  mockNewPage,
  mockLaunch,
  mockDefaultArgs,
  mockExecutablePath,
} = vi.hoisted(() => ({
  mockGoto: vi.fn(),
  mockContent: vi.fn(),
  mockUrl: vi.fn(),
  mockSetUserAgent: vi.fn(),
  mockSetDefaultNavigationTimeout: vi.fn(),
  mockSetDefaultTimeout: vi.fn(),
  mockClose: vi.fn(),
  mockNewPage: vi.fn(),
  mockLaunch: vi.fn(),
  mockDefaultArgs: vi.fn(({ args }: { args?: string[] }) => args || []),
  mockExecutablePath: vi.fn(async () => '/tmp/fake-chromium'),
}));

vi.mock('puppeteer-core', () => ({
  default: {
    defaultArgs: mockDefaultArgs,
    launch: mockLaunch,
  },
}));

vi.mock('@sparticuz/chromium', () => ({
  default: {
    args: ['--no-sandbox'],
    set setGraphicsMode(_v: boolean) {
      /* noop */
    },
    executablePath: mockExecutablePath,
  },
}));

vi.mock('./urlSafety.js', () => ({
  assertSafePublicUrl: vi.fn(),
}));

import { fetchPageHtmlWithBrowser } from './fetchPageBrowser';
import { assertSafePublicUrl } from './urlSafety.js';

describe('fetchPageHtmlWithBrowser', () => {
  beforeEach(() => {
    vi.mocked(assertSafePublicUrl).mockReset();
    mockGoto.mockReset();
    mockContent.mockReset();
    mockUrl.mockReset();
    mockSetUserAgent.mockReset();
    mockClose.mockReset();
    mockNewPage.mockReset();
    mockLaunch.mockReset();
    mockDefaultArgs.mockClear();
    mockExecutablePath.mockClear();

    mockNewPage.mockResolvedValue({
      setDefaultNavigationTimeout: mockSetDefaultNavigationTimeout,
      setDefaultTimeout: mockSetDefaultTimeout,
      setUserAgent: mockSetUserAgent,
      goto: mockGoto,
      content: mockContent,
      url: mockUrl,
    });
    mockLaunch.mockResolvedValue({
      newPage: mockNewPage,
      close: mockClose,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('bloquea URLs privadas vía assertSafePublicUrl (no lanza Chromium)', async () => {
    vi.mocked(assertSafePublicUrl).mockResolvedValue({
      safe: false,
      reason: 'No se pueden analizar direcciones internas o privadas.',
    });

    const res = await fetchPageHtmlWithBrowser('http://127.0.0.1/');
    expect(res.ok).toBe(false);
    expect(res).toMatchObject({
      ok: false,
      message: expect.stringMatching(/internas|privadas/i),
    });
    expect(mockLaunch).not.toHaveBeenCalled();
  });

  it('navega y cierra el browser en finally', async () => {
    vi.mocked(assertSafePublicUrl).mockResolvedValue({
      safe: true,
      url: 'https://example.com/',
      addresses: ['93.184.216.34'],
    });
    mockGoto.mockResolvedValue({ status: () => 200 });
    mockContent.mockResolvedValue(
      '<html><head><title>Example Domain Page</title></head><body><h1>Hi there friend</h1><p>More visible text content here.</p></body></html>'
    );
    mockUrl.mockReturnValue('https://example.com/');

    const res = await fetchPageHtmlWithBrowser('https://example.com/');
    expect(res).toEqual({
      ok: true,
      html: expect.stringContaining('Example Domain'),
      finalUrl: 'https://example.com/',
    });
    expect(mockLaunch).toHaveBeenCalled();
    expect(mockGoto).toHaveBeenCalledWith(
      'https://example.com/',
      expect.objectContaining({ waitUntil: 'networkidle2' })
    );
    expect(mockClose).toHaveBeenCalled();
  });
});
