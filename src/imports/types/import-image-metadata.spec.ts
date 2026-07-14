import { splitPrimaryAndExtraImages } from './import-image-metadata';

describe('splitPrimaryAndExtraImages', () => {
  const img = (url: string) => ({
    key: url,
    bucket: 'mathpix-import-pending',
    region: 'external',
    url,
  });

  it('returns null primary and empty extras for no images', () => {
    expect(splitPrimaryAndExtraImages([])).toEqual({
      image: null,
      images: [],
    });
  });

  it('puts the first image in image and keeps extras only in images', () => {
    const a = img('https://cdn.example.com/a.jpg');
    const b = img('https://cdn.example.com/b.jpg');
    const c = img('https://cdn.example.com/c.jpg');

    const result = splitPrimaryAndExtraImages([a, b, c]);

    expect(result.image).toEqual(a);
    expect(result.images).toEqual([b, c]);
    expect(result.images).not.toContainEqual(a);
  });

  it('has empty images when there is only one image', () => {
    const a = img('https://cdn.example.com/a.jpg');
    expect(splitPrimaryAndExtraImages([a])).toEqual({
      image: a,
      images: [],
    });
  });
});
