import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/exportService', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../services/exportService')>();
  return {
    ...mod,
    renderCoverCanvas: vi.fn().mockResolvedValue({
      getContext: vi.fn().mockReturnValue({ clearRect: vi.fn() }),
      toBlob: (cb: any) => cb(new Blob(['mock'])),
      width: 0,
      height: 0
    })
  };
});

import { downloadZip } from '../services/exportService';
import { Episode } from '../types';

describe('downloadZip', () => {
  let addLogMock: any;
  beforeEach(() => {
    addLogMock = vi.fn();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it('should not crash if invalid objects or DOM elements are injected into ep', async () => {
    // Actually we don't even need to mock renderCoverCanvas if we use ep.coverBase64
    // since that path skips renderCoverCanvas
    const ep: any = {
      id: 1,
      titleJp: 'テスト',
      coverBase64: 'data:image/png;base64,1234',
      cuts: [
        {
          id: 1,
          imageBase64: 'data:image/png;base64,1234',
          telop: { style: 'test' }
        }
      ]
    };

    const div = document.createElement('div');
    ep.maliciousDOM = div;
    ep.circularRef = ep;

    const result = await downloadZip(ep as Episode, addLogMock);

    if (!result) {
        console.log("Mock calls:", addLogMock.mock.calls);
    }

    expect(result).not.toBeNull();
    if (result) {
      expect(result.flowSuccess).toBeDefined();
    }
  });
});
