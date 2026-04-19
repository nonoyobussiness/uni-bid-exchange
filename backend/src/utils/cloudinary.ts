type UploadResult = {
  url: string;
};

const sanitizeName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const uploadImage = async (file: string, index: number): Promise<UploadResult> => {
  const baseName = sanitizeName(file) || `image-${index + 1}`;

  return {
    url: `https://mock-cloudinary.unibid-exchange.local/${Date.now()}-${index + 1}-${baseName}.jpg`,
  };
};

export const uploadImages = async (files: string[]): Promise<string[]> => {
  const uploads = await Promise.all(files.map((file, index) => uploadImage(file, index)));
  return uploads.map((item) => item.url);
};
