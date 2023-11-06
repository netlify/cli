import { parseAllDomains, handleImageDomainsErrors, transformImageParams } from './proxy.mjs';

describe('parseAllDomains', () => {
  it('should parse all domains correctly', () => {
    const config = {
      images: {
        remote_images: ['https://example.com', 'https://test.com']
      }
    };
    const { errors, remoteDomains } = parseAllDomains(config);
    expect(errors).toEqual([]);
    expect(remoteDomains).toEqual(['example.com', 'test.com']);
  });
});

describe('handleImageDomainsErrors', () => {
  it('should handle errors correctly', async () => {
    const errors = [{ message: 'Error message 1' }, { message: 'Error message 2' }];
    await expect(handleImageDomainsErrors(errors)).rejects.toThrow('Image domains syntax errors:\nError message 1\n\nError message 2');
  });
});

describe('transformImageParams', () => {
  it('should transform image params correctly', () => {
    const query = {
      w: '100',
      h: '200',
      q: '80',
      fm: 'jpg',
      fit: 'crop',
      crop: 'center'
    };
    const result = transformImageParams(query);
    expect(result).toEqual('w_100,h_200,quality_80,format_jpg,fit_cover,position_center');
  });
});